import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchMyProfile, updateDisplayName } from '@/lib/profile';
import { fetchMyShelf } from '@/lib/progress';
import { fetchMyBookList } from '@/lib/bookshelf';
import {
  fetchMyBookmarks,
  removeBookmark,
  updateBookmarkNote,
} from '@/lib/bookmarks';
import type {
  BookListStatus,
  BookmarkWithContext,
  ShelfItem,
} from '@/lib/types';
import { SiteHeader } from '@/components/SiteHeader';
import { Reveal } from '@/components/ui/Reveal';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CloseIcon } from '@/components/ui/icons';

export default function Account() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/dang-nhap?next=/tai-khoan" replace />;
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        {loading || !user ? (
          <Spinner label="Đang tải…" />
        ) : (
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              Tài khoản
            </p>
            <h1 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.03em] text-ink-strong md:text-4xl">
              Tài khoản của bạn
            </h1>

            <div className="mt-12 space-y-14">
              <ProfileSection userId={user.id} email={user.email ?? ''} />
              <BookshelfSection userId={user.id} />
              <ShelfSection userId={user.id} />
              <BookmarksSection userId={user.id} />
            </div>
          </Reveal>
        )}
      </main>
    </div>
  );
}

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-3">
      <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
        {title}
      </h2>
      {meta && (
        <span className="font-mono text-xs uppercase tracking-[0.06em] text-ink-muted">
          {meta}
        </span>
      )}
    </div>
  );
}

// ---- Hồ sơ: sửa tên hiển thị (cột duy nhất user được update — 0002) ----

function ProfileSection({ userId, email }: { userId: string; email: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchMyProfile(userId),
  });

  useEffect(() => {
    if (profile) setName(profile.display_name ?? '');
  }, [profile]);

  const save = useMutation({
    mutationFn: () => updateDisplayName(userId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <section>
      <SectionHeader title="Hồ sơ" />
      {isLoading ? (
        <Spinner label="Đang tải hồ sơ…" />
      ) : (
        <form
          className="flex max-w-md flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-sm text-ink-muted" htmlFor="display-name">
            Tên hiển thị
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên của bạn"
            className="rounded-md border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
          />
          <p className="font-mono text-xs text-ink-muted">{email}</p>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="solid" disabled={save.isPending}>
              {save.isPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
            {saved && <span className="text-sm text-clay-green">Đã lưu.</span>}
            {save.isError && (
              <span className="text-sm text-clay-red">
                Không lưu được. Thử lại nhé.
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

// ---- Tủ sách: phân loại thủ công (book_lists) ----

const SHELF_TABS: { value: BookListStatus; label: string }[] = [
  { value: 'reading', label: 'Đang đọc' },
  { value: 'want', label: 'Muốn đọc' },
  { value: 'read', label: 'Đã đọc' },
];

function BookshelfSection({ userId }: { userId: string }) {
  const [tab, setTab] = useState<BookListStatus>('reading');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['my-book-list', tab, userId],
    queryFn: () => fetchMyBookList(tab),
  });

  return (
    <section>
      <SectionHeader title="Tủ sách" />
      <div className="mb-4 flex gap-2">
        {SHELF_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={`rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.05em] transition-colors duration-150 ${
              tab === t.value
                ? 'border-ink-strong bg-ink-strong text-white'
                : 'border-hairline text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isLoading && <Spinner label="Đang tải…" />}
      {entries && entries.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">
          Chưa có truyện nào trong mục này. Vào trang truyện để thêm vào tủ.
        </p>
      )}
      {entries && entries.length > 0 && (
        <ul>
          {entries.map((e) => (
            <li key={e.book_id} className="border-b border-hairline">
              <Link
                to={`/truyen/${e.book!.slug}`}
                className="flex items-center gap-4 py-3.5 transition-colors duration-150 hover:bg-surface"
              >
                <span className="h-14 w-10 shrink-0 overflow-hidden rounded border border-hairline bg-surface">
                  {e.book!.cover_url ? (
                    <img
                      src={e.book!.cover_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {e.book!.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-ink-muted">
                    {e.book!.chapter_count} chương
                    {e.book!.status === 'completed' ? ' · Hoàn thành' : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- Lịch sử đọc: từ reading_progress ----

function ShelfSection({ userId }: { userId: string }) {
  const { data: shelf, isLoading } = useQuery({
    queryKey: ['shelf', userId],
    queryFn: fetchMyShelf,
  });

  return (
    <section>
      <SectionHeader
        title="Lịch sử đọc"
        meta={shelf ? `${shelf.length} truyện` : undefined}
      />
      {isLoading && <Spinner label="Đang tải…" />}
      {shelf && shelf.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">
          Bạn chưa đọc truyện nào.{' '}
          <Link to="/" className="text-ink underline underline-offset-2">
            Khám phá thư viện
          </Link>
          .
        </p>
      )}
      {shelf && shelf.length > 0 && (
        <ul>
          {shelf.map((item) => (
            <ShelfRow key={item.book_id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ShelfRow({ item }: { item: ShelfItem }) {
  const book = item.book!;
  const chapterIndex = item.chapter?.index ?? 1;
  return (
    <li className="border-b border-hairline">
      <Link
        to={`/doc/${book.slug}/${chapterIndex}`}
        className="flex items-center gap-4 py-3.5 transition-colors duration-150 hover:bg-surface"
      >
        <span className="h-14 w-10 shrink-0 overflow-hidden rounded border border-hairline bg-surface">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{book.title}</span>
          <span className="mt-0.5 block font-mono text-xs text-ink-muted">
            Chương {chapterIndex}/{book.chapter_count} ·{' '}
            {Math.round(item.scroll_pct * 100)}% ·{' '}
            {formatRelative(item.updated_at)}
          </span>
        </span>
      </Link>
    </li>
  );
}

// ---- Đánh dấu: list bookmark, sửa ghi chú inline, xóa có xác nhận ----

function BookmarksSection({ userId }: { userId: string }) {
  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ['bookmarks', userId],
    queryFn: fetchMyBookmarks,
  });

  return (
    <section>
      <SectionHeader
        title="Đánh dấu"
        meta={bookmarks ? `${bookmarks.length} chương` : undefined}
      />
      {isLoading && <Spinner label="Đang tải…" />}
      {bookmarks && bookmarks.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">
          Chưa có chương nào được đánh dấu. Khi đọc, bấm biểu tượng đánh dấu
          trên thanh công cụ để lưu lại chương.
        </p>
      )}
      {bookmarks && bookmarks.length > 0 && (
        <ul>
          {bookmarks.map((b) => (
            <BookmarkRow key={b.id} bookmark={b} userId={userId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookmarkRow({
  bookmark,
  userId,
}: {
  bookmark: BookmarkWithContext;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const chapter = bookmark.chapter!;
  const book = chapter.book!;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(bookmark.note ?? '');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['bookmarks', userId] });

  const remove = useMutation({
    mutationFn: () => removeBookmark(bookmark.id),
    onSuccess: () => {
      void invalidate();
      // Đồng bộ trạng thái nút toggle trong Reader (nếu đang cache).
      void queryClient.invalidateQueries({
        queryKey: ['bookmark', bookmark.chapter_id, userId],
      });
    },
  });

  const saveNote = useMutation({
    mutationFn: () => updateBookmarkNote(bookmark.id, note),
    onSuccess: () => {
      setEditing(false);
      void invalidate();
    },
  });

  return (
    <li className="border-b border-hairline py-3.5">
      <div className="flex items-center gap-4">
        <Link
          to={`/doc/${book.slug}/${chapter.index}`}
          className="min-w-0 flex-1"
        >
          <span className="block truncate text-sm text-ink">{book.title}</span>
          <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
            Chương {chapter.index} — {chapter.title}
          </span>
        </Link>
        <IconButton
          label="Xoá đánh dấu"
          className="h-8 w-8 shrink-0 text-ink-muted hover:bg-canvas hover:text-ink"
          onClick={() => setConfirmOpen(true)}
        >
          <CloseIcon width={15} height={15} />
        </IconButton>
      </div>

      {editing ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveNote.mutate();
          }}
        >
          <input
            type="text"
            value={note}
            maxLength={280}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú…"
            className="flex-1 rounded-md border border-hairline bg-surface px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-ink"
          />
          <Button type="submit" variant="hairline" disabled={saveNote.isPending}>
            Lưu
          </Button>
        </form>
      ) : (
        <button
          className="mt-1 block text-left text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setEditing(true)}
        >
          {bookmark.note ? bookmark.note : 'Thêm ghi chú'}
        </button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Xoá đánh dấu?"
        body={`Bỏ đánh dấu “Chương ${chapter.index} — ${chapter.title}”.`}
        confirmLabel="Xoá"
        danger
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </li>
  );
}

// ---- Thời gian tương đối, đủ dùng cho lịch sử đọc ----

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
