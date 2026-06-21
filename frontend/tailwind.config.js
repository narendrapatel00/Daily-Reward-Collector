/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Support explicit theme class
  theme: {
    extend: {
      colors: {
        darkBg: '#09090b',
        darkCard: 'rgba(24, 24, 27, 0.65)',
        accentPurple: '#8b5cf6',
        accentCyan: '#06b6d4',
        accentEmerald: '#10b981',
      },
      backdropBlur: {
        glass: '16px',
      },
      borderWidth: {
        glass: '1px',
      },
      borderColor: {
        glass: 'rgba(255, 255, 255, 0.08)',
      },
      backgroundColor: {
        glass: 'rgba(255, 255, 255, 0.03)',
        glassHover: 'rgba(255, 255, 255, 0.07)',
      }
    },
  },
  plugins: [],
}
