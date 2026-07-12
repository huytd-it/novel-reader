import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListIcon } from '@/components/ui/icons';

interface ChapterNavProps {
  bookSlug: string;
  prevIndex: number | null;
  nextIndex: number | null;
}

/** Prev / Mục lục / Next ở cuối chương. */
export function ChapterNav({ bookSlug, prevIndex, nextIndex }: ChapterNavProps) {
  return (
    <nav className="mx-auto flex max-w-reader items-center justify-between gap-3 px-5 pb-16 sm:px-0">
      {prevIndex !== null ? (
        <Link
          to={`/doc/${bookSlug}/${prevIndex}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-surface"
        >
          <ChevronLeft width={18} height={18} />
          Chương trước
        </Link>
      ) : (
        <span />
      )}

      <Link
        to={`/truyen/${bookSlug}`}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 hover:text-text"
        aria-label="Mục lục"
      >
        <ListIcon width={18} height={18} />
      </Link>

      {nextIndex !== null ? (
        <Link
          to={`/doc/${bookSlug}/${nextIndex}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors duration-150 hover:bg-surface"
        >
          Chương sau
          <ChevronRight width={18} height={18} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
