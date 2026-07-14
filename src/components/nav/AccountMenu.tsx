import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchMyRole } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { UserIcon } from '@/components/ui/icons';
import { NavPopover } from './NavPopover';

export function AccountMenu() {
  const { user, signOut } = useAuth();

  // Cùng queryKey với AdminGate → react-query cache dùng chung.
  const { data: role } = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: () => fetchMyRole(user!.id),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Link to="/dang-nhap">
        <Button variant="solid">Đăng nhập</Button>
      </Link>
    );
  }

  return (
    <NavPopover
      align="right"
      triggerClassName="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink"
      trigger={() => (
        <>
          <span className="hidden font-mono text-xs sm:inline">{user.email}</span>
          <UserIcon width={20} height={20} className="sm:hidden" />
        </>
      )}
    >
      <div className="truncate px-3 py-1.5 font-mono text-xs text-ink-muted sm:hidden">
        {user.email}
      </div>
      <Link
        to="/tai-khoan"
        className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
      >
        Tài khoản
      </Link>
      {role === 'admin' && (
        <>
          <Link
            to="/admin/import"
            className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
          >
            Nhập truyện
          </Link>
          <Link
            to="/admin/books"
            className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
          >
            Quản lý truyện
          </Link>
          <Link
            to="/admin/analytics"
            className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
          >
            Thống kê
          </Link>
          <Link
            to="/admin/announcements"
            className="block rounded-md px-3 py-1.5 text-sm text-ink transition-colors hover:bg-canvas"
          >
            Thông báo
          </Link>
          <div className="my-1 border-t border-hairline" />
        </>
      )}
      <button
        onClick={() => void signOut()}
        className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-canvas"
      >
        Đăng xuất
      </button>
    </NavPopover>
  );
}
