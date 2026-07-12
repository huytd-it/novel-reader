import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAllBooksForAdmin,
  updateBook,
  deleteBook,
} from '@/lib/adminBooks';
import type { Book } from '@/lib/types';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function AdminBooks() {
  return (
    <AdminGate next="/admin/books" wide>
      <BooksWorkspace />
    </AdminGate>
  );
}

function BooksWorkspace() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null);

  const { data: books, isLoading } = useQuery({
    queryKey: ['admin-books'],
    queryFn: fetchAllBooksForAdmin,
  });

  const togglePublish = useMutation({
    mutationFn: (book: Book) =>
      updateBook(book.id, { is_published: !book.is_published }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-books'] });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-books'] });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            Quản trị · Truyện
          </p>
          <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-ink-strong">
            Quản lý truyện
          </h1>
        </div>
        <Link to="/admin/import">
          <Button variant="hairline">Nhập truyện mới</Button>
        </Link>
      </header>

      {isLoading && <Spinner label="Đang tải danh sách…" />}

      {books && books.length === 0 && (
        <p className="py-16 text-center text-ink-muted">
          Chưa có truyện nào. Vào "Nhập truyện mới" để bắt đầu.
        </p>
      )}

      {books && books.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-[0.06em] text-ink-muted">
                <th className="px-4 py-3 font-medium">Truyện</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Thể loại</th>
                <th className="px-4 py-3 font-medium">Chương</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-hairline bg-canvas">
                        {book.cover_url && (
                          <img
                            src={book.cover_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-strong">
                          {book.title}
                        </p>
                        <p className="truncate font-mono text-xs text-ink-muted">
                          {book.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge
                        active={book.is_published}
                        onLabel="Đã publish"
                        offLabel="Nháp"
                      />
                      <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                        {book.status === 'completed' ? 'Hoàn thành' : 'Đang ra'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {book.genre?.length ? (
                        book.genre.map((g) => (
                          <span
                            key={g}
                            className="rounded-full bg-pale-blue px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-clay-blue"
                          >
                            {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {book.chapter_count}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <Link to={`/admin/books/${book.id}`}>
                        <Button variant="hairline">Sửa</Button>
                      </Link>
                      <Button
                        variant="hairline"
                        disabled={togglePublish.isPending}
                        onClick={() => togglePublish.mutate(book)}
                      >
                        {book.is_published ? 'Ẩn' : 'Publish'}
                      </Button>
                      <Button
                        variant="hairline"
                        className="text-clay-red"
                        onClick={() => setPendingDelete(book)}
                      >
                        Xoá
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Xoá "${pendingDelete?.title ?? ''}"?`}
        body="Toàn bộ chương và nội dung của truyện này sẽ bị xoá vĩnh viễn. Không thể hoàn tác."
        confirmLabel="Xoá truyện"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
}

function StatusBadge({
  active,
  onLabel,
  offLabel,
}: {
  active: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={`w-fit rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] ${
        active ? 'bg-pale-green text-clay-green' : 'bg-pale-yellow text-clay-yellow'
      }`}
    >
      {active ? onLabel : offLabel}
    </span>
  );
}
