import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { followBook, isFollowing, unfollowBook } from '@/lib/follows';
import {
  fetchBookListStatus,
  removeFromBookList,
  setBookListStatus,
} from '@/lib/bookshelf';
import type { BookListStatus } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { NavPopover } from '@/components/nav/NavPopover';
import { CheckIcon, ChevronDownIcon } from '@/components/ui/icons';

const SHELVES: { value: BookListStatus; label: string }[] = [
  { value: 'reading', label: 'Đang đọc' },
  { value: 'want', label: 'Muốn đọc' },
  { value: 'read', label: 'Đã đọc' },
];

/** Nút Theo dõi + chọn tủ sách trên trang truyện. Chỉ hiện khi đã đăng nhập. */
export function BookActions({ bookId }: { bookId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const following = useQuery({
    queryKey: ['following', bookId, user?.id],
    queryFn: () => isFollowing(bookId),
    enabled: !!user,
  });

  const shelf = useQuery({
    queryKey: ['book-list', bookId, user?.id],
    queryFn: () => fetchBookListStatus(bookId),
    enabled: !!user,
  });

  const toggleFollow = useMutation({
    mutationFn: () =>
      following.data ? unfollowBook(bookId) : followBook(bookId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['following', bookId, user?.id] }),
  });

  const setShelf = useMutation({
    mutationFn: (status: BookListStatus | null) =>
      status ? setBookListStatus(bookId, status) : removeFromBookList(bookId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['book-list', bookId, user?.id],
      });
      SHELVES.forEach((s) =>
        queryClient.invalidateQueries({ queryKey: ['my-book-list', s.value, user?.id] }),
      );
    },
  });

  if (!user) return null;

  const current = shelf.data;
  const currentLabel = SHELVES.find((s) => s.value === current)?.label;

  return (
    <>
      <Button
        variant={following.data ? 'solid' : 'hairline'}
        disabled={toggleFollow.isPending}
        onClick={() => toggleFollow.mutate()}
      >
        {following.data ? 'Đang theo dõi' : 'Theo dõi'}
      </Button>

      <NavPopover
        align="left"
        triggerClassName="inline-flex items-center justify-center gap-2 rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
        trigger={() => (
          <>
            {currentLabel ?? 'Thêm vào tủ'}
            <ChevronDownIcon width={15} height={15} />
          </>
        )}
      >
        {SHELVES.map((s) => (
          <button
            key={s.value}
            onClick={() => setShelf.mutate(s.value)}
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-canvas"
          >
            {s.label}
            {current === s.value && (
              <CheckIcon width={15} height={15} className="text-clay-green" />
            )}
          </button>
        ))}
        {current && (
          <>
            <div className="my-1 border-t border-hairline" />
            <button
              onClick={() => setShelf.mutate(null)}
              className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-clay-red transition-colors hover:bg-canvas"
            >
              Bỏ khỏi tủ
            </button>
          </>
        )}
      </NavPopover>
    </>
  );
}
