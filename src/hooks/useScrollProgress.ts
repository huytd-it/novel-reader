import { useEffect, useState } from 'react';

/**
 * Tiến độ cuộn của trang (0..1), throttle bằng requestAnimationFrame.
 * Lượng tử hoá 0.5% để component dùng hook không re-render mỗi frame.
 *
 * Đặt hook này TRONG component nhỏ cần hiển thị tiến độ (progress bar,
 * bottom bar) — không đặt ở Reader gốc để khỏi re-render cả vùng đọc.
 */
export function useScrollProgress(): number {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = scrollable > 0 ? window.scrollY / scrollable : 0;
      const clamped = Math.min(1, Math.max(0, p));
      // Bước 0.5% — React bail-out khi giá trị không đổi.
      setPct(Math.round(clamped * 200) / 200);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return pct;
}
