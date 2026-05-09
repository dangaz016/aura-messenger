/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aura: {
          // Dynamic (change with theme) — uses CSS variables
          bg: 'var(--aura-bg)',
          surface: 'var(--aura-surface)',
          surface2: 'var(--aura-surface2)',
          elevated: 'var(--aura-elevated)',
          border: 'var(--aura-border)',
          'border-light': 'var(--aura-border-light)',
          primary: 'var(--aura-accent)',
          'primary-light': 'var(--aura-accent-light)',
          'primary-dim': 'var(--aura-accent-dim)',
          // Static colors
          text: '#e8e8f0',
          'text-dim': '#9999bb',
          'text-muted': '#6b6b8d',
          online: '#22c55e',
          ghost: '#f59e0b',
          dnd: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 4s linear infinite',
        'prime-glow': 'primeGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        pulseSoft: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
        primeGlow: {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(139,92,246,0.6)' },
          '50%': { boxShadow: '0 0 16px 4px rgba(217,70,239,0.8)' },
        },
      },
    },
  },
  plugins: [],
};
