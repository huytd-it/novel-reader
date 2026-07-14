# Self-hosted fonts

## Bookery

The reader offers **Bookery** as a reading font. It is self-hosted (not on Google
Fonts). Drop the font files here with these exact names:

- `bookery.woff2` (preferred)
- `bookery.ttf` (fallback)

They are referenced by the `@font-face` in `src/styles/themes.css` at the URL
`/fonts/bookery.woff2` (Vite serves `public/` from the site root).

Until the files are present, the Bookery option falls back to the serif stack
(`'Noto Serif', Georgia, serif`) — nothing breaks; text just renders in the
fallback face. Make sure the file includes the **Vietnamese** subset
(Latin Extended-B + combining diacritics) so tone marks render correctly.
