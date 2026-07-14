import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchMyProfile } from '@/lib/profile';
import {
  deleteReview,
  fetchBookReviews,
  fetchMyReview,
  upsertReview,
} from '@/lib/reviews';
import type { Review } from '@/lib/types';
import { StarRating } from './StarRating';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Khối đánh giá trên trang truyện. `canReview` = user đã đọc >= 3 chương
 * (BookDetail suy từ tiến độ). Server vẫn là nguồn chân lý (RLS 0009).
 */
export function Reviews({
  bookId,
  bookSlug,
  canReview,
}: {
  bookId: string;
  bookSlug: string;
  canReview: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const reviewsQuery = useQuery({
    queryKey: ['reviews', bookId],
    queryFn: () => fetchBookReviews(bookId),
  });

  const myReviewQuery = useQuery({
    queryKey: ['my-review', bookId, user?.id],
    queryFn: () => fetchMyReview(bookId),
    enabled: !!user,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['reviews', bookId] });
    void queryClient.invalidateQueries({ queryKey: ['my-review', bookId, user?.id] });
    // Điểm tổng hợp trên card/detail đổi theo.
    void queryClient.invalidateQueries({ queryKey: ['book', bookSlug] });
    void queryClient.invalidateQueries({ queryKey: ['books'] });
  };

  const reviews = reviewsQuery.data ?? [];

  return (
    <section className="mt-14">
      <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
          Đánh giá
        </h2>
        <span className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
          {reviews.length} lượt
        </span>
      </div>

      {user && (
        <ReviewForm
          bookId={bookId}
          canReview={canReview}
          existing={myReviewQuery.data ?? null}
          onDone={invalidate}
        />
      )}
      {!user && (
        <p className="mb-8 text-sm text-ink-muted">
          <Link
            to={`/dang-nhap?next=/truyen/${bookSlug}`}
            className="text-ink underline underline-offset-2"
          >
            Đăng nhập
          </Link>{' '}
          để viết đánh giá.
        </p>
      )}

      {reviewsQuery.isLoading && <Spinner label="Đang tải đánh giá…" />}
      {reviews.length === 0 && !reviewsQuery.isLoading && (
        <p className="py-6 text-sm text-ink-muted">
          Chưa có đánh giá nào. Hãy là người đầu tiên.
        </p>
      )}
      <ul className="flex flex-col gap-6">
        {reviews.map((r) => (
          <ReviewRow key={r.id} review={r} isMine={r.user_id === user?.id} />
        ))}
      </ul>
    </section>
  );
}

function ReviewForm({
  bookId,
  canReview,
  existing,
  onDone,
}: {
  bookId: string;
  canReview: boolean;
  existing: Review | null;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setBody(existing.body ?? '');
    }
  }, [existing]);

  const submit = useMutation({
    mutationFn: () =>
      upsertReview(bookId, rating, body, profile?.display_name ?? null),
    onSuccess: () => {
      setError(null);
      onDone();
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Có lỗi khi gửi đánh giá.');
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteReview(bookId),
    onSuccess: () => {
      setRating(0);
      setBody('');
      onDone();
    },
  });

  if (!canReview && !existing) {
    return (
      <p className="mb-8 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm text-ink-muted">
        Cần đọc ít nhất 3 chương để đánh giá truyện này.
      </p>
    );
  }

  return (
    <div className="mb-10 rounded-xl border border-hairline bg-surface p-5">
      <p className="mb-3 text-sm font-medium text-ink-strong">
        {existing ? 'Đánh giá của bạn' : 'Viết đánh giá'}
      </p>
      <StarRating value={rating} onChange={setRating} size={24} />
      <textarea
        value={body}
        maxLength={2000}
        rows={3}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Cảm nhận của bạn (không bắt buộc)…"
        className="mt-3 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="solid"
          disabled={rating < 1 || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? 'Đang gửi…' : existing ? 'Cập nhật' : 'Gửi đánh giá'}
        </Button>
        {existing && (
          <Button
            variant="hairline"
            className="text-clay-red"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Xoá
          </Button>
        )}
        {error && <span className="text-sm text-clay-red">{error}</span>}
      </div>
    </div>
  );
}

function ReviewRow({ review, isMine }: { review: Review; isMine: boolean }) {
  return (
    <li className="border-b border-hairline pb-6 last:border-0">
      <div className="flex items-center gap-3">
        <StarRating value={review.rating} size={15} />
        <span className="text-sm font-medium text-ink-strong">
          {review.author_name ?? 'Ẩn danh'}
          {isMine && <span className="ml-1 text-ink-muted">(bạn)</span>}
        </span>
        <span className="rounded-full bg-pale-green px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-green">
          Đã đọc
        </span>
        <span className="ml-auto font-mono text-xs text-ink-muted">
          {new Date(review.created_at).toLocaleDateString('vi-VN')}
        </span>
      </div>
      {review.body && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
          {review.body}
        </p>
      )}
    </li>
  );
}
