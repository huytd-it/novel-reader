import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { fetchFeaturedBooks } from '@/lib/discovery';
import { Reveal } from '@/components/ui/Reveal';

const INTERVAL = 4000;

export function HeroCarousel() {
  const { data: books } = useQuery({
    queryKey: ['featured-books'],
    queryFn: fetchFeaturedBooks,
  });

  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const count = books?.length ?? 0;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setActive((prev) => (prev + 1) % count);
      }
    }, INTERVAL);
    return () => clearInterval(id);
  }, [count]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !books) return;
    const card = track.children[active] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
  }, [active, books]);

  if (!books || books.length === 0) return null;

  return (
    <Reveal className="mt-10">
      <div
        ref={trackRef}
        role="list"
        aria-label="Truyện tuyển chọn"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
        onTouchStart={() => { pausedRef.current = true; }}
        onTouchEnd={() => { pausedRef.current = false; }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto sm:gap-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {books.map((book, i) => (
          <Link
            key={book.id}
            to={`/truyen/${book.slug}`}
            role="listitem"
            onClick={() => setActive(i)}
            className="card-lift group relative flex h-64 w-[min(72vw,22rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-hairline bg-surface sm:h-72 sm:w-[min(60vw,24rem)]"
          >
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={`Bìa ${book.title}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center font-display text-base text-ink-muted">
                {book.title}
              </div>
            )}

            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 50%, transparent 80%)',
              }}
            />

            <div className="relative mt-auto flex flex-col gap-1.5 p-4 sm:p-5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">
                Tuyển chọn
              </span>
              <h3 className="line-clamp-2 font-display text-base font-medium leading-snug tracking-[-0.02em] text-white sm:text-lg">
                {book.title}
              </h3>
              {book.author && (
                <p className="line-clamp-1 text-xs text-white/60">
                  {book.author}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {books.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === active
                  ? 'w-5 bg-ink'
                  : 'w-1.5 bg-ink-muted opacity-40'
              }`}
            />
          ))}
        </div>
      )}
    </Reveal>
  );
}
