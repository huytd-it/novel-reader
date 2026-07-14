import { Link } from 'react-router-dom';
import type { Book } from '@/lib/types';
import { StarFilledIcon } from '@/components/ui/icons';

export function BookCard({ book }: { book: Book }) {
  return (
    <Link
      to={`/truyen/${book.slug}`}
      className="card-lift group flex h-full flex-col overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-canvas">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={`Bìa truyện ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-5 text-center font-display text-lg leading-tight tracking-[-0.02em] text-ink-muted">
            {book.title}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug text-ink-strong">
          {book.title}
        </h3>
        {book.author && (
          <p className="line-clamp-1 text-xs text-ink-muted">{book.author}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
            {book.chapter_count} chương
            {book.status === 'completed' ? ' · Hoàn thành' : ''}
          </p>
          {(book.rating_count ?? 0) > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[11px] text-ink-muted">
              <StarFilledIcon width={11} height={11} className="text-clay-yellow" />
              {book.rating_avg?.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
