import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Độ trễ stagger (ms) khi nhiều item vào cùng lúc. */
  delay?: number;
}

/**
 * Scroll-entry nhẹ: fade + translateY(12px) qua 600ms khi phần tử vào viewport.
 * Dùng IntersectionObserver (không nghe 'scroll'); `prefers-reduced-motion`
 * được tôn trọng ở CSS (.reveal chuyển thẳng sang trạng thái hiện).
 */
export function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'is-in' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
