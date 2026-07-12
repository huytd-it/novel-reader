import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@/components/ui/IconButton';
import { ArrowLeft, ListIcon, SettingsIcon } from '@/components/ui/icons';

interface ReaderToolbarProps {
  bookTitle: string;
  bookSlug: string;
  onOpenSettings: () => void;
}

/**
 * Toolbar auto-hide: ẩn khi cuộn xuống, hiện khi cuộn lên hoặc tap giữa màn hình.
 * Tap giữa được xử lý ở Reader (gọi `toggle` qua ref pattern) — ở đây ta chỉ
 * lắng nghe scroll. Reader truyền sự kiện tap qua custom event 'reader:tap'.
 */
export function ReaderToolbar({
  bookTitle,
  bookSlug,
  onOpenSettings,
}: ReaderToolbarProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      // Ngưỡng nhỏ để tránh giật khi cuộn nhẹ.
      if (Math.abs(delta) < 8) return;
      if (y < 80) {
        setVisible(true); // gần đầu trang: luôn hiện
      } else if (delta > 0) {
        setVisible(false); // cuộn xuống
      } else {
        setVisible(true); // cuộn lên
      }
      lastY.current = y;
    };

    const onTap = () => setVisible((v) => !v);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('reader:tap', onTap);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('reader:tap', onTap);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-30 border-b border-border bg-bg transition-transform duration-200 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-reader items-center gap-1 px-2">
        <IconButton label="Về trang truyện" onClick={() => navigate(`/truyen/${bookSlug}`)}>
          <ArrowLeft />
        </IconButton>
        <p className="flex-1 truncate px-2 font-sans text-sm text-muted">
          {bookTitle}
        </p>
        <IconButton
          label="Mục lục"
          onClick={() => navigate(`/truyen/${bookSlug}`)}
        >
          <ListIcon />
        </IconButton>
        <IconButton label="Cài đặt đọc" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
      </div>
    </div>
  );
}
