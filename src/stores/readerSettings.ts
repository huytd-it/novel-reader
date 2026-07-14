import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Chỉ lộ ra 3 tùy chỉnh: Cỡ chữ · Theme · Font. Hết.

// 'auto' theo prefers-color-scheme của hệ điều hành; paper/sepia = sáng,
// night = tối. applySettingsToDOM quy đổi 'auto' → 'paper' | 'night'.
export type Theme = 'auto' | 'paper' | 'sepia' | 'night';
/** Theme thực sự áp vào DOM (sau khi quy đổi 'auto'). */
export type ResolvedTheme = 'paper' | 'sepia' | 'night';
export type FontChoice = 'serif' | 'sans' | 'literata' | 'bookery';

/** 5 mức cỡ chữ (px). Mức 3 (19px) là mặc định. */
export const FONT_SIZES = [16, 17.5, 19, 21, 23] as const;
export const DEFAULT_SIZE_LEVEL = 2; // index vào FONT_SIZES → 19px

export const FONT_STACKS: Record<FontChoice, string> = {
  serif: "'Noto Serif', 'Lora', Georgia, serif",
  sans: "'Be Vietnam Pro', system-ui, sans-serif",
  literata: "'Literata', Georgia, serif",
  // Bookery được self-host (public/fonts). Fallback serif tới khi có file.
  bookery: "'Bookery', 'Noto Serif', Georgia, serif",
};

/** True khi hệ điều hành đang ở chế độ tối. */
export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  );
}

/** Quy đổi theme người dùng chọn → theme thực áp vào DOM. */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'auto') return systemPrefersDark() ? 'night' : 'paper';
  return theme;
}

interface ReaderSettingsState {
  theme: Theme;
  sizeLevel: number; // 0..4
  font: FontChoice;
  setTheme: (t: Theme) => void;
  setSizeLevel: (level: number) => void;
  increaseSize: () => void;
  decreaseSize: () => void;
  setFont: (f: FontChoice) => void;
}

export const useReaderSettings = create<ReaderSettingsState>()(
  persist(
    (set) => ({
      theme: 'auto',
      sizeLevel: DEFAULT_SIZE_LEVEL,
      font: 'serif',
      setTheme: (theme) => set({ theme }),
      setSizeLevel: (level) =>
        set({ sizeLevel: clamp(level, 0, FONT_SIZES.length - 1) }),
      increaseSize: () =>
        set((s) => ({ sizeLevel: clamp(s.sizeLevel + 1, 0, FONT_SIZES.length - 1) })),
      decreaseSize: () =>
        set((s) => ({ sizeLevel: clamp(s.sizeLevel - 1, 0, FONT_SIZES.length - 1) })),
      setFont: (font) => set({ font }),
    }),
    {
      name: 'reader-settings',
      version: 2,
      // v1→v2 chỉ thêm 'auto' + 2 font mới; giá trị cũ (paper/sepia/night,
      // serif/sans) vẫn hợp lệ → giữ nguyên settings người dùng đã lưu.
      migrate: (persisted) => persisted as ReaderSettingsState,
    },
  ),
);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Áp settings vào DOM: data-theme trên <html> + CSS vars cỡ chữ/font.
 * Gọi trong effect mỗi khi settings đổi.
 */
export function applySettingsToDOM(state: {
  theme: Theme;
  sizeLevel: number;
  font: FontChoice;
}) {
  const root = document.documentElement;
  // 'auto' → 'paper' | 'night' theo prefers-color-scheme; nền chrome (editorial)
  // đổi tối theo [data-theme='night'] trong themes.css.
  root.setAttribute('data-theme', resolveTheme(state.theme));
  root.style.setProperty('--reader-size', `${FONT_SIZES[state.sizeLevel]}px`);
  root.style.setProperty('--font-serif', FONT_STACKS.serif);
  // Font vùng đọc: người dùng chọn 1 trong 4 (serif/sans/literata/bookery).
  root.style.setProperty('--reader-font', FONT_STACKS[state.font]);

  // Cập nhật theme-color cho thanh trình duyệt mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}
