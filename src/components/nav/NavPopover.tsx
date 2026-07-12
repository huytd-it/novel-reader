import { useEffect, useRef, useState, type ReactNode } from 'react';

interface NavPopoverProps {
  trigger: (open: boolean) => ReactNode;
  triggerClassName?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}

/**
 * Dropdown neo cạnh nút bấm cho header (khác SettingsSheet — không cần
 * backdrop toàn màn hình cho một menu nhỏ). Đóng khi click ra ngoài hoặc Esc.
 */
export function NavPopover({
  trigger,
  triggerClassName = '',
  align = 'right',
  children,
}: NavPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={`absolute top-full z-30 mt-2 min-w-[180px] rounded-lg border border-hairline bg-white p-1.5 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
