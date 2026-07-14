import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchFlaggedProfiles,
  fetchReadsPerBook,
  fetchReadsPerDay,
  setFlagged,
} from '@/lib/adminAnalytics';
import type { Profile } from '@/lib/types';
import { AdminGate } from '@/components/admin/AdminGate';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function AdminAnalytics() {
  return (
    <AdminGate next="/admin/analytics" wide>
      <AnalyticsWorkspace />
    </AdminGate>
  );
}

const RANGES = [7, 30] as const;

function AnalyticsWorkspace() {
  const [days, setDays] = useState<number>(30);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            Quản trị · Thống kê
          </p>
          <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-ink-strong">
            Thống kê đọc
          </h1>
        </div>
        <div className="flex gap-2">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-[0.05em] transition-colors duration-150 ${
                days === d
                  ? 'border-ink-strong bg-ink-strong text-white'
                  : 'border-hairline text-ink-muted hover:text-ink'
              }`}
            >
              {d} ngày
            </button>
          ))}
        </div>
      </header>

      <ReadsPerDaySection days={days} />
      <ReadsPerBookSection days={days} />
      <FlaggedSection />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-hairline pb-3 font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
      {children}
    </h2>
  );
}

// ---- Lượt đọc theo ngày: bar list tối giản, không cần chart library ----

function ReadsPerDaySection({ days }: { days: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-reads-day', days],
    queryFn: () => fetchReadsPerDay(days),
  });

  const max = Math.max(1, ...(data?.map((d) => d.total) ?? []));

  return (
    <section>
      <SectionTitle>Lượt đọc theo ngày</SectionTitle>
      {isLoading && <Spinner label="Đang tải…" />}
      {isError && (
        <p className="py-6 text-sm text-ink-muted">Không tải được số liệu.</p>
      )}
      {data && data.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">
          Chưa có lượt đọc nào trong {days} ngày qua.
        </p>
      )}
      {data && data.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {data.map((d) => (
            <li key={d.day} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                {new Date(d.day).toLocaleDateString('vi-VN')}
              </span>
              <span className="h-4 flex-1 overflow-hidden rounded bg-canvas">
                <span
                  className="block h-full rounded bg-pale-blue"
                  style={{ width: `${(d.total / max) * 100}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                {d.total}
              </span>
              <span className="hidden w-24 shrink-0 text-right font-mono text-xs tabular-nums text-ink-muted sm:block">
                {d.unique_users} người
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- Lượt đọc theo truyện ----

function ReadsPerBookSection({ days }: { days: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-reads-book', days],
    queryFn: () => fetchReadsPerBook(days),
  });

  return (
    <section>
      <SectionTitle>Lượt đọc theo truyện</SectionTitle>
      {isLoading && <Spinner label="Đang tải…" />}
      {isError && (
        <p className="py-6 text-sm text-ink-muted">Không tải được số liệu.</p>
      )}
      {data && data.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">
          Chưa có lượt đọc nào trong {days} ngày qua.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-[0.06em] text-ink-muted">
                <th className="px-4 py-3 font-medium">Truyện</th>
                <th className="px-4 py-3 text-right font-medium">Lượt đọc</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.book_id}
                  className="border-b border-hairline last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/truyen/${row.slug}`}
                      className="font-medium text-ink-strong underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- Tài khoản bị gắn cờ nghi bot (get-chapter đặt cờ) ----

function FlaggedSection() {
  const queryClient = useQueryClient();
  const [pendingUnflag, setPendingUnflag] = useState<Profile | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-flagged'],
    queryFn: fetchFlaggedProfiles,
  });

  const unflag = useMutation({
    mutationFn: (userId: string) => setFlagged(userId, false),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-flagged'] });
    },
  });

  return (
    <section>
      <SectionTitle>Tài khoản bị gắn cờ</SectionTitle>
      {isLoading && <Spinner label="Đang tải…" />}
      {isError && (
        <p className="py-6 text-sm text-ink-muted">Không tải được danh sách.</p>
      )}
      {data && data.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">
          Không có tài khoản nào bị gắn cờ nghi bot.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs uppercase tracking-[0.06em] text-ink-muted">
                <th className="px-4 py-3 font-medium">Tài khoản</th>
                <th className="px-4 py-3 font-medium">Tạo lúc</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-strong">
                      {p.display_name ?? '(không tên)'}
                    </p>
                    <p className="font-mono text-xs text-ink-muted">{p.id}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {new Date(p.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="hairline"
                      disabled={unflag.isPending}
                      onClick={() => setPendingUnflag(p)}
                    >
                      Bỏ cờ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingUnflag}
        title="Bỏ cờ tài khoản?"
        body={`Tài khoản "${pendingUnflag?.display_name ?? pendingUnflag?.id ?? ''}" sẽ đọc bình thường trở lại.`}
        confirmLabel="Bỏ cờ"
        onClose={() => setPendingUnflag(null)}
        onConfirm={() => {
          if (pendingUnflag) unflag.mutate(pendingUnflag.id);
        }}
      />
    </section>
  );
}
