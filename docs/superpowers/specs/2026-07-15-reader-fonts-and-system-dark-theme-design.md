# Reader fonts (Bookery + Literata) + app-wide system dark theme

**Date:** 2026-07-15
**Scope:** `src/components/reader`, `src/stores/readerSettings.ts`, `src/styles/themes.css`, `tailwind.config.js`, `index.html`, `public/fonts/`

## Goal

1. Add two reading fonts to the reader — **Literata** (Google Fonts) and **Bookery** (self-hosted).
2. Add an **app-wide dark theme that follows the system** (`prefers-color-scheme`), covering both the reading surface and the browse/chrome (editorial) surfaces.

## Current state (constraints)

- Reader settings live in `src/stores/readerSettings.ts` (zustand + persist). Three themes
  (`paper`/`sepia`/`night`) and two fonts (`serif`/`sans`). `applySettingsToDOM` writes
  `data-theme` on `<html>` plus `--reader-size`/`--reader-font` CSS vars.
- Theme palettes are pure CSS vars in `src/styles/themes.css`, keyed on `[data-theme]`.
  `night` is already a dark reading palette.
- **Browse/chrome surfaces use a separate, hardcoded-light editorial palette** (`canvas`,
  `ink`, `ink-strong`, `ink-muted`, `hairline`, `pale-*`, `clay-*`) defined as fixed hex in
  `tailwind.config.js` — independent of `data-theme`. So today the app chrome stays light even
  in `night` reader mode. True app-wide dark requires giving these tokens dark values.

## Design

### Part A — Reading fonts

- Extend `FontChoice`: `'serif' | 'sans' | 'literata' | 'bookery'`.
- Add `FONT_STACKS` entries:
  - `literata: "'Literata', Georgia, serif"`
  - `bookery: "'Bookery', 'Noto Serif', Georgia, serif"` (falls back to serif until the file exists).
- Load **Literata** via the Google Fonts `<link>` in `index.html` (has full Vietnamese coverage).
- **Bookery** is self-hosted: `@font-face` in `themes.css` pointing at `/fonts/bookery.woff2`
  (+ `.ttf` fallback), `font-display: swap`. Files go in `public/fonts/`; a `README` there
  documents the expected filenames. Missing file → graceful serif fallback, no breakage.
- `SettingsSheet` FONTS array shows all four in a 2-column grid, each rendering its own sample
  via its stack.

### Part B — App-wide system dark theme

- Convert the editorial palette (`canvas`/`ink`/`ink-strong`/`ink-muted`/`hairline`/`pale-*`/
  `clay-*`) from hardcoded hex in `tailwind.config.js` to `var(--...)`. Components keep using
  the same Tailwind tokens (`bg-canvas`, `text-ink`, …) — **no component files change**.
- In `themes.css`: define light editorial vars at `:root`; define dark editorial var overrides
  under `[data-theme='night']`. Dark chrome is thus tied to the active dark reading theme.
- **Discovered during implementation:** ~30 chrome surfaces used hardcoded `bg-white` (not a
  token), which would stay white in dark mode. Converted `bg-white` → `bg-surface` across 20
  files. `--surface` is `#ffffff` in `paper`, so light appearance is unchanged; it darkens in
  `night`. This is the only component-file change (mechanical, class-string only).
- Add an `'auto'` theme to the `Theme` union and make it the **default** (persist version bump;
  existing users keep their saved theme). `applySettingsToDOM` resolves `auto` →
  `night` when `matchMedia('(prefers-color-scheme: dark)')` matches, else `paper`.
- `App.tsx` `SettingsApplier` subscribes to `prefers-color-scheme` changes and re-applies while
  theme is `auto`, so OS toggles update the app live.
- Coherent darkness model:
  - `auto` → light or dark by system
  - `paper` / `sepia` → light chrome
  - `night` → dark chrome
- `SettingsSheet` THEMES array gains a **"Tự động"** (auto) option; themes shown in a 2-col grid.

## Non-goals

- No manual (non-system) global dark toggle beyond the reader's explicit picker.
- No redesign of the editorial palette beyond deriving dark values.
- No new sepia-dark or OLED-black variants.

## Verification

Browser preview: switch each of the four fonts and confirm the reading text face changes;
toggle OS dark mode with theme `auto` and confirm both reader and Library/BookDetail chrome
flip light↔dark; confirm `night`/`paper`/`sepia` explicit picks still behave.
