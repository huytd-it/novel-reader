import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchFilteredBooks,
  fetchPublishedBooks,
  searchBooks,
  type BookSort,
} from '@/lib/api';
import { fetchCompletedBooks } from '@/lib/discovery';
import { useGenres } from '@/hooks/useGenres';
import { useSeo } from '@/lib/seo';
import { SiteHeader } from '@/components/SiteHeader';
import { BookCard } from '@/components/BookCard';
import { ContinueReading } from '@/components/shelf/ContinueReading';
import { AnnouncementBar } from '@/components/discovery/AnnouncementBar';
import { HeroCarousel } from '@/components/discovery/HeroCarousel';
import { RankingWidget } from '@/components/discovery/RankingWidget';
import { ContentModule } from '@/components/discovery/ContentModule';
import { Reveal } from '@/components/ui/Reveal';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';

const SEARCH_PAGE_SIZE = 24;
const MIN_CHAPTER_OPTIONS = [10, 50, 100, 300];

export default function Library() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const searching = q.trim().length > 0;

  // Facets từ URL (đồng bộ 2 chiều, SPA không reload).
  const selectedGenres = (searchParams.get('genre') ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  const status = searchParams.get('status') as 'ongoing' | 'completed' | null;
  const minChapters = Number(searchParams.get('minch')) || 0;
  const sort = (searchParams.get('sort') as BookSort | null) ?? null;

  const hasFilters =
    selectedGenres.length > 0 || !!status || minChapters > 0 || !!sort;
  const browsing = searching || hasFilters;

  const booksQuery = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchPublishedBooks(),
  });
  const books = booksQuery.data;

  const completedQuery = useQuery({
    queryKey: ['books-completed'],
    queryFn: () => fetchCompletedBooks(10),
    enabled: !browsing,
  });

  // Từ khóa → tìm server-side (RPC search_books, không phân biệt dấu), phân
  // trang bằng "Xem thêm".
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

  // Không có từ khóa nhưng có facet → lọc server-side.
  const filterQuery = useQuery({
    queryKey: ['filter', selectedGenres, status, minChapters, sort],
    queryFn: () =>
      fetchFilteredBooks({
        genres: selectedGenres,
        status: status ?? undefined,
        minChapters,
        sort: sort ?? undefined,
      }),
    enabled: browsing && !searching,
  });

  const isLoading = searching
    ? searchQuery.isLoading
    : browsing
      ? filterQuery.isLoading
      : booksQuery.isLoading;
  const isError = searching
    ? searchQuery.isError
    : browsing
      ? filterQuery.isError
      : booksQuery.isError;

  const { genres } = useGenres();

  useSeo({
    title: searching ? `Tìm: ${q}` : undefined,
    description:
      'Bộ sưu tập truyện chữ tiếng Việt chọn lọc, trình bày cho việc đọc dài. Đồng bộ tiến độ đọc trên mọi thiết bị.',
  });

  function updateParams(mut: (p: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        mut(params);
        return params;
      },
      { replace: true },
    );
  }

  function toggleGenre(g: string) {
    const next = selectedGenres.includes(g)
      ? selectedGenres.filter((x) => x !== g)
      : [...selectedGenres, g];
    updateParams((p) => {
      if (next.length) p.set('genre', next.join(','));
      else p.delete('genre');
    });
  }

  function setFacet(key: string, value: string | null) {
    updateParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });
  }

  function resetFilters() {
    updateParams((p) => {
      p.delete('genre');
      p.delete('status');
      p.delete('minch');
      p.delete('sort');
    });
  }

  const filtered = useMemo(() => {
    if (searching) {
      // Kết quả text đã khớp; áp thêm facet client-side để kết hợp.
      let results = searchQuery.data?.pages.flat() ?? [];
      if (selectedGenres.length)
        results = results.filter((b) =>
          b.genre?.some((g) => selectedGenres.includes(g)),
        );
      if (status) results = results.filter((b) => b.status === status);
      if (minChapters)
        results = results.filter((b) => b.chapter_count >= minChapters);
      return results;
    }
    if (browsing) return filterQuery.data ?? [];
    return [];
  }, [
    searching,
    browsing,
    searchQuery.data,
    filterQuery.data,
    selectedGenres,
    status,
    minChapters,
  ]);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <AnnouncementBar />
      <SiteHeader />

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden border-b border-hairline">
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
          {!browsing && <HeroCarousel />}
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* ---- Trang chủ thuần: kệ đọc tiếp + xếp hạng ---- */}
        {!browsing && (
          <>
            <ContinueReading />
            <RankingWidget />
          </>
        )}

        {/* ---- Bộ lọc đa tiêu chí + từ khóa đang áp dụng ---- */}
        {(genres.length > 0 || q) && (
          <Reveal className="mb-10">
            <div className="flex flex-wrap items-center gap-2">
              {genres.length > 0 && (
                <>
                  <GenreChip
                    active={selectedGenres.length === 0}
                    onClick={() => setFacet('genre', null)}
                  >
                    Tất cả
                  </GenreChip>
                  {genres.map((g) => (
                    <GenreChip
                      key={g}
                      active={selectedGenres.includes(g)}
                      onClick={() => toggleGenre(g)}
                    >
                      {g}
                    </GenreChip>
                  ))}
                </>
              )}
              {q && (
                <button
                  onClick={() => setFacet('q', null)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-strong bg-ink-strong px-3.5 py-1.5 text-xs uppercase tracking-[0.05em] text-white"
                >
                  Tìm: “{q}”
                  <CloseIcon width={13} height={13} />
                </button>
              )}
            </div>

            {/* Facet nâng cao */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <FacetSelect
                label="Tình trạng"
                value={status ?? ''}
                onChange={(v) => setFacet('status', v || null)}
                options={[
                  { value: '', label: 'Tất cả' },
                  { value: 'ongoing', label: 'Đang ra' },
                  { value: 'completed', label: 'Hoàn thành' },
                ]}
              />
              <FacetSelect
                label="Số chương"
                value={minChapters ? String(minChapters) : ''}
                onChange={(v) => setFacet('minch', v || null)}
                options={[
                  { value: '', label: 'Tất cả' },
                  ...MIN_CHAPTER_OPTIONS.map((n) => ({
                    value: String(n),
                    label: `≥ ${n}`,
                  })),
                ]}
              />
              <FacetSelect
                label="Sắp xếp"
                value={sort ?? 'moi'}
                onChange={(v) => setFacet('sort', v === 'moi' ? null : v)}
                options={[
                  { value: 'moi', label: 'Mới nhất' },
                  { value: 'danhgia', label: 'Đánh giá' },
                  { value: 'chuong', label: 'Số chương' },
                ]}
              />
              {hasFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.05em] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  <CloseIcon width={13} height={13} />
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          </Reveal>
        )}

        {/* ---- Chế độ duyệt: lưới kết quả ---- */}
        {browsing && (
          <>
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
                  : 'Không có truyện nào khớp bộ lọc.'}
              </p>
            )}

            {filtered.length > 0 && (
              <>
                <p className="mb-6 font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
                  {filtered.length} {searching ? `kết quả cho “${q}”` : 'truyện'}
                </p>
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
          </>
        )}

        {/* ---- Trang chủ thuần: các module nội dung ---- */}
        {!browsing && (
          <>
            <ContentModule
              title="Mới nhất"
              books={books}
              isLoading={booksQuery.isLoading}
              emptyText="Chưa có truyện nào."
            />
            <ContentModule
              title="Đã hoàn thành"
              books={completedQuery.data}
              isLoading={completedQuery.isLoading}
            />
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

function FacetSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
      <span className="uppercase tracking-[0.05em]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
