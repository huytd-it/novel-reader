-- 0003_admin_books_manage.sql
-- Cho phép admin (profiles.role='admin') SELECT toàn bộ books (kể cả nháp),
-- UPDATE metadata, và DELETE trực tiếp từ client qua RLS. Không cần Edge
-- Function: đây chỉ là thao tác trên bảng `books`, không đụng Storage, không
-- cần thay hàng loạt chapters (khác admin-import). FK books->chapters->
-- chapter_contents đã có `on delete cascade` (0001), nên xoá 1 book tự dọn
-- sạch chapters + chapter_contents + reading_progress + bookmarks liên quan.
-- (Không tự xoá ảnh bìa trong Storage bucket `covers` — chấp nhận orphan ở v1.)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- SELECT: kết hợp OR với "public books" (0001) → admin thấy mọi book,
-- người khác vẫn chỉ thấy book published.
drop policy if exists "admin select all books" on books;
create policy "admin select all books" on books
  for select using (public.is_admin());

drop policy if exists "admin update books" on books;
create policy "admin update books" on books
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete books" on books;
create policy "admin delete books" on books
  for delete using (public.is_admin());
