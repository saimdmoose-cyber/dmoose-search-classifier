/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dm-black': '#1a1a1a',
        'dm-charcoal': '#2d2d2d',
        'dm-crimson': '#C41E3A',
        'dm-gray': '#a0a0a0',
        'dm-dark-gray': '#3a3a3a',
      },
      fontFamily: {
        'mono': ['"IBM Plex Mono"', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'none': '0',
      },
    },
  },
  plugins: [],
}
