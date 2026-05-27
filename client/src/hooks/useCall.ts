import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../services/socket';

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string | null>(null);
  const [isIncoming, setIsIncoming] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);

  // Start call duration timer
  const startTimer = useCallback(() => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserId) {
        socketService.socket?.emit('call:ice-candidate', {
          targetUserId: remoteUserId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        startTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, [remoteUserId, startTimer]);

  // Get user media
  const getUserMedia = useCallback(async (videoEnabled: boolean = false) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      throw err;
    }
  }, []);

  // Start outgoing call
  const startCall = useCallback(
    async (userId: string, userName: string, videoCall: boolean = false) => {
      try {
        setRemoteUserId(userId);
        setRemoteUserName(userName);
        setIsIncoming(false);
        setCallState('calling');
        setIsVideoEnabled(videoCall);

        await getUserMedia(videoCall);
        const pc = await createPeerConnection();

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketService.socket?.emit('call:offer', {
          targetUserId: userId,
          offer: offer,
          callerName: userName,
          hasVideo: videoCall,
        });
      } catch (err) {
        console.error('Error starting call:', err);
        endCall();
      }
    },
    [getUserMedia, createPeerConnection]
  );

  // Accept incoming call
  const acceptCall = useCallback(async (videoCall: boolean = false) => {
    if (!remoteUserId || !peerConnectionRef.current) return;

    try {
      await getUserMedia(videoCall);
      const pc = peerConnectionRef.current;
      setIsVideoEnabled(videoCall);

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.socket?.emit('call:answer', {
        targetUserId: remoteUserId,
        answer: answer,
        hasVideo: videoCall,
      });

      setCallState('connected');
      setIsIncoming(false);
      startTimer();
    } catch (err) {
      console.error('Error accepting call:', err);
      endCall();
    }
  }, [remoteUserId, getUserMedia, startTimer]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (remoteUserId) {
      socketService.socket?.emit('call:reject', { targetUserId: remoteUserId });
    }
    cleanup();
  }, [remoteUserId]);

  // End call
  const endCall = useCallback(() => {
    if (remoteUserId) {
      socketService.socket?.emit('call:end', { targetUserId: remoteUserId });
    }
    cleanup();
  }, [remoteUserId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(!videoTrack.enabled);
      
      // Notify remote peer about video state change
      if (peerConnectionRef.current && remoteUserId) {
        socketService.socket?.emit('call:video-state', {
          targetUserId: remoteUserId,
          videoEnabled: !videoTrack.enabled
        });
      }
    } else if (!isVideoEnabled) {
      // Need to add video track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        
        const videoTrack = newStream.getVideoTracks()[0];
        if (peerConnectionRef.current && videoTrack) {
          peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current!);
          setIsVideoEnabled(true);
          
          socketService.socket?.emit('call:video-state', {
            targetUserId: remoteUserId,
            videoEnabled: true
          });
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    }
  }, [isVideoEnabled, remoteUserId]);

  // Cleanup
  const cleanup = useCallback(() => {
    stopTimer();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    remoteStreamRef.current = null;
    setRemoteUserId(null);
    setRemoteUserName(null);
    setIsIncoming(false);
    setIsMuted(false);
    setCallState('idle');
  }, [stopTimer]);

  // Socket event listeners
  useEffect(() => {
    const socket = socketService.socket;
    if (!socket) return;

    // Incoming call
    const onOffer = async (data: { callerId: string; callerName: string; offer: RTCSessionDescriptionInit; hasVideo?: boolean }) => {
      setRemoteUserId(data.callerId);
      setRemoteUserName(data.callerName);
      setIsIncoming(true);
      setCallState('ringing');
      setIsVideoEnabled(data.hasVideo || false);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      // Setup peer connection handlers
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('call:ice-candidate', {
            targetUserId: data.callerId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('connected');
          startTimer();
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          cleanup();
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    };

    // Call answered
    const onAnswer = async (data: { callerId: string; answer: RTCSessionDescriptionInit; hasVideo?: boolean }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      if (data.hasVideo !== undefined) {
        setIsVideoEnabled(data.hasVideo);
      }
    };

    // ICE candidate
    const onIceCandidate = async (data: { callerId: string; candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    };

    // Video state change
    const onVideoState = async (data: { callerId: string; videoEnabled: boolean }) => {
      // Handle remote video state change
      console.log('Remote video state changed:', data.videoEnabled);
      // Here you could update UI to show/hide remote video
    };

    // Call rejected
    const onRejected = () => {
      cleanup();
    };

    // Call ended
    const onEnded = () => {
      cleanup();
    };

    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:video-state', onVideoState);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:video-state', onVideoState);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
    };
  }, [cleanup, startTimer]);

  return {
    callState,
    remoteUserId,
    remoteUserName,
    isIncoming,
    isMuted,
    isVideoEnabled,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
