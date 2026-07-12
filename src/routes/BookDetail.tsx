import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchBookBySlug, fetchChapterList } from '@/lib/api';
import { fetchProgress } from '@/lib/progress';
import { useAuth } from '@/lib/auth';
import { SiteHeader } from '@/components/SiteHeader';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { LockIcon } from '@/components/ui/icons';

export default function BookDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const bookQuery = useQuery({
    queryKey: ['book', slug],
    queryFn: () => fetchBookBySlug(slug),
    enabled: !!slug,
  });
  const book = bookQuery.data;

  const chaptersQuery = useQuery({
    queryKey: ['chapters', book?.id],
    queryFn: () => fetchChapterList(book!.id),
    enabled: !!book?.id,
  });

  const progressQuery = useQuery({
    queryKey: ['progress', book?.id, user?.id],
    queryFn: () => fetchProgress(book!.id),
    enabled: !!book?.id && !!user,
  });

  if (bookQuery.isLoading) {
    return (
      <Shell>
        <Spinner label="Đang tải truyện…" />
      </Shell>
    );
  }

  if (bookQuery.isError || !book) {
    return (
      <Shell>
        <div className="py-16 text-center text-muted">
          <p>Không tìm thấy truyện này.</p>
          <Link to="/" className="mt-3 inline-block text-accent underline">
            Về thư viện
          </Link>
        </div>
      </Shell>
    );
  }

  const chapters = chaptersQuery.data ?? [];
  const progress = progressQuery.data;
  const resumeChapter = progress
    ? chapters.find((c) => c.id === progress.chapter_id)
    : undefined;

  return (
    <Shell>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row">
        <div className="mx-auto w-40 shrink-0 sm:mx-0">
          <div className="aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={`Bìa ${book.title}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center font-serif text-muted">
                {book.title}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h1 className="font-serif text-2xl font-medium">{book.title}</h1>
          {book.author && (
            <p className="mt-1 text-sm text-muted">{book.author}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            <span>
              {book.chapter_count} chương ·{' '}
              {book.status === 'completed' ? 'Hoàn thành' : 'Đang ra'}
            </span>
            {book.genre?.map((g) => (
              <span
                key={g}
                className="rounded-full border border-border px-2 py-0.5"
              >
                {g}
              </span>
            ))}
          </div>

          {book.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text/90">
              {book.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {resumeChapter ? (
              <Button
                onClick={() =>
                  navigate(`/doc/${book.slug}/${resumeChapter.index}`)
                }
              >
                Đọc tiếp — Chương {resumeChapter.index}
              </Button>
            ) : (
              chapters.length > 0 && (
                <Button
                  onClick={() => navigate(`/doc/${book.slug}/1`)}
                >
                  Đọc từ đầu
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">Mục lục</h2>
        {chaptersQuery.isLoading && <Spinner label="Đang tải mục lục…" />}
        {chapters.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {chapters.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/doc/${book.slug}/${c.index}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface"
                >
                  <span className="w-10 shrink-0 text-xs tabular-nums text-muted">
                    {c.index}
                  </span>
                  <span className="flex-1 text-sm">{c.title}</span>
                  {!c.is_free && (
                    <LockIcon
                      className="shrink-0 text-muted"
                      width={16}
                      height={16}
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-6">{children}</main>
    </div>
  );
}
