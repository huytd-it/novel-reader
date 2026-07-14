-- 0008_bookshelf_follow.sql
-- Tủ sách phân loại, theo dõi truyện, và thông báo chương mới (in-app).

-- ------------------------------------------------------------------
-- Tủ sách: phân loại thủ công (Đang đọc / Muốn đọc / Đã đọc)
-- ------------------------------------------------------------------
create table if not exists book_lists (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  status text not null,                 -- reading | want | read
  updated_at timestamptz default now(),
  primary key (user_id, book_id)
);
alter table book_lists
  drop constraint if exists book_lists_status_check;
alter table book_lists
  add constraint book_lists_status_check check (status in ('reading', 'want', 'read'));

alter table book_lists enable row level security;
drop policy if exists "own book_lists" on book_lists;
create policy "own book_lists" on book_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Theo dõi truyện
-- ------------------------------------------------------------------
create table if not exists follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, book_id)
);
create index if not exists follows_book_idx on follows (book_id);

alter table follows enable row level security;
drop policy if exists "own follows" on follows;
create policy "own follows" on follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Thông báo in-app
-- ------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete set null,
  kind text not null default 'new_chapter',   -- new_chapter | system
  title text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;
-- Chính chủ ĐỌC / cập nhật (đánh dấu đã đọc) / xoá. KHÔNG có policy INSERT →
-- client không tự tạo được; chỉ trigger security definer bên dưới ghi vào.
drop policy if exists "own notifications select" on notifications;
create policy "own notifications select" on notifications
  for select using (auth.uid() = user_id);
drop policy if exists "own notifications update" on notifications;
create policy "own notifications update" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own notifications delete" on notifications;
create policy "own notifications delete" on notifications
  for delete using (auth.uid() = user_id);

-- Chương mới → fanout thông báo cho người theo dõi. security definer để ghi
-- được vào notifications (bảng không có policy INSERT cho user thường).
create or replace function public.notify_followers_new_chapter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, book_id, chapter_id, kind, title)
  select f.user_id, b.id, new.id, 'new_chapter',
         b.title || ' — Chương ' || new.index
  from follows f
  join books b on b.id = new.book_id
  where f.book_id = new.book_id;
  return new;
end;
$$;

drop trigger if exists on_chapter_insert on chapters;
create trigger on_chapter_insert
  after insert on chapters
  for each row execute function public.notify_followers_new_chapter();

-- Bật Realtime cho notifications (chuông cập nhật tức thì). An toàn vì RLS
-- vẫn lọc theo user_id ở tầng realtime.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications;
  end if;
exception when duplicate_object then
  null;
end;
$$;
