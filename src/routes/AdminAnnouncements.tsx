import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAllAnnouncements,
  setAnnouncementActive,
} from '@/lib/discovery';
import type { Announcement, AnnouncementKind } from '@/lib/types';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function AdminAnnouncements() {
  return (
    <AdminGate next="/admin/announcements" wide>
      <Workspace />
    </AdminGate>
  );
}

const KINDS: { value: AnnouncementKind; label: string }[] = [
  { value: 'info', label: 'Thông tin' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'success', label: 'Thành công' },
];

function Workspace() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<AnnouncementKind>('info');
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: fetchAllAnnouncements,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
    void queryClient.invalidateQueries({ queryKey: ['announcement'] });
  };

  const create = useMutation({
    mutationFn: () => createAnnouncement(message, kind),
    onSuccess: () => {
      setMessage('');
      invalidate();
    },
  });

  const toggle = useMutation({
    mutationFn: (a: Announcement) => setAnnouncementActive(a.id, !a.is_active),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          Quản trị · Thông báo
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-ink-strong">
          Thông báo
        </h1>
      </header>

      <form
        className="flex flex-col gap-3 rounded-xl border border-hairline bg-white p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) create.mutate();
        }}
      >
        <input
          value={message}
          maxLength={200}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Nội dung thông báo…"
          className="rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink"
        />
        <div className="flex items-center gap-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AnnouncementKind)}
            className="rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-ink"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            variant="solid"
            disabled={!message.trim() || create.isPending}
          >
            {create.isPending ? 'Đang tạo…' : 'Tạo thông báo'}
          </Button>
        </div>
      </form>

      {isLoading && <Spinner label="Đang tải…" />}
      {data && data.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">Chưa có thông báo nào.</p>
      )}
      {data && data.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-hairline bg-white">
          {data.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] ${
                  a.kind === 'warning'
                    ? 'bg-pale-yellow text-clay-yellow'
                    : a.kind === 'success'
                      ? 'bg-pale-green text-clay-green'
                      : 'bg-pale-blue text-clay-blue'
                }`}
              >
                {a.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {a.message}
              </span>
              <span
                className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.05em] ${
                  a.is_active ? 'text-clay-green' : 'text-ink-muted'
                }`}
              >
                {a.is_active ? 'Đang bật' : 'Tắt'}
              </span>
              <Button
                variant="hairline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate(a)}
              >
                {a.is_active ? 'Tắt' : 'Bật'}
              </Button>
              <Button
                variant="hairline"
                className="text-clay-red"
                onClick={() => setPendingDelete(a)}
              >
                Xoá
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Xoá thông báo?"
        body="Thông báo này sẽ bị xoá vĩnh viễn."
        confirmLabel="Xoá"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
}
