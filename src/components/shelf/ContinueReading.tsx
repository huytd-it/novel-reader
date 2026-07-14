import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchMyShelf } from '@/lib/progress';
import type { ShelfItem } from '@/lib/types';
import { Reveal } from '@/components/ui/Reveal';

/**
 * Kệ "Đọc tiếp" trên trang chủ: các truyện có tiến độ, mới đọc trước.
 * Chưa đăng nhập / kệ rỗng → không render gì (trang chủ giữ nguyên).
 */
export function ContinueReading() {
  const { user } = useAuth();

  const { data: shelf } = useQuery({
    queryKey: ['shelf', user?.id],
    queryFn: fetchMyShelf,
    enabled: !!user,
  });

  if (!shelf || shelf.length === 0) return null;

  return (
    <Reveal className="mb-14">
      <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
          Đọc tiếp
        </h2>
        <Link
          to="/tai-khoan"
          className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted transition-colors hover:text-ink"
        >
          Xem tất cả
        </Link>
      </div>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {shelf.slice(0, 10).map((item) => (
          <ShelfCard key={item.book_id} item={item} />
        ))}
      </div>
    </Reveal>
  );
}

function ShelfCard({ item }: { item: ShelfItem }) {
  const book = item.book!;
  const chapterIndex = item.chapter?.index ?? 1;
  return (
    <Link
      to={`/doc/${book.slug}/${chapterIndex}`}
      className="card-lift w-36 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface"
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
          <div className="flex h-full w-full items-center justify-center p-4 text-center font-display text-base leading-tight tracking-[-0.02em] text-ink-muted">
            {book.title}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 font-sans text-sm font-medium leading-snug text-ink-strong">
          {book.title}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-ink-muted">
          Chương {chapterIndex}/{book.chapter_count} ·{' '}
          {Math.round(item.scroll_pct * 100)}%
        </p>
      </div>
    </Link>
  );
}
