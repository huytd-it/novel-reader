import { Link } from 'react-router-dom';
import { GenreMenu } from './nav/GenreMenu';
import { SearchBox } from './nav/SearchBox';
import { AccountMenu } from './nav/AccountMenu';
import { NotificationBell } from './nav/NotificationBell';

/** Header đơn giản cho các trang ngoài Reader (Reader có toolbar riêng). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          to="/"
          className="shrink-0 font-display text-lg font-medium tracking-[-0.02em] text-ink-strong"
        >
          Đọc Truyện
        </Link>
        <nav className="flex items-center gap-3">
          <GenreMenu />
          <SearchBox />
          <NotificationBell />
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
