/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A56DB',
          50: '#EBF5FF',
          100: '#E1EFFE',
          200: '#C3DDFD',
          300: '#A4CAFE',
          400: '#76A9FA',
          500: '#3F83F8',
          600: '#1C64F2',
          700: '#1A56DB',
          800: '#1E429F',
          900: '#233876',
        },
        danger: {
          DEFAULT: '#E02424',
          50: '#FDF2F2',
          500: '#E02424',
          600: '#C81E1E',
          700: '#9B1C1C',
        },
        success: {
          DEFAULT: '#0E9F6E',
          50: '#F3FAF7',
          500: '#0E9F6E',
          600: '#057A55',
          700: '#046C4E',
        },
        warning: {
          DEFAULT: '#F59E0B',
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        janmitra: {
          navy: '#0d2a53',
          blue: '#1A56DB',
          lightBlue: '#EBF5FF',
          dark: '#0B192C',
        },
        dept: {
          pwd: '#1A56DB',
          swm: '#16A34A',
          phe: '#0891B2',
          electrical: '#D97706',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
