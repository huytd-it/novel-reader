import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchBookBySlug, fetchChapterList } from '@/lib/api';
import { fetchProgress } from '@/lib/progress';
import { useAuth } from '@/lib/auth';
import { useSeo } from '@/lib/seo';
import { SiteHeader } from '@/components/SiteHeader';
import { BookActions } from '@/components/book/BookActions';
import { Reviews } from '@/components/book/Reviews';
import { StarRating } from '@/components/book/StarRating';
import { Reveal } from '@/components/ui/Reveal';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { CheckIcon, LockIcon } from '@/components/ui/icons';

// Xoay vòng pastel cho tag thể loại để tạo nhịp màu nhẹ.
const GENRE_TONES = [
  'bg-pale-blue text-clay-blue',
  'bg-pale-green text-clay-green',
  'bg-pale-yellow text-clay-yellow',
  'bg-pale-red text-clay-red',
];

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

  const canonical =
    typeof window !== 'undefined' ? window.location.href : undefined;
  useSeo({
    title: book?.title,
    description:
      book?.description ??
      (book ? `Đọc truyện ${book.title}${book.author ? ` của ${book.author}` : ''}.` : undefined),
    image: book?.cover_url,
    type: 'book',
    canonical,
    jsonLd: book
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: book.title,
            ...(book.author && {
              author: { '@type': 'Person', name: book.author },
            }),
            ...(book.cover_url && { image: book.cover_url }),
            ...(book.description && { description: book.description }),
            ...(book.genre?.length && { genre: book.genre }),
            bookFormat: 'https://schema.org/EBook',
            inLanguage: 'vi',
            url: canonical,
            ...((book.rating_count ?? 0) > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: book.rating_avg,
                reviewCount: book.rating_count,
              },
            }),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Thư viện',
                item: window.location.origin + '/',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: book.title,
                item: canonical,
              },
            ],
          },
        ]
      : undefined,
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
        <div className="py-24 text-center text-ink-muted">
          <p>Không tìm thấy truyện này.</p>
          <Link
            to="/"
            className="mt-3 inline-block text-ink underline underline-offset-4"
          >
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
  // Truyện chữ đọc tuyến tính: chương trước vị trí hiện tại coi là đã đọc.
  const currentIndex = resumeChapter?.index;

  return (
    <Shell>
      <Reveal>
        <div className="mb-14 flex flex-col gap-8 sm:flex-row">
          <div className="mx-auto w-44 shrink-0 sm:mx-0">
            <div className="card-lift aspect-[3/4] overflow-hidden rounded-xl border border-hairline bg-surface">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={`Bìa ${book.title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center font-display text-lg leading-tight tracking-[-0.02em] text-ink-muted">
                  {book.title}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <h1 className="font-display text-3xl font-medium leading-[1.1] tracking-[-0.03em] text-ink-strong md:text-4xl">
              {book.title}
            </h1>
            {book.author && (
              <p className="mt-2 text-sm text-ink-muted">{book.author}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.05em] ${
                  book.status === 'completed'
                    ? 'bg-pale-green text-clay-green'
                    : 'bg-pale-blue text-clay-blue'
                }`}
              >
                {book.status === 'completed' ? 'Hoàn thành' : 'Đang ra'}
              </span>
              <span className="font-mono text-xs text-ink-muted">
                {book.chapter_count} chương
              </span>
              {(book.rating_count ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <StarRating value={book.rating_avg ?? 0} size={14} />
                  <span className="font-mono text-xs text-ink-muted">
                    {book.rating_avg?.toFixed(1)} ({book.rating_count})
                  </span>
                </span>
              )}
              {book.genre?.map((g, i) => (
                <span
                  key={g}
                  className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.05em] ${
                    GENRE_TONES[i % GENRE_TONES.length]
                  }`}
                >
                  {g}
                </span>
              ))}
            </div>

            {book.description && (
              <p className="mt-6 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink">
                {book.description}
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {resumeChapter ? (
                <Button
                  variant="solid"
                  onClick={() =>
                    navigate(`/doc/${book.slug}/${resumeChapter.index}`)
                  }
                >
                  Đọc tiếp — Chương {resumeChapter.index}
                </Button>
              ) : (
                chapters.length > 0 && (
                  <Button
                    variant="solid"
                    onClick={() => navigate(`/doc/${book.slug}/1`)}
                  >
                    Đọc từ đầu
                  </Button>
                )
              )}
              <BookActions bookId={book.id} />
            </div>
          </div>
        </div>
      </Reveal>

      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
            Mục lục
          </h2>
          <span className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
            {chapters.length} chương
          </span>
        </div>
        {chaptersQuery.isLoading && <Spinner label="Đang tải mục lục…" />}
        {chapters.length > 0 && (
          <ul>
            {chapters.map((c) => {
              const isRead =
                currentIndex !== undefined && c.index < currentIndex;
              const isCurrent = c.index === currentIndex;
              return (
              <li key={c.id} className="border-b border-hairline">
                <Link
                  to={`/doc/${book.slug}/${c.index}`}
                  className="flex items-center gap-4 py-3.5 transition-colors duration-150 hover:bg-surface"
                >
                  <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                    {c.index.toString().padStart(2, '0')}
                  </span>
                  <span
                    className={`flex-1 text-sm ${isRead ? 'text-ink-muted' : 'text-ink'}`}
                  >
                    {c.title}
                  </span>
                  {isRead && (
                    <CheckIcon
                      className="shrink-0 text-ink-muted"
                      width={15}
                      height={15}
                      aria-label="Đã đọc"
                    />
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-pale-blue px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-blue">
                      Đang đọc
                    </span>
                  )}
                  {c.is_free ? (
                    <span className="rounded-full bg-pale-green px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-green">
                      Miễn phí
                    </span>
                  ) : (
                    <LockIcon
                      className="shrink-0 text-ink-muted"
                      width={15}
                      height={15}
                    />
                  )}
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <Reviews
        bookId={book.id}
        bookSlug={book.slug}
        canReview={(currentIndex ?? 0) >= 3}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">{children}</main>
    </div>
  );
}
