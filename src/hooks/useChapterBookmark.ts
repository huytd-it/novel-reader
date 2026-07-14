import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  addBookmark,
  fetchBookmarkForChapter,
  removeBookmark,
} from '@/lib/bookmarks';
import type { Bookmark } from '@/lib/types';

/**
 * Trạng thái + toggle bookmark cho chương đang đọc.
 * Chỉ hoạt động khi đã đăng nhập và đã biết chapter_id (chapterList tải xong).
 */
export function useChapterBookmark(chapterId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && !!chapterId;
  const queryKey = ['bookmark', chapterId, user?.id];

  const { data: bookmark } = useQuery({
    queryKey,
    queryFn: () => fetchBookmarkForChapter(chapterId!),
    enabled,
  });

  const toggleMutation = useMutation({
    mutationFn: async (): Promise<Bookmark | null> => {
      if (bookmark) {
        await removeBookmark(bookmark.id);
        return null;
      }
      return addBookmark(chapterId!);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({
        queryKey: ['bookmarks', user?.id],
      });
    },
  });

  return {
    enabled,
    bookmarked: !!bookmark,
    toggle: () => {
      if (enabled && !toggleMutation.isPending) toggleMutation.mutate();
    },
  };
}
