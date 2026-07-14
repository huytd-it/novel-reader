import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';
import type { AppNotification } from '@/lib/types';
import { IconButton } from '@/components/ui/IconButton';
import { BellIcon } from '@/components/ui/icons';

/** Chuông thông báo: đếm chưa đọc, dropdown danh sách, cập nhật realtime. */
export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: items } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchMyNotifications(20),
    enabled: !!user,
  });

  // Realtime: có thông báo mới → refetch. RLS lọc theo user ở tầng realtime,
  // nhưng vẫn filter tường minh cho chắc.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['notifications', user.id],
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const unread = items?.filter((n) => !n.is_read).length ?? 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });

  return (
    <div ref={ref} className="relative">
      <IconButton
        label="Thông báo"
        className="text-ink-muted hover:bg-canvas hover:text-ink"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative">
          <BellIcon width={19} height={19} />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-red px-1 text-[10px] font-medium text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      </IconButton>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-hairline bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <span className="text-sm font-medium text-ink-strong">Thông báo</span>
            {unread > 0 && (
              <button
                className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                onClick={() => {
                  void markAllNotificationsRead().then(invalidate);
                }}
              >
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          {(!items || items.length === 0) && (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              Chưa có thông báo nào.
            </p>
          )}

          <ul className="max-h-96 overflow-y-auto">
            {items?.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={() => {
                  if (!n.is_read) void markNotificationRead(n.id).then(invalidate);
                  setOpen(false);
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  onOpen,
}: {
  n: AppNotification;
  onOpen: () => void;
}) {
  const target =
    n.book?.slug && n.chapter?.index
      ? `/doc/${n.book.slug}/${n.chapter.index}`
      : n.book?.slug
        ? `/truyen/${n.book.slug}`
        : '#';

  return (
    <li className="border-b border-hairline last:border-0">
      <Link
        to={target}
        onClick={onOpen}
        className={`block px-4 py-3 transition-colors hover:bg-canvas ${
          n.is_read ? '' : 'bg-pale-blue/40'
        }`}
      >
        <span className="flex items-start gap-2">
          {!n.is_read && (
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-blue" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink">{n.title}</span>
            <span className="mt-0.5 block font-mono text-[11px] text-ink-muted">
              {formatRelative(n.created_at)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function formatRelative(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
