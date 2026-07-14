import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveAnnouncement } from '@/lib/discovery';
import type { AnnouncementKind } from '@/lib/types';
import { CloseIcon } from '@/components/ui/icons';

const DISMISS_KEY = 'announcement-dismissed';

const TONE: Record<AnnouncementKind, string> = {
  info: 'bg-pale-blue text-clay-blue',
  warning: 'bg-pale-yellow text-clay-yellow',
  success: 'bg-pale-green text-clay-green',
};

/**
 * Thanh thông báo trên cùng. Trạng thái đóng lưu theo id vào localStorage
 * nên đóng rồi sẽ không hiện lại (cho tới khi có thông báo mới).
 */
export function AnnouncementBar() {
  const { data: ann } = useQuery({
    queryKey: ['announcement'],
    queryFn: fetchActiveAnnouncement,
  });
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY));
  }, []);

  if (!ann || dismissed === ann.id) return null;

  return (
    <div className={`${TONE[ann.kind]} text-sm`}>
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-2">
        <p className="flex-1 text-center">{ann.message}</p>
        <button
          aria-label="Đóng thông báo"
          className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, ann.id);
            setDismissed(ann.id);
          }}
        >
          <CloseIcon width={15} height={15} />
        </button>
      </div>
    </div>
  );
}
