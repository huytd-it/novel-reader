import { Link } from 'react-router-dom';
import type { Book } from '@/lib/types';

export function BookCard({ book }: { book: Book }) {
  return (
    <Link
      to={`/truyen/${book.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-150 hover:border-accent"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-bg">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={`Bìa truyện ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center font-serif text-lg text-muted">
            {book.title}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug">
          {book.title}
        </h3>
        {book.author && (
          <p className="line-clamp-1 text-xs text-muted">{book.author}</p>
        )}
        <p className="mt-auto pt-1 text-xs text-muted">
          {book.chapter_count} chương
          {book.status === 'completed' ? ' · Hoàn thành' : ''}
        </p>
      </div>
    </Link>
  );
}
