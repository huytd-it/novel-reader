import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchPublishedBooks, searchBooks } from '@/lib/api';
import { useGenres } from '@/hooks/useGenres';
import { SiteHeader } from '@/components/SiteHeader';
import { BookCard } from '@/components/BookCard';
import { ContinueReading } from '@/components/shelf/ContinueReading';
import { Reveal } from '@/components/ui/Reveal';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';

const SEARCH_PAGE_SIZE = 24;

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const genre = searchParams.get('genre');
  const q = searchParams.get('q') ?? '';
  const searching = q.trim().length > 0;

  const booksQuery = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchPublishedBooks(),
  });
  const books = booksQuery.data;

  // Có từ khóa → tìm server-side (RPC search_books, không phân biệt dấu),
  // phân trang bằng nút "Xem thêm". Không từ khóa → giữ đường cũ (['books']).
  const searchQuery = useInfiniteQuery({
    queryKey: ['search', q.trim()],
    queryFn: ({ pageParam }) =>
      searchBooks(q.trim(), SEARCH_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === SEARCH_PAGE_SIZE
        ? allPages.length * SEARCH_PAGE_SIZE
        : undefined,
    enabled: searching,
    placeholderData: (prev) => prev,
  });

  const isLoading = searching
    ? searchQuery.isLoading
    : booksQuery.isLoading;
  const isError = searching ? searchQuery.isError : booksQuery.isError;

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
    // Kết quả server đã khớp từ khóa; genre vẫn lọc client-side.
    if (searching) {
      const results = searchQuery.data?.pages.flat() ?? [];
      return genre ? results.filter((b) => b.genre?.includes(genre)) : results;
    }
    if (!books) return [];
    return books.filter((b) => !genre || b.genre?.includes(genre));
  }, [searching, searchQuery.data, books, genre]);

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
        {/* ---- Kệ "Đọc tiếp" — chỉ ở trang chủ thuần, không kèm lọc ---- */}
        {!searching && !genre && <ContinueReading />}

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
          <p className="py-16 text-center text-ink-muted">
            {searching
              ? `Không tìm thấy truyện nào cho “${q}”.`
              : 'Chưa có truyện nào.'}
          </p>
        )}

        {filtered.length > 0 && (
          <>
            {searching && (
              <p className="mb-6 font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
                {filtered.length} kết quả cho “{q}”
              </p>
            )}
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
            {searching && searchQuery.hasNextPage && (
              <div className="mt-10 text-center">
                <Button
                  variant="hairline"
                  disabled={searchQuery.isFetchingNextPage}
                  onClick={() => void searchQuery.fetchNextPage()}
                >
                  {searchQuery.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
                </Button>
              </div>
            )}
          </>
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
