import { useEffect, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';

export function LaunchScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-gradient-to-b from-[#0a1340] via-[#04081f] to-black flex items-center justify-center overflow-hidden">
      {/* Animated stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 flex items-center justify-center animate-pulse-soft shadow-2xl shadow-purple-500/50">
            <Sparkles className="w-12 h-12 text-white animate-sparkle" />
          </div>
          <div className="absolute inset-0 w-24 h-24 mx-auto rounded-3xl bg-purple-600/20 animate-ping" />
        </div>

        {/* Brand name */}
        <h1 className="text-6xl font-light mb-4 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent tracking-wider">
          AURA
        </h1>

        {/* Tagline */}
        <div className="flex items-center justify-center gap-3 mb-8 text-blue-200/80">
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
          <div className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <Lock className="w-4 h-4" />
            <span>Encrypted</span>
          </div>
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
        </div>

        {/* Progress bar */}
        <div className="w-64 mx-auto">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-4 text-sm text-blue-200/60 animate-pulse">
            {progress < 30 && 'Initializing...'}
            {progress >= 30 && progress < 60 && 'Establishing secure connection...'}
            {progress >= 60 && progress < 90 && 'Loading encryption keys...'}
            {progress >= 90 && 'Ready'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes sparkle {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
        }
        .animate-twinkle {
          animation: twinkle 3s ease-in-out infinite;
        }
        .animate-sparkle {
          animation: sparkle 4s linear infinite;
        }
        .animate-pulse-soft {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
