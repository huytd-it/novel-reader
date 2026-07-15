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
        // Map lên CSS vars trong themes.css để đổi tối theo [data-theme='night'].
        canvas: 'var(--canvas)',
        ink: 'var(--ink)',
        'ink-strong': 'var(--ink-strong)',
        'ink-muted': 'var(--ink-muted)',
        'ink-invert': 'var(--ink-invert)',
        hairline: 'var(--hairline)',
        pale: {
          red: 'var(--pale-red)',
          blue: 'var(--pale-blue)',
          green: 'var(--pale-green)',
          yellow: 'var(--pale-yellow)',
        },
        clay: {
          red: 'var(--clay-red)',
          blue: 'var(--clay-blue)',
          green: 'var(--clay-green)',
          yellow: 'var(--clay-yellow)',
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
