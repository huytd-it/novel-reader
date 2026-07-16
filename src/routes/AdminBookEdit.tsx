import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookById,
  fetchDistinctGenres,
  updateBook,
  deleteBook,
} from '@/lib/adminBooks';
import {
  fetchChaptersForAdmin,
  deleteChapters,
  reindexChapters,
  planReindexByTitle,
  planReindexSequential,
  type ReindexItem,
} from '@/lib/adminChapters';
import { detectChapterNumber } from '@/lib/chapterNumber';
import type { BookStatus, ChapterMeta } from '@/lib/types';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function AdminBookEdit() {
  const { id = '' } = useParams();
  return (
    <AdminGate next={`/admin/books/${id}`}>
      <EditWorkspace id={id} />
    </AdminGate>
  );
}

function EditWorkspace({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: book, isLoading } = useQuery({
    queryKey: ['admin-book', id],
    queryFn: () => fetchBookById(id),
    enabled: !!id,
  });

  const { data: genreSuggestions } = useQuery({
    queryKey: ['admin-genres'],
    queryFn: fetchDistinctGenres,
  });

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [status, setStatus] = useState<BookStatus>('ongoing');
  const [isPublished, setIsPublished] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!book) return;
    setTitle(book.title);
    setAuthor(book.author ?? '');
    setDescription(book.description ?? '');
    setGenre(book.genre?.join(', ') ?? '');
    setStatus(book.status);
    setIsPublished(book.is_published);
    setIsFeatured(book.is_featured ?? false);
  }, [book]);

  const save = useMutation({
    mutationFn: () =>
      updateBook(id, {
        title: title.trim(),
        author: author.trim() || null,
        description: description.trim() || null,
        genre: genre
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean),
        status,
        is_published: isPublished,
        is_featured: isFeatured,
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['admin-book', id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-books'] });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
      void queryClient.invalidateQueries({ queryKey: ['book', book?.slug] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteBook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-books'] });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
      navigate('/admin/books');
    },
  });

  if (isLoading) return <Spinner label="Đang tải truyện…" />;

  if (!book) {
    return (
      <div className="py-16 text-center text-ink-muted">
        <p>Không tìm thấy truyện này.</p>
        <Link
          to="/admin/books"
          className="mt-3 inline-block text-ink underline underline-offset-4"
        >
          Về danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link
          to="/admin/books"
          className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted transition-colors hover:text-ink"
        >
          ← Quản lý truyện
        </Link>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-ink-strong">
          Sửa truyện
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-muted">/truyen/{book.slug}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-6">
        <Field label="Tựa">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Tác giả">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Mô tả">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className={inputCls}
          />
        </Field>

        <Field label="Thể loại (phân tách bằng dấu phẩy)">
          <input
            list="genre-suggestions"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Kiếm hiệp, Huyền huyễn, Trọng sinh"
            className={inputCls}
          />
          <datalist id="genre-suggestions">
            {genreSuggestions?.map((g) => <option key={g} value={g} />)}
          </datalist>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Trạng thái">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookStatus)}
              className={inputCls}
            >
              <option value="ongoing">Đang ra</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </Field>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Hiển thị
            </span>
            <label className="flex items-center gap-2 py-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 accent-ink-strong"
              />
              Publish (hiển thị công khai)
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="h-4 w-4 accent-ink-strong"
          />
          Tuyển chọn (đưa lên hero trang chủ)
        </label>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            variant="solid"
            disabled={!title.trim() || save.isPending}
            onClick={() => {
              setSaved(false);
              save.mutate();
            }}
          >
            {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
          <Button
            variant="hairline"
            className="text-clay-red"
            onClick={() => setConfirmDelete(true)}
          >
            Xoá truyện
          </Button>
          {saved && !save.isPending && (
            <span className="text-sm text-clay-green">✓ Đã lưu</span>
          )}
          {save.isError && (
            <span className="text-sm text-clay-red">Có lỗi khi lưu.</span>
          )}
        </div>
      </section>

      <ChapterManager bookId={id} />

      <ConfirmDialog
        open={confirmDelete}
        title={`Xoá "${book.title}"?`}
        body="Toàn bộ chương và nội dung của truyện này sẽ bị xoá vĩnh viễn. Không thể hoàn tác."
        confirmLabel="Xoá truyện"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

type ChapterConfirm = 'delete' | 'bytitle' | 'sequential' | null;

/**
 * Quản lý chương: liệt kê, xoá chương rác (giới thiệu, thông báo nghỉ…),
 * re-index hàng loạt — theo số trong tên chương hoặc tuần tự 1..N.
 */
function ChapterManager({ bookId }: { bookId: string }) {
  const queryClient = useQueryClient();

  const { data: chapters, isLoading } = useQuery({
    queryKey: ['admin-chapters', bookId],
    queryFn: () => fetchChaptersForAdmin(bookId),
    enabled: !!bookId,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ChapterConfirm>(null);

  const list = useMemo(() => chapters ?? [], [chapters]);

  // Số detect từ tên từng chương (null = chương không có số → nghi là rác).
  const detectedById = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const c of list) m.set(c.id, detectChapterNumber(c.title));
    return m;
  }, [list]);

  const noNumberIds = useMemo(
    () => list.filter((c) => detectedById.get(c.id) === null).map((c) => c.id),
    [list, detectedById],
  );
  const mismatchCount = useMemo(
    () =>
      list.filter((c) => {
        const d = detectedById.get(c.id);
        return d !== null && d !== c.index;
      }).length,
    [list, detectedById],
  );
  // Số index bị "thủng" trong dải hiện tại (reader vẫn nhảy qua được).
  const gapCount =
    list.length > 0
      ? list[list.length - 1].index - list[0].index + 1 - list.length
      : 0;

  const planTitle = useMemo(() => planReindexByTitle(list), [list]);
  const planSeq = useMemo(() => planReindexSequential(list), [list]);
  const changedByPlan = (plan: ReindexItem[]) => {
    const current = new Map(list.map((c) => [c.id, c.index]));
    return plan.filter((p) => current.get(p.id) !== p.index).length;
  };

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['admin-chapters', bookId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-book', bookId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-books'] });
    void queryClient.invalidateQueries({ queryKey: ['chapters', bookId] });
  }

  const del = useMutation({
    mutationFn: () => deleteChapters(bookId, [...selected]),
    onSuccess: () => {
      setSelected(new Set());
      invalidate();
    },
  });

  const reindex = useMutation({
    mutationFn: (items: ReindexItem[]) => reindexChapters(bookId, items),
    onSuccess: invalidate,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const busy = del.isPending || reindex.isPending;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink-strong">
            Quản lý chương ({list.length})
          </h2>
          {list.length > 0 && (
            <p className="mt-1 text-xs text-ink-muted">
              {noNumberIds.length} chương không có số trong tên ·{' '}
              {mismatchCount} chương index lệch số trong tên
              {gapCount > 0 && <> · thiếu {gapCount} số trong dải</>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="hairline"
            disabled={busy || noNumberIds.length === 0}
            onClick={() => setSelected(new Set(noNumberIds))}
          >
            Chọn chương không có số
          </Button>
          <Button
            variant="hairline"
            disabled={busy || selected.size === 0}
            className="text-clay-red"
            onClick={() => setConfirm('delete')}
          >
            Xoá {selected.size > 0 ? `${selected.size} chương` : 'chương'}
          </Button>
          <Button
            variant="hairline"
            disabled={busy || list.length === 0}
            onClick={() => setConfirm('bytitle')}
          >
            Re-index theo tên chương
          </Button>
          <Button
            variant="hairline"
            disabled={busy || list.length === 0}
            onClick={() => setConfirm('sequential')}
          >
            Re-index tuần tự 1..{list.length}
          </Button>
        </div>
      </header>

      {isLoading && <Spinner label="Đang tải danh sách chương…" />}
      {(del.isError || reindex.isError) && (
        <p className="text-sm text-clay-red">
          {(del.error ?? reindex.error)?.message ||
            'Có lỗi khi cập nhật chương. Thử tải lại trang.'}
        </p>
      )}

      {!isLoading && list.length === 0 && (
        <p className="py-6 text-center text-sm text-ink-muted">
          Truyện này chưa có chương nào.
        </p>
      )}

      {list.length > 0 && (
        <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-hairline">
          {list.map((c) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              detected={detectedById.get(c.id) ?? null}
              checked={selected.has(c.id)}
              onToggle={() => toggle(c.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Xoá ${selected.size} chương đã chọn?`}
        body="Nội dung chương, bookmark và tiến độ đọc trỏ tới các chương này sẽ bị xoá vĩnh viễn. Không thể hoàn tác."
        confirmLabel="Xoá chương"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          del.mutate();
        }}
      />
      <ConfirmDialog
        open={confirm === 'bytitle'}
        title="Re-index theo tên chương?"
        body={`Đánh lại số toàn bộ ${list.length} chương: ưu tiên số trong tên ("Chương 10" → 10), chương không có số nối tiếp chương trước. ${changedByPlan(planTitle)} chương sẽ đổi số — URL /doc/… theo số cũ sẽ trỏ sang chương khác.`}
        confirmLabel="Re-index"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          reindex.mutate(planTitle);
        }}
      />
      <ConfirmDialog
        open={confirm === 'sequential'}
        title={`Re-index tuần tự 1..${list.length}?`}
        body={`Đánh lại số toàn bộ chương thành 1..${list.length} theo thứ tự hiện tại (bỏ mọi "lỗ" index). ${changedByPlan(planSeq)} chương sẽ đổi số — URL /doc/… theo số cũ sẽ trỏ sang chương khác.`}
        confirmLabel="Re-index"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          reindex.mutate(planSeq);
        }}
      />
    </section>
  );
}

function ChapterRow({
  chapter,
  detected,
  checked,
  onToggle,
}: {
  chapter: ChapterMeta;
  detected: number | null;
  checked: boolean;
  onToggle: () => void;
}) {
  const mismatch = detected !== null && detected !== chapter.index;
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 border-b border-hairline px-4 py-2 text-sm last:border-0 ${
        checked ? 'bg-canvas' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-ink-strong"
      />
      <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-muted">
        #{chapter.index}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-strong">
        {chapter.title}
      </span>
      {detected === null && (
        <span className="shrink-0 rounded-full bg-pale-yellow px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-yellow">
          Không có số
        </span>
      )}
      {mismatch && (
        <span className="shrink-0 rounded-full bg-pale-red px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-red">
          Tên: {detected}
        </span>
      )}
      {chapter.is_free && (
        <span className="shrink-0 rounded-full bg-pale-green px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-green">
          Free
        </span>
      )}
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink-muted">
        {chapter.word_count ? `${chapter.word_count} từ` : '—'}
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink';
