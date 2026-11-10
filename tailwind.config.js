import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // From the prototype: navy shell, blue actions, teal secondary.
        navy: { DEFAULT: '#14243a', 700: '#1c3150', 600: '#263b58', 300: '#aab8ca', 200: '#d3dceb' },
        brand: { 50: '#eef3fd', 100: '#dbe6fb', 500: '#3568d4', 600: '#2b58ba', 700: '#234a9c' },
        teal: { 50: '#e6f5f4', 500: '#0d8b83', 700: '#0a6d67' },
        gray: colors.slate,
        line: '#e5eaf0',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
