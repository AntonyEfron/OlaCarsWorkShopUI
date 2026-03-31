/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'tablet': '768px',
        '3xl': '1920px',
      },
      colors: {
        lime: {
          DEFAULT: '#C8E600',
          dark: '#a8c100',
          light: '#d8f200',
        },
        brand: {
          black: '#0A0A0A',
        },
        dark: {
          bg: '#111111',
          card: '#1C1C1C',
          border: '#2A2A2A',
        },
        light: {
          bg: '#F5F7FA',
          border: '#E5E7EB',
        },
        alert: '#E74C3C',
        warning: '#E67E22',
        muted: '#6B7280',
        primary: {
          DEFAULT: '#C8E600',
          light: '#d8f200',
          dark: '#a8c100',
        },
        secondary: {
          DEFAULT: '#1C1C1C',
          light: '#2A2A2A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fadeInUp': 'fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
        'slideInRight': 'slideInRight 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'scaleIn': 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer': 'shimmer 2.5s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
};
