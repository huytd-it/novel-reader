import { useCallback, useEffect, useState } from 'react';

/**
 * Trạng thái ẩn/hiện "chrome" của trang đọc (toolbar trên + thanh điều hướng dưới).
 * - Cuộn xuống → ẩn, cuộn lên → hiện, gần đầu trang → luôn hiện.
 * - `toggle()` cho tap giữa màn hình.
 */
export function useReaderChrome() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      // Ngưỡng nhỏ để tránh giật khi cuộn nhẹ.
      if (Math.abs(delta) < 8) return;
      if (y < 80) {
        setVisible(true);
      } else {
        setVisible(delta < 0);
      }
      lastY = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggle = useCallback(() => setVisible((v) => !v), []);

  return { visible, toggle };
}
