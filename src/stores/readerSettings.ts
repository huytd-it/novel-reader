import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Chỉ lộ ra 3 tùy chỉnh: Cỡ chữ · Theme · Font. Hết.

export type Theme = 'paper' | 'sepia' | 'night';
export type FontChoice = 'serif' | 'sans';

/** 5 mức cỡ chữ (px). Mức 3 (19px) là mặc định. */
export const FONT_SIZES = [16, 17.5, 19, 21, 23] as const;
export const DEFAULT_SIZE_LEVEL = 2; // index vào FONT_SIZES → 19px

export const FONT_STACKS: Record<FontChoice, string> = {
  serif: "'Noto Serif', 'Lora', Georgia, serif",
  sans: "'Be Vietnam Pro', system-ui, sans-serif",
};

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
      theme: 'paper',
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
      version: 1,
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
  root.setAttribute('data-theme', state.theme);
  root.style.setProperty('--reader-size', `${FONT_SIZES[state.sizeLevel]}px`);
  root.style.setProperty('--font-serif', FONT_STACKS.serif);
  // Font body của reader: người dùng chọn serif hoặc sans.
  root.style.setProperty(
    '--reader-font',
    state.font === 'serif' ? FONT_STACKS.serif : FONT_STACKS.sans,
  );

  // Cập nhật theme-color cho thanh trình duyệt mobile.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}
