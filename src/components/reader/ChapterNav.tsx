import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListIcon } from '@/components/ui/icons';

interface ChapterNavProps {
  bookSlug: string;
  prevIndex: number | null;
  nextIndex: number | null;
  nextTitle?: string;
}

/**
 * Khối kết chương: ornament nhỏ + nút "Chương sau" nổi bật (kèm tên chương
 * nếu có) + hàng phụ Chương trước / Mục lục.
 */
export function ChapterNav({
  bookSlug,
  prevIndex,
  nextIndex,
  nextTitle,
}: ChapterNavProps) {
  return (
    <nav className="mx-auto max-w-reader px-5 pb-24 sm:px-0">
      <div
        className="mb-10 flex items-center justify-center gap-3 text-muted"
        aria-hidden
      >
        <span className="h-px w-8 bg-border" />
        <span className="text-xs tracking-[0.4em]">···</span>
        <span className="h-px w-8 bg-border" />
      </div>

      {nextIndex !== null ? (
        <Link
          to={`/doc/${bookSlug}/${nextIndex}`}
          className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 transition-colors duration-150 hover:border-accent"
        >
          <span className="min-w-0">
            <span className="block font-sans text-xs uppercase tracking-wide text-muted">
              Chương sau
            </span>
            <span className="mt-0.5 block truncate font-serif text-base font-medium">
              {nextTitle ?? `Chương ${nextIndex}`}
            </span>
          </span>
          <ChevronRight className="shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
        </Link>
      ) : (
        <div className="rounded-xl border border-border px-5 py-4 text-center">
          <p className="font-sans text-sm text-muted">
            Bạn đã đọc đến chương mới nhất.
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        {prevIndex !== null ? (
          <Link
            to={`/doc/${bookSlug}/${prevIndex}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 font-sans text-sm text-muted transition-colors duration-150 hover:text-text"
          >
            <ChevronLeft width={16} height={16} />
            Chương trước
          </Link>
        ) : (
          <span />
        )}

        <Link
          to={`/truyen/${bookSlug}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 font-sans text-sm text-muted transition-colors duration-150 hover:text-text"
        >
          <ListIcon width={16} height={16} />
          Mục lục
        </Link>
      </div>
    </nav>
  );
}
