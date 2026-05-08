/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: '#0d0d1a',
          surface: '#13131f',
          surface2: '#1a1a2e',
          elevated: '#1e1e35',
          border: '#2a2a44',
          'border-light': '#373760',
          text: '#e8e8f0',
          'text-dim': '#9999bb',
          'text-muted': '#6b6b8d',
          primary: '#7C3AED',
          'primary-light': '#A78BFA',
          'primary-dim': 'rgba(124, 58, 237, 0.15)',
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
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        pulseSoft: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
      },
    },
  },
  plugins: [],
};
