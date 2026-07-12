import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center text-ink">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
        Lỗi 404
      </p>
      <h1 className="font-display text-5xl font-medium tracking-[-0.03em] text-ink-strong">
        Không tìm thấy trang
      </h1>
      <p className="text-sm text-ink-muted">
        Trang bạn cần có thể đã bị chuyển hoặc không tồn tại.
      </p>
      <Link to="/" className="mt-2">
        <Button variant="solid">Về thư viện</Button>
      </Link>
    </div>
  );
}
