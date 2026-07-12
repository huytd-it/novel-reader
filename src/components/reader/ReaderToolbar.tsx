import { useNavigate } from 'react-router-dom';
import { IconButton } from '@/components/ui/IconButton';
import { ArrowLeft, ListIcon, SettingsIcon } from '@/components/ui/icons';

interface ReaderToolbarProps {
  bookTitle: string;
  bookSlug: string;
  visible: boolean;
  onOpenSettings: () => void;
}

/**
 * Thanh công cụ trên — thuần trình bày. Trạng thái ẩn/hiện do Reader
 * quản lý qua `useReaderChrome` (đồng bộ với thanh điều hướng dưới).
 */
export function ReaderToolbar({
  bookTitle,
  bookSlug,
  visible,
  onOpenSettings,
}: ReaderToolbarProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`fixed inset-x-0 top-0 z-30 border-b border-border bg-bg transition-transform duration-200 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-reader items-center gap-1 px-2">
        <IconButton
          label="Về trang truyện"
          onClick={() => navigate(`/truyen/${bookSlug}`)}
        >
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
