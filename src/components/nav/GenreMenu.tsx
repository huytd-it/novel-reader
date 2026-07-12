import { Link } from 'react-router-dom';
import { useGenres } from '@/hooks/useGenres';
import { NavPopover } from './NavPopover';
import { ChevronDownIcon } from '@/components/ui/icons';

const triggerCls =
  'inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-ink';

export function GenreMenu() {
  const { genres } = useGenres();
  if (genres.length === 0) return null;

  return (
    <NavPopover
      align="left"
      triggerClassName={triggerCls}
      trigger={(open) => (
        <>
          <span>Thể loại</span>
          <ChevronDownIcon
            width={14}
            height={14}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </>
      )}
    >
      <Link
        to="/"
        className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
      >
        Tất cả thể loại
      </Link>
      {genres.map((g) => (
        <Link
          key={g}
          to={`/?genre=${encodeURIComponent(g)}`}
          className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
        >
          {g}
        </Link>
      ))}
    </NavPopover>
  );
}
