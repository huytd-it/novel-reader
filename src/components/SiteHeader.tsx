import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from './ui/Button';

/** Header đơn giản cho các trang ngoài Reader (Reader có toolbar riêng). */
export function SiteHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          to="/"
          className="font-display text-lg font-medium tracking-[-0.02em] text-ink-strong"
        >
          Đọc Truyện
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden font-mono text-xs text-ink-muted sm:inline">
                {user.email}
              </span>
              <Button variant="hairline" onClick={() => void signOut()}>
                Đăng xuất
              </Button>
            </>
          ) : (
            <Link to="/dang-nhap">
              <Button variant="solid">Đăng nhập</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
