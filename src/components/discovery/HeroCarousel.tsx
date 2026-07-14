import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchFeaturedBooks } from '@/lib/discovery';
import { Reveal } from '@/components/ui/Reveal';

/**
 * Hàng truyện tuyển chọn dưới hero. Cuộn ngang có scroll-snap (swipe được
 * trên mobile). Không render gì nếu chưa có truyện nào được gắn tuyển chọn.
 */
export function HeroCarousel() {
  const { data: books } = useQuery({
    queryKey: ['featured-books'],
    queryFn: fetchFeaturedBooks,
  });

  if (!books || books.length === 0) return null;

  return (
    <Reveal className="mt-12">
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
        role="list"
        aria-label="Truyện tuyển chọn"
      >
        {books.map((book) => (
          <Link
            key={book.id}
            to={`/truyen/${book.slug}`}
            role="listitem"
            className="card-lift group relative flex h-44 w-[min(85vw,32rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-hairline bg-white"
          >
            <div className="w-28 shrink-0 overflow-hidden bg-canvas sm:w-32">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={`Bìa ${book.title}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center font-display text-sm text-ink-muted">
                  {book.title}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clay-yellow">
                Tuyển chọn
              </span>
              <h3 className="line-clamp-2 font-display text-xl font-medium leading-tight tracking-[-0.02em] text-ink-strong">
                {book.title}
              </h3>
              {book.author && (
                <p className="line-clamp-1 text-sm text-ink-muted">
                  {book.author}
                </p>
              )}
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                {book.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Reveal>
  );
}
