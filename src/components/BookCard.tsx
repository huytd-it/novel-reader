import { Link } from 'react-router-dom';
import type { Book } from '@/lib/types';

export function BookCard({ book }: { book: Book }) {
  return (
    <Link
      to={`/truyen/${book.slug}`}
      className="card-lift group flex h-full flex-col overflow-hidden rounded-xl border border-hairline bg-white"
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
        <p className="mt-auto pt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">
          {book.chapter_count} chương
          {book.status === 'completed' ? ' · Hoàn thành' : ''}
        </p>
      </div>
    </Link>
  );
}
