import { StarFilledIcon, StarIcon } from '@/components/ui/icons';

/**
 * Hiển thị hoặc nhập điểm sao. Có `onChange` → tương tác được (chọn điểm);
 * không có → chỉ hiển thị (làm tròn tới sao gần nhất).
 */
export function StarRating({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const interactive = !!onChange;
  return (
    <div className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const Icon = filled ? StarFilledIcon : StarIcon;
        const star = (
          <Icon
            width={size}
            height={size}
            className={filled ? 'text-clay-yellow' : 'text-ink-muted'}
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} sao`}
            onClick={() => onChange!(n)}
            className="transition-transform hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
