import { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { SearchIcon } from '@/components/ui/icons';
import { SearchCommand } from './SearchCommand';

/**
 * Nút mở bảng lệnh tìm kiếm. Phím tắt toàn cục: `/` hoặc Ctrl/⌘+K
 * (bỏ qua khi đang gõ trong input/textarea).
 */
export function SearchBox() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing =
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable;

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <IconButton label="Tìm truyện (phím /)" onClick={() => setOpen(true)}>
        <SearchIcon width={18} height={18} />
      </IconButton>
      {open && <SearchCommand onClose={() => setOpen(false)} />}
    </>
  );
}
