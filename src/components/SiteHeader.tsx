import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from './ui/Button';

/** Header đơn giản cho các trang ngoài Reader (Reader có toolbar riêng). */
export function SiteHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link to="/" className="font-sans text-base font-semibold tracking-tight">
          Đọc Truyện
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted sm:inline">
                {user.email}
              </span>
              <Button variant="ghost" onClick={() => void signOut()}>
                Đăng xuất
              </Button>
            </>
          ) : (
            <Link to="/dang-nhap">
              <Button variant="outline">Đăng nhập</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
