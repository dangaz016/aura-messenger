import { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff } from 'lucide-react';
import { Avatar } from '../Common/Avatar';

interface ActiveCallModalProps {
  userName: string;
  userId: string;
  duration: number;
  isMuted: boolean;
  onMuteToggle: () => void;
  onEndCall: () => void;
  isConnected: boolean;
}

export function ActiveCallModal({
  userName,
  userId,
  duration,
  isMuted,
  onMuteToggle,
  onEndCall,
  isConnected,
}: ActiveCallModalProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-aura-bg via-aura-elevated to-aura-bg flex items-center justify-center">
      <div className="text-center w-full max-w-md px-6">
        {/* Avatar */}
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
        <div className="flex items-center justify-center gap-8">
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
