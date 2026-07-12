import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchMyRole } from '@/lib/api';
import { Button } from './ui/Button';

/** Header đơn giản cho các trang ngoài Reader (Reader có toolbar riêng). */
export function SiteHeader() {
  const { user, signOut } = useAuth();

  // Cùng queryKey với route admin → react-query cache dùng chung.
  const { data: role } = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: () => fetchMyRole(user!.id),
    enabled: !!user,
  });

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
              {role === 'admin' && (
                <Link
                  to="/admin/import"
                  className="hidden font-mono text-xs uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-ink sm:inline"
                >
                  Nhập truyện
                </Link>
              )}
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
