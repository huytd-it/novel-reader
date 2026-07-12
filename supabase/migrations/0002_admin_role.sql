-- 0002_admin_role.sql
-- Thêm vai trò admin cho profiles + khóa để client không tự nâng quyền.
--
-- Admin dùng cho luồng nhập truyện qua UI (Edge Function `admin-import`):
-- cả route guard ở frontend lẫn function đều đọc `profiles.role`.
-- Đặt một user thành admin bằng SQL (service role / SQL Editor):
--   update public.profiles set role = 'admin' where id = '<user-uuid>';

alter table public.profiles
  add column if not exists role text not null default 'user';  -- 'user' | 'admin'

-- Chốt giá trị hợp lệ.
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

-- QUAN TRỌNG: policy "own profile" (0001) cho phép user UPDATE hàng của chính
-- mình → nếu không chặn, user tự set role='admin'. RLS không so sánh được giá
-- trị cũ/mới, nên chặn ở tầng quyền cột.
--
-- Supabase mặc định GRANT toàn quyền bảng cho anon/authenticated, nên quyền
-- UPDATE ở mức BẢNG phủ mọi cột → revoke riêng cột `role` sẽ vô hiệu. Cách
-- đúng: thu hồi UPDATE mức bảng, rồi cấp lại UPDATE cho đúng cột an toàn.
-- Sau đó chỉ service role (bỏ qua GRANT) mới đặt được `role`.
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;
