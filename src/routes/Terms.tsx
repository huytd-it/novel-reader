import { SiteHeader } from '@/components/SiteHeader';
import { Reveal } from '@/components/ui/Reveal';
import { useSeo } from '@/lib/seo';

// Trang tĩnh — nội dung điều khoản được Auth.tsx dẫn tới.
export default function Terms() {
  useSeo({
    title: 'Điều khoản sử dụng',
    description: 'Điều khoản sử dụng nền tảng đọc truyện chữ.',
  });
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
            Điều khoản sử dụng
          </p>
          <h1 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.03em] text-ink-strong md:text-4xl">
            Điều khoản sử dụng
          </h1>

          <div className="mt-10 space-y-10">
            <Section title="1. Về dịch vụ">
              Đây là nền tảng đọc truyện chữ trực tuyến. Chúng tôi cung cấp
              nội dung để bạn đọc trực tiếp trên trình duyệt, cùng các tiện
              ích như đồng bộ tiến độ đọc và đánh dấu chương khi bạn đăng
              nhập.
            </Section>

            <Section title="2. Tài khoản">
              Bạn có thể đọc các chương miễn phí mà không cần tài khoản. Khi
              đăng nhập (qua email hoặc Google), bạn chịu trách nhiệm về hoạt
              động diễn ra dưới tài khoản của mình. Chúng tôi chỉ lưu email,
              tên hiển thị và dữ liệu đọc (tiến độ, đánh dấu chương) để phục
              vụ chính bạn.
            </Section>

            <Section title="3. Sử dụng hợp lệ">
              Không sử dụng công cụ tự động để thu thập nội dung; không sao
              chép, phát tán lại nội dung truyện dưới bất kỳ hình thức nào.
              Hệ thống có cơ chế giới hạn tốc độ đọc và có thể tạm khóa các
              tài khoản có dấu hiệu tự động hóa.
            </Section>

            <Section title="4. Nội dung và bản quyền">
              Nội dung truyện thuộc về tác giả và các bên giữ bản quyền tương
              ứng. Nếu bạn là chủ sở hữu quyền và có yêu cầu liên quan đến
              nội dung đăng tải, vui lòng liên hệ để chúng tôi xử lý.
            </Section>

            <Section title="5. Thay đổi điều khoản">
              Điều khoản có thể được cập nhật theo thời gian. Việc tiếp tục
              sử dụng dịch vụ sau khi điều khoản thay đổi đồng nghĩa với việc
              bạn chấp nhận bản điều khoản mới.
            </Section>
          </div>
        </Reveal>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-[-0.02em] text-ink-strong">
        {title}
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
        {children}
      </p>
    </section>
  );
}
