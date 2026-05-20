/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8rem', { lineHeight: '1rem' }], // 11.2px at 14px root, keeps it readable
      },
    },
  },
  plugins: [],
}
