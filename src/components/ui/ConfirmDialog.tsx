import { useEffect } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Dialog xác nhận — cùng cấu trúc backdrop + Escape-to-close với SettingsSheet. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Xác nhận',
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button
        className="absolute inset-0 bg-black/30"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-hairline bg-white p-5 shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[360px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <h2 className="font-display text-base font-medium text-ink-strong">{title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{body}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="hairline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant="solid"
            className={danger ? 'bg-clay-red hover:bg-clay-red/90' : undefined}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
