/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Theming is driven by CSS variables in src/styles/themes.css.
      // These map Tailwind color utilities onto those vars so components
      // can use `bg-bg`, `text-text`, `text-muted`, etc.
      colors: {
        bg: 'var(--bg)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        accent: 'var(--accent)',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        reader: 'var(--reader-measure)',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
};
