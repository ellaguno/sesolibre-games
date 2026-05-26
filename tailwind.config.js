/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          dark: '#4f46e5',
        },
        // Tokens semánticos enlazados a variables CSS (claro/oscuro).
        app: {
          bg: 'rgb(var(--c-bg) / <alpha-value>)',
          surface: 'rgb(var(--c-surface) / <alpha-value>)',
          surface2: 'rgb(var(--c-surface-2) / <alpha-value>)',
          border: 'rgb(var(--c-border) / <alpha-value>)',
          text: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-muted) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
