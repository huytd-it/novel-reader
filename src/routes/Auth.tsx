import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Turnstile } from '@/components/Turnstile';
import { Button } from '@/components/ui/Button';
import { GoogleIcon } from '@/components/ui/icons';

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const needsCaptcha = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Đã đăng nhập → về trang đích.
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const redirectTo = `${window.location.origin}${next}`;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (needsCaptcha && !captchaToken) {
      setErrorMsg('Vui lòng hoàn tất xác minh chống bot.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setBusy(false);
    if (error) setErrorMsg(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // Turnstile không áp cho OAuth redirect; bảo vệ ở Cloudflare WAF.
      },
    });
    if (error) setErrorMsg(error.message);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 block text-center font-sans text-lg font-semibold"
        >
          Đọc Truyện
        </Link>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="mb-1 font-serif text-xl font-medium">Đăng nhập</h1>
          <p className="mb-5 text-sm text-muted">
            Để đồng bộ tiến độ đọc trên mọi thiết bị.
          </p>

          {sent ? (
            <div className="rounded-lg border border-border bg-bg p-4 text-sm">
              <p className="font-medium">Đã gửi liên kết đăng nhập ✓</p>
              <p className="mt-1 text-muted">
                Kiểm tra hộp thư <strong>{email}</strong> và bấm vào liên kết để
                vào đọc.
              </p>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void signInWithGoogle()}
              >
                <GoogleIcon />
                Tiếp tục với Google
              </Button>

              <div className="my-4 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                hoặc
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@cua-ban.com"
                  autoComplete="email"
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />

                {needsCaptcha && (
                  <Turnstile
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                  />
                )}

                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Đang gửi…' : 'Gửi liên kết đăng nhập'}
                </Button>
              </form>
            </>
          )}

          {errorMsg && (
            <p className="mt-3 text-sm text-red-500">{errorMsg}</p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Bằng việc đăng nhập, bạn đồng ý với điều khoản sử dụng.
        </p>
      </div>
    </div>
  );
}
