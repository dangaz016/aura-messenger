import { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Avatar } from '../Common/Avatar';

interface ActiveCallModalProps {
  userName: string;
  userId: string;
  duration: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
  onMuteToggle: () => void;
  onVideoToggle: () => void;
  onEndCall: () => void;
  isConnected: boolean;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
}

export function ActiveCallModal({
  userName,
  userId,
  duration,
  isMuted,
  isVideoEnabled,
  onMuteToggle,
  onVideoToggle,
  onEndCall,
  isConnected,
  localStream,
  remoteStream,
}: ActiveCallModalProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-aura-bg via-aura-elevated to-aura-bg flex items-center justify-center">
      <div className="text-center w-full max-w-md px-6">
        {/* Video streams */}
        {isVideoEnabled && (
          <div className="relative mb-4">
            {/* Remote video */}
            <div className="relative w-full h-64 mb-2 rounded-2xl overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStream && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-aura-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Local video preview */}
            <div className="absolute top-4 right-4 w-24 h-18 rounded-lg overflow-hidden border-2 border-aura-surface bg-black/30 z-10">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            </div>
          </div>
        )}

        {/* Avatar (shown when video is disabled) */}
        {!isVideoEnabled && (
          <div className="relative mx-auto mb-6">
            <Avatar name={userName} color="#7C3AED" size={128} />
            {/* Animated audio waves */}
            {isConnected && (
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-aura-primary rounded-full"
                    style={{
                      height: '16px',
                      animation: `audioWave 0.8s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* User name */}
        <h2 className="text-2xl font-semibold text-aura-text mb-2">{userName}</h2>

        {/* Status */}
        <div className="mb-2">
          {!isConnected ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <p className="text-sm text-aura-text-dim">Подключение...</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-sm text-aura-text-dim">Подключено</p>
            </div>
          )}
        </div>

        {/* Duration */}
        <p className="text-4xl font-light text-aura-text mb-12 tabular-nums">
          {formatDuration(duration)}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Video toggle (only shown if video was initially enabled) */}
          {isVideoEnabled && (
            <button
              onClick={onVideoToggle}
              className="group flex flex-col items-center gap-3"
            >
              <div
                className={`w-14 h-14 rounded-full transition-all flex items-center justify-center group-hover:scale-110 ${
                  isVideoEnabled
                    ? 'bg-aura-surface2 hover:bg-aura-surface3'
                    : 'bg-red-500/20 border-2 border-red-500'
                }`}
              >
                {isVideoEnabled ? (
                  <Video className="w-6 h-6 text-aura-text" />
                ) : (
                  <VideoOff className="w-6 h-6 text-red-500" />
                )}
              </div>
              <span className="text-xs text-aura-text-dim">
                {isVideoEnabled ? 'Выкл. видео' : 'Вкл. видео'}
              </span>
            </button>
          )}

          {/* Mute */}
          <button
            onClick={onMuteToggle}
            className="group flex flex-col items-center gap-3"
          >
            <div
              className={`w-14 h-14 rounded-full transition-all flex items-center justify-center group-hover:scale-110 ${
                isMuted
                  ? 'bg-red-500/20 border-2 border-red-500'
                  : 'bg-aura-surface2 hover:bg-aura-surface3'
              }`}
            >
              {isMuted ? (
                <MicOff className="w-6 h-6 text-red-500" />
              ) : (
                <Mic className="w-6 h-6 text-aura-text" />
              )}
            </div>
            <span className="text-xs text-aura-text-dim">
              {isMuted ? 'Включить' : 'Выкл. звук'}
            </span>
          </button>

          {/* End call */}
          <button
            onClick={onEndCall}
            className="group flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all flex items-center justify-center group-hover:scale-110 shadow-lg shadow-red-500/50">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs text-aura-text-dim">Завершить</span>
          </button>
        </div>
      </div>

      {/* Audio wave animation CSS */}
      <style>{`
        @keyframes audioWave {
          0%, 100% { height: 8px; }
          50% { height: 20px; }
        }
      `}</style>
    </div>
  );
}
