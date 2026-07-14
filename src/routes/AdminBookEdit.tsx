import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookById,
  fetchDistinctGenres,
  updateBook,
  deleteBook,
} from '@/lib/adminBooks';
import type { BookStatus } from '@/lib/types';
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

      <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-white p-6">
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

          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 accent-ink-strong"
            />
            Publish (hiển thị công khai)
          </label>
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
