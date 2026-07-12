import { useScrollProgress } from '@/hooks/useScrollProgress';

/**
 * Vạch tiến độ đọc 2px sát mép trên màn hình — luôn hiện, kể cả khi
 * toolbar ẩn, để người đọc luôn biết mình đang ở đâu trong chương.
 * Dùng transform scaleX (không đổi width) để tránh reflow khi cuộn.
 */
export function ReaderProgressBar() {
  const pct = useScrollProgress();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 origin-left bg-accent transition-transform duration-150 ease-out"
      style={{ transform: `scaleX(${pct})` }}
      aria-hidden
    />
  );
}
