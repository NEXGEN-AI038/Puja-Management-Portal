/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7f4',
          100: '#dceee5',
          200: '#bbddca',
          300: '#8bc5a8',
          400: '#56a580',
          500: '#338863',
          600: '#236d4e',
          700: '#1d5740',
          800: '#194634',
          900: '#163b2c',
          950: '#0c2118',
        },
        gold: {
          50: '#fdfbf3',
          100: '#faf3dc',
          200: '#f3e4b0',
          300: '#ebce78',
          400: '#e0b943',
          500: '#cda027',
          600: '#ad7e1c',
          700: '#895e1a',
          800: '#724b1c',
          900: '#623f1b',
          950: '#38220d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
