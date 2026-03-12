/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#10b981', // Verde vibrante (emerald-500)
          secondary: '#facc15', // Amarelo forte (yellow-400)
          dark: '#064e3b', // Verde escuro para títulos (emerald-900)
          light: '#ecfdf5', // Verde muito claro para fundos sutis (emerald-50)
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
