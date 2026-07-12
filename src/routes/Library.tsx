import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublishedBooks } from '@/lib/api';
import { SiteHeader } from '@/components/SiteHeader';
import { BookCard } from '@/components/BookCard';
import { Spinner } from '@/components/ui/Spinner';

export default function Library() {
  const [genre, setGenre] = useState<string | null>(null);

  const { data: books, isLoading, isError } = useQuery({
    queryKey: ['books'],
    queryFn: () => fetchPublishedBooks(),
  });

  // Danh sách genre suy ra từ dữ liệu (không cần bảng riêng cho v1).
  const genres = useMemo(() => {
    const set = new Set<string>();
    books?.forEach((b) => b.genre?.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [books]);

  const filtered = useMemo(() => {
    if (!books) return [];
    if (!genre) return books;
    return books.filter((b) => b.genre?.includes(genre));
  }, [books, genre]);

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-6">
        <h1 className="mb-1 font-serif text-2xl font-medium">Thư viện</h1>
        <p className="mb-5 text-sm text-muted">
          Chọn một truyện để bắt đầu đọc.
        </p>

        {genres.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
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
          </div>
        )}

        {isLoading && <Spinner label="Đang tải thư viện…" />}
        {isError && (
          <p className="py-16 text-center text-muted">
            Không tải được danh sách truyện. Thử lại sau nhé.
          </p>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="py-16 text-center text-muted">Chưa có truyện nào.</p>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((book) => (
              <BookCard key={book.id} book={book} />
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
      className={`rounded-full border px-3 py-1 text-sm transition-colors duration-150 ${
        active
          ? 'border-accent bg-accent text-[var(--bg)]'
          : 'border-border text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
