import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPopularBooks } from '@/lib/discovery';
import { Reveal } from '@/components/ui/Reveal';

const PERIODS = [
  { label: 'Ngày', days: 1 },
  { label: 'Tuần', days: 7 },
  { label: 'Tháng', days: 30 },
] as const;

const TREND_TONE: Record<string, string> = {
  '↑': 'text-clay-green',
  '↓': 'text-clay-red',
  '→': 'text-ink-muted',
};

/** Bảng xếp hạng Hot: chuyển tab Ngày/Tuần/Tháng không reload (react-query cache). */
export function RankingWidget() {
  const [days, setDays] = useState<number>(7);

  const { data, isLoading } = useQuery({
    queryKey: ['popular', days],
    queryFn: () => fetchPopularBooks(days, 10),
    staleTime: 15 * 60 * 1000, // xếp hạng đổi chậm; cache 15 phút
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <Reveal className="mb-14">
      <div className="mb-4 flex items-center justify-between border-b border-hairline pb-3">
        <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink-strong">
          Bảng xếp hạng
        </h2>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.05em] transition-colors duration-150 ${
                days === p.days
                  ? 'bg-ink-invert text-white'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-8">
        {(data ?? []).map((b, i) => (
          <li key={b.id}>
            <Link
              to={`/truyen/${b.slug}`}
              className="flex w-full items-center gap-3 rounded-lg py-2 transition-colors hover:bg-surface"
            >
              <span
                className={`w-6 shrink-0 text-center font-display text-lg tabular-nums ${
                  i < 3 ? 'text-ink-strong' : 'text-ink-muted'
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{b.title}</span>
                {b.author && (
                  <span className="block truncate text-xs text-ink-muted">
                    {b.author}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                {b.reads} lượt
              </span>
              <span className={`w-4 shrink-0 text-center ${TREND_TONE[b.trend]}`}>
                {b.trend}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
