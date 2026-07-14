import type { ReactNode } from 'react';
import { Reveal } from '@/components/ui/Reveal';
import { BookCard } from '@/components/BookCard';
import type { Book } from '@/lib/types';

/**
 * Module nội dung trên trang chủ (Mới nhất / Hoàn thành…). Heading H2 tách
 * bạch từng khối; hiện skeleton khi đang tải để tránh nhảy layout (CLS).
 */
export function ContentModule({
  title,
  books,
  isLoading,
  action,
  emptyText,
}: {
  title: string;
  books: Book[] | undefined;
  isLoading?: boolean;
  action?: ReactNode;
  emptyText?: string;
}) {
  const showEmpty = !isLoading && (!books || books.length === 0);
  if (showEmpty && !emptyText) return null;

  return (
    <Reveal className="mb-14">
      <div className="mb-5 flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
          {title}
        </h2>
        {action}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : showEmpty ? (
        <p className="py-6 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books!.map((book, i) => (
            <Reveal key={book.id} delay={Math.min(i, 9) * 60} className="h-full">
              <BookCard book={book} />
            </Reveal>
          ))}
        </div>
      )}
    </Reveal>
  );
}

/** Skeleton giữ đúng tỉ lệ card để không gây dịch chuyển layout. */
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-white">
      <div className="aspect-[3/4] w-full animate-pulse bg-hairline/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-hairline/60" />
        <div className="h-3 w-2/5 animate-pulse rounded bg-hairline/60" />
      </div>
    </div>
  );
}
