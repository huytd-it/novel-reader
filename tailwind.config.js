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

        // ---- Editorial palette (browse/chrome surfaces) ----
        // Fixed warm-monochrome tokens, độc lập với data-theme của reader.
        canvas: '#FBFBFA',
        ink: '#2F3437',
        'ink-strong': '#1A1A18',
        'ink-muted': '#787774',
        hairline: '#EAEAEA',
        pale: {
          red: '#FDEBEC',
          blue: '#E1F3FE',
          green: '#EDF3EC',
          yellow: '#FBF3DB',
        },
        clay: {
          red: '#9F2F2D',
          blue: '#1F6C9F',
          green: '#346538',
          yellow: '#956400',
        },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Editorial display serif (có subset tiếng Việt).
        display: ['Newsreader', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'monospace'],
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
