import { useEffect } from 'react';
import {
  useReaderSettings,
  FONT_SIZES,
  FONT_STACKS,
  type Theme,
  type FontChoice,
} from '@/stores/readerSettings';
import { IconButton } from '@/components/ui/IconButton';
import { CloseIcon, MinusIcon, PlusIcon, CheckIcon } from '@/components/ui/icons';

// 'auto' theo hệ điều hành → swatch nửa sáng nửa tối.
const THEMES: { id: Theme; label: string; swatch: string }[] = [
  {
    id: 'auto',
    label: 'Tự động',
    swatch: 'linear-gradient(135deg, #FAF9F7 0 50%, #16181A 50% 100%)',
  },
  { id: 'paper', label: 'Giấy', swatch: '#FAF9F7' },
  { id: 'sepia', label: 'Sepia', swatch: '#F4ECD8' },
  { id: 'night', label: 'Đêm', swatch: '#16181A' },
];

const FONTS: { id: FontChoice; label: string; sample: string }[] = [
  { id: 'serif', label: 'Serif', sample: 'Aa' },
  { id: 'sans', label: 'Sans', sample: 'Aa' },
  { id: 'literata', label: 'Literata', sample: 'Aa' },
  { id: 'bookery', label: 'Bookery', sample: 'Aa' },
];

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Chỉ 3 tùy chỉnh: Cỡ chữ · Theme · Font. Slide-up trên mobile. */
export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const {
    theme,
    sizeLevel,
    font,
    setTheme,
    increaseSize,
    decreaseSize,
    setFont,
  } = useReaderSettings();

  // Đóng bằng phím Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt đọc"
    >
      <button
        className="absolute inset-0 bg-black/30"
        aria-label="Đóng cài đặt"
        onClick={onClose}
      />
      <div className="sheet-panel absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-5 shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[360px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sans text-base font-semibold">Cài đặt đọc</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        {/* Cỡ chữ */}
        <section className="mb-5">
          <p className="mb-2 text-sm text-muted">Cỡ chữ</p>
          <div className="flex items-center gap-3">
            <IconButton
              label="Giảm cỡ chữ"
              onClick={decreaseSize}
              disabled={sizeLevel === 0}
              className="border border-border"
            >
              <MinusIcon />
            </IconButton>
            <div className="flex flex-1 items-center justify-center gap-1.5">
              {FONT_SIZES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-150 ${
                    i <= sizeLevel ? 'w-6 bg-accent' : 'w-3 bg-border'
                  }`}
                />
              ))}
            </div>
            <IconButton
              label="Tăng cỡ chữ"
              onClick={increaseSize}
              disabled={sizeLevel === FONT_SIZES.length - 1}
              className="border border-border"
            >
              <PlusIcon />
            </IconButton>
          </div>
        </section>

        {/* Theme */}
        <section className="mb-5">
          <p className="mb-2 text-sm text-muted">Nền</p>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ${
                  theme === t.id ? 'border-accent' : 'border-border'
                }`}
              >
                <span
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ background: t.swatch }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Font */}
        <section>
          <p className="mb-2 text-sm text-muted">Phông chữ</p>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFont(f.id)}
                aria-pressed={font === f.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors duration-150 ${
                  font === f.id ? 'border-accent' : 'border-border'
                }`}
              >
                <span
                  className="text-lg"
                  style={{ fontFamily: FONT_STACKS[f.id] }}
                >
                  {f.sample}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted">
                  {f.label}
                  {font === f.id && (
                    <CheckIcon width={16} height={16} className="text-accent" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
