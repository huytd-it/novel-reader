import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchChapter, fetchBookBySlug, fetchChapterList, ApiError } from '@/lib/api';
import { fetchProgress, saveProgressDebounced, flushProgressBeacon } from '@/lib/progress';
import { useAuth } from '@/lib/auth';
import { ReaderPane } from '@/components/reader/ReaderPane';
import { ReaderToolbar } from '@/components/reader/ReaderToolbar';
import { SettingsSheet } from '@/components/reader/SettingsSheet';
import { ChapterNav } from '@/components/reader/ChapterNav';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

export default function Reader() {
  const { bookSlug = '', chapterIndex = '1' } = useParams();
  const index = Number(chapterIndex);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, session } = useAuth();

  // Token mới nhất, đọc đồng bộ trong handler pagehide (không kịp await).
  const tokenRef = useRef<string | undefined>(undefined);
  tokenRef.current = session?.access_token;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const restoredRef = useRef(false);
  const prefetchedRef = useRef(false);

  // Metadata truyện (cho tiêu đề toolbar + book_id lưu tiến độ).
  const { data: book } = useQuery({
    queryKey: ['book', bookSlug],
    queryFn: () => fetchBookBySlug(bookSlug),
    enabled: !!bookSlug,
  });

  // Danh sách chương (để map index → chapter_id khi lưu tiến độ).
  const { data: chapterList } = useQuery({
    queryKey: ['chapters', book?.id],
    queryFn: () => fetchChapterList(book!.id),
    enabled: !!book?.id,
  });

  // Nội dung chương — qua Edge Function.
  const {
    data: chapter,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['chapter', bookSlug, index],
    queryFn: () => fetchChapter(bookSlug, index),
    enabled: !!bookSlug && Number.isFinite(index) && index >= 1,
    retry: (count, err) => {
      // Không retry lỗi 401/404/429 — vô nghĩa.
      if (err instanceof ApiError && [401, 404, 429].includes(err.status)) {
        return false;
      }
      return count < 1;
    },
  });

  const currentChapterId = chapterList?.find((c) => c.index === index)?.id;

  // ---- Reset khi đổi chương ----
  useEffect(() => {
    restoredRef.current = false;
    prefetchedRef.current = false;
    window.scrollTo(0, 0);
  }, [index]);

  // ---- Khôi phục vị trí scroll từ tiến độ (chỉ chương đang lưu) ----
  useEffect(() => {
    if (!chapter || restoredRef.current || !user || !book) return;
    restoredRef.current = true;

    void fetchProgress(book.id).then((progress) => {
      if (
        progress &&
        progress.chapter_id === currentChapterId &&
        progress.scroll_pct > 0.02
      ) {
        const target =
          progress.scroll_pct *
          (document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: target, behavior: 'auto' });
      }
    });
  }, [chapter, user, book, currentChapterId]);

  // ---- Lưu tiến độ (debounce) + prefetch chương kế khi đọc quá 50% ----
  useEffect(() => {
    if (!chapter || !book || !currentChapterId) return;

    const onScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? window.scrollY / scrollable : 0;
      const clamped = Math.min(1, Math.max(0, pct));

      saveProgressDebounced({
        book_id: book.id,
        chapter_id: currentChapterId,
        scroll_pct: clamped,
      });

      // Prefetch chương index+1 khi đọc quá 50%.
      if (
        !prefetchedRef.current &&
        clamped > 0.5 &&
        chapter.nextIndex !== null
      ) {
        prefetchedRef.current = true;
        void queryClient.prefetchQuery({
          queryKey: ['chapter', bookSlug, chapter.nextIndex],
          queryFn: () => fetchChapter(bookSlug, chapter.nextIndex!),
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [chapter, book, currentChapterId, bookSlug, queryClient]);

  // ---- Ghi tiến độ bằng beacon khi rời trang ----
  useEffect(() => {
    if (!user) return;
    const onHide = () => {
      flushProgressBeacon(
        tokenRef.current,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        user.id,
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  // ---- Tap giữa màn hình → toggle toolbar ----
  const onContentClick = useCallback((e: React.MouseEvent) => {
    // Bỏ qua nếu bấm vào link/nút.
    if ((e.target as HTMLElement).closest('a,button')) return;
    const midStart = window.innerWidth * 0.25;
    const midEnd = window.innerWidth * 0.75;
    if (e.clientX >= midStart && e.clientX <= midEnd) {
      window.dispatchEvent(new Event('reader:tap'));
    }
  }, []);

  // ---- Trạng thái lỗi ----
  if (error instanceof ApiError && error.status === 401) {
    return (
      <ErrorState
        title="Chương này cần đăng nhập"
        message="Đăng nhập để tiếp tục đọc các chương tiếp theo."
        action={
          <Link to={`/dang-nhap?next=/doc/${bookSlug}/${index}`}>
            <Button>Đăng nhập</Button>
          </Link>
        }
      />
    );
  }
  if (error instanceof ApiError && error.status === 429) {
    return (
      <ErrorState
        title="Bạn đang đọc quá nhanh"
        message="Nghỉ một chút rồi thử lại nhé."
        action={
          <Button onClick={() => window.location.reload()}>Thử lại</Button>
        }
      />
    );
  }
  if (error) {
    return (
      <ErrorState
        title="Không tải được chương"
        message="Chương có thể không tồn tại hoặc có lỗi mạng."
        action={
          <Button onClick={() => navigate(`/truyen/${bookSlug}`)}>
            Về mục lục
          </Button>
        }
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <ReaderToolbar
        bookTitle={book?.title ?? '…'}
        bookSlug={bookSlug}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* padding-top để chừa chỗ toolbar */}
      <div className="pt-14" onClick={onContentClick}>
        {isLoading || !chapter ? (
          <Spinner label="Đang tải chương…" />
        ) : (
          <div key={index} className="chapter-fade-enter chapter-fade-enter-active">
            <ReaderPane
              title={chapter.title}
              index={chapter.index}
              content={chapter.content}
            />
            <ChapterNav
              bookSlug={bookSlug}
              prevIndex={chapter.prevIndex}
              nextIndex={chapter.nextIndex}
            />
          </div>
        )}
      </div>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

function ErrorState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-serif text-xl font-medium">{title}</h1>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}
