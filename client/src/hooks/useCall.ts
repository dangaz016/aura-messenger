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
  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      throw err;
    }
  }, []);

  // Start outgoing call
  const startCall = useCallback(
    async (userId: string, userName: string) => {
      try {
        setRemoteUserId(userId);
        setRemoteUserName(userName);
        setIsIncoming(false);
        setCallState('calling');

        await getUserMedia();
        const pc = await createPeerConnection();

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketService.socket?.emit('call:offer', {
          targetUserId: userId,
          offer: offer,
          callerName: userName,
        });
      } catch (err) {
        console.error('Error starting call:', err);
        endCall();
      }
    },
    [getUserMedia, createPeerConnection]
  );

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!remoteUserId || !peerConnectionRef.current) return;

    try {
      await getUserMedia();
      const pc = peerConnectionRef.current;

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
    const onOffer = async (data: { callerId: string; callerName: string; offer: RTCSessionDescriptionInit }) => {
      setRemoteUserId(data.callerId);
      setRemoteUserName(data.callerName);
      setIsIncoming(true);
      setCallState('ringing');

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
    const onAnswer = async (data: { callerId: string; answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    // ICE candidate
    const onIceCandidate = async (data: { callerId: string; candidate: RTCIceCandidateInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
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
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
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
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  };
}
