import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { fetchMyRole } from '@/lib/api';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

/** Bọc mọi route /admin/*: chờ auth → yêu cầu đăng nhập → yêu cầu role admin. */
export function AdminGate({
  next,
  wide = false,
  children,
}: {
  next: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['my-role', user?.id],
    queryFn: () => fetchMyRole(user!.id),
    enabled: !!user,
  });

  if (authLoading || (user && roleLoading)) {
    return (
      <Shell wide={wide}>
        <Spinner label="Đang kiểm tra quyền…" />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell wide={wide}>
        <Gate
          title="Cần đăng nhập"
          body="Trang quản trị yêu cầu tài khoản admin."
          action={
            <Link to={`/dang-nhap?next=${next}`}>
              <Button variant="solid">Đăng nhập</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  if (role !== 'admin') {
    return (
      <Shell wide={wide}>
        <Gate
          title="Không có quyền"
          body="Tài khoản của bạn không phải admin. Liên hệ quản trị để được cấp quyền."
        />
      </Shell>
    );
  }

  return <Shell wide={wide}>{children}</Shell>;
}

function Shell({ wide, children }: { wide: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />
      <main className={`mx-auto px-6 py-14 ${wide ? 'max-w-5xl' : 'max-w-5xl'}`}>
        {children}
      </main>
    </div>
  );
}

function Gate({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
      <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink-strong">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
