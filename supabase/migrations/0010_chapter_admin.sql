-- 0010_chapter_admin.sql
-- Quản lý chương cho admin:
--   1. RLS cho admin SELECT (kể cả truyện nháp) / UPDATE / DELETE trực tiếp
--      bảng `chapters` từ client (xoá chương rác, sửa lẻ).
--   2. RPC admin_reindex_chapters: đánh lại toàn bộ index của một truyện
--      trong MỘT transaction, hai pha để né unique (book_id, index) —
--      update từng dòng một sẽ va constraint khi hoán đổi số.
-- Xoá chapter cascade sẵn chapter_contents + bookmarks + reading_progress
-- (FK on delete cascade, 0001).

drop policy if exists "admin select chapters" on chapters;
create policy "admin select chapters" on chapters
  for select using (public.is_admin());

drop policy if exists "admin update chapters" on chapters;
create policy "admin update chapters" on chapters
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete chapters" on chapters;
create policy "admin delete chapters" on chapters
  for delete using (public.is_admin());

-- p_items: jsonb mảng [{"id": "<uuid chương>", "index": <số mới>}, ...]
-- Phải phủ ĐỦ mọi chương của truyện (mapping thiếu/lệch → raise, rollback).
create or replace function public.admin_reindex_chapters(
  p_book_id uuid,
  p_items jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select count(*) into v_count from chapters where book_id = p_book_id;
  if v_count = 0 or v_count <> jsonb_array_length(p_items) then
    raise exception 'incomplete_mapping';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where (i->>'index')::int < 1
  ) then
    raise exception 'invalid_index';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) i
    group by (i->>'index')::int
    having count(*) > 1
  ) then
    raise exception 'duplicate_index';
  end if;

  -- Pha 1: đẩy toàn bộ index sang vùng âm (vẫn unique) để trống vùng dương.
  update chapters set index = -index where book_id = p_book_id;

  -- Pha 2: áp index mới theo mapping.
  update chapters c
  set index = (i->>'index')::int
  from jsonb_array_elements(p_items) i
  where c.id = (i->>'id')::uuid
    and c.book_id = p_book_id;

  -- Chương nào chưa được mapping đụng tới vẫn mang index âm → mapping thiếu.
  if exists (
    select 1 from chapters where book_id = p_book_id and index < 0
  ) then
    raise exception 'incomplete_mapping';
  end if;

  update books set chapter_count = v_count where id = p_book_id;
  return v_count;
end;
$$;

revoke all on function public.admin_reindex_chapters(uuid, jsonb) from public;
grant execute on function public.admin_reindex_chapters(uuid, jsonb)
  to authenticated;
