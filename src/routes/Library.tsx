import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPublishedBooks } from '@/lib/api';
import { useGenres } from '@/hooks/useGenres';
import { stripDiacritics } from '@/lib/text';
import { SiteHeader } from '@/components/SiteHeader';
import { BookCard } from '@/components/BookCard';
import { Reveal } from '@/components/ui/Reveal';
import { Spinner } from '@/components/ui/Spinner';
import { CloseIcon } from '@/components/ui/icons';

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const genre = searchParams.get('genre');
  const q = searchParams.get('q') ?? '';

  const { data: books, isLoading, isError } = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchPublishedBooks(),
  });

  const { genres } = useGenres();

  function setGenre(next: string | null) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set('genre', next);
        else params.delete('genre');
        return params;
      },
      { replace: true },
    );
  }

  function clearSearch() {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('q');
        return params;
      },
      { replace: true },
    );
  }

  const filtered = useMemo(() => {
    if (!books) return [];
    const nq = stripDiacritics(q.trim());
    return books.filter((b) => {
      if (genre && !b.genre?.includes(genre)) return false;
      if (!nq) return true;
      const haystack = stripDiacritics(`${b.title} ${b.author ?? ''}`);
      return haystack.includes(nq);
    });
  }, [books, genre, q]);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden border-b border-hairline">
        {/* Ánh sáng radial ấm, cực nhạt — tạo chiều sâu, không phá phẳng lặng */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 0%, rgba(149,100,0,0.05), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-24 md:py-28">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              Thư viện · Truyện chữ tiếng Việt
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.08] tracking-[-0.03em] text-ink-strong md:text-6xl">
              Đọc truyện, không có gì làm phiền.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted">
              Bộ sưu tập truyện chữ chọn lọc, trình bày cho việc đọc dài.
              Chọn một truyện để bắt đầu — vị trí đọc của bạn được nhớ trên mọi
              thiết bị.
            </p>
          </Reveal>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* ---- Bộ lọc thể loại + tìm kiếm đang áp dụng ---- */}
        {(genres.length > 0 || q) && (
          <Reveal className="mb-10">
            <div className="flex flex-wrap items-center gap-2">
              {genres.length > 0 && (
                <>
                  <GenreChip active={genre === null} onClick={() => setGenre(null)}>
                    Tất cả
                  </GenreChip>
                  {genres.map((g) => (
                    <GenreChip
                      key={g}
                      active={genre === g}
                      onClick={() => setGenre(g)}
                    >
                      {g}
                    </GenreChip>
                  ))}
                </>
              )}
              {q && (
                <button
                  onClick={clearSearch}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-strong bg-ink-strong px-3.5 py-1.5 text-xs uppercase tracking-[0.05em] text-white"
                >
                  Tìm: “{q}”
                  <CloseIcon width={13} height={13} />
                </button>
              )}
            </div>
          </Reveal>
        )}

        {isLoading && <Spinner label="Đang tải thư viện…" />}
        {isError && (
          <p className="py-16 text-center text-ink-muted">
            Không tải được danh sách truyện. Thử lại sau nhé.
          </p>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="py-16 text-center text-ink-muted">Chưa có truyện nào.</p>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((book, i) => (
              <Reveal
                key={book.id}
                delay={Math.min(i, 9) * 70}
                className="h-full"
              >
                <BookCard book={book} />
              </Reveal>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function GenreChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.05em] transition-colors duration-150 ${
        active
          ? 'border-ink-strong bg-ink-strong text-white'
          : 'border-hairline text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
