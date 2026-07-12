import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { useScrollProgress } from '@/hooks/useScrollProgress';

interface ReaderBottomBarProps {
  bookSlug: string;
  index: number;
  totalChapters: number | null;
  prevIndex: number | null;
  nextIndex: number | null;
  visible: boolean;
}

/**
 * Thanh điều hướng dưới: chương trước / vị trí hiện tại / chương sau.
 * Ẩn-hiện cùng nhịp với toolbar trên (useReaderChrome).
 */
export function ReaderBottomBar({
  bookSlug,
  index,
  totalChapters,
  prevIndex,
  nextIndex,
  visible,
}: ReaderBottomBarProps) {
  const pct = useScrollProgress();

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex h-12 max-w-reader items-center justify-between px-2">
        <NavLink
          to={prevIndex !== null ? `/doc/${bookSlug}/${prevIndex}` : null}
          label="Chương trước"
        >
          <ChevronLeft />
        </NavLink>

        <p className="font-sans text-xs tabular-nums text-muted">
          Chương {index}
          {totalChapters ? ` / ${totalChapters}` : ''}
          <span className="mx-1.5 opacity-50">·</span>
          {Math.round(pct * 100)}%
        </p>

        <NavLink
          to={nextIndex !== null ? `/doc/${bookSlug}/${nextIndex}` : null}
          label="Chương sau"
        >
          <ChevronRight />
        </NavLink>
      </div>
    </div>
  );
}

function NavLink({
  to,
  label,
  children,
}: {
  to: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    'inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150';
  if (to === null) {
    return (
      <span className={`${cls} text-muted opacity-30`} aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} aria-label={label} title={label} className={`${cls} text-text hover:bg-surface`}>
      {children}
    </Link>
  );
}
