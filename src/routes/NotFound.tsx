import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-serif text-3xl font-medium">404</h1>
      <p className="text-sm text-muted">Không tìm thấy trang bạn cần.</p>
      <Link to="/" className="mt-2">
        <Button>Về thư viện</Button>
      </Link>
    </div>
  );
}
