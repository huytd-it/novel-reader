-- 0001_init.sql
-- Schema + RLS cho web app đọc truyện.
-- Điểm mấu chốt: tách `chapters` (metadata, công khai) khỏi
-- `chapter_contents` (nội dung, gated) vì RLS là row-level.

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------
-- Bảng
-- ------------------------------------------------------------------

-- Người dùng
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  flagged boolean default false,      -- cờ nghi bot (set bởi get-chapter)
  created_at timestamptz default now()
);

-- Truyện
create table if not exists books (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  author text,
  cover_url text,
  description text,
  genre text[],
  status text default 'ongoing',      -- ongoing | completed
  is_published boolean default false,
  chapter_count int default 0,
  created_at timestamptz default now()
);

-- Chương: METADATA — công khai (cho mục lục + SEO)
create table if not exists chapters (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid not null references books(id) on delete cascade,
  index int not null,                 -- số thứ tự chương, bắt đầu từ 1
  title text not null,
  is_free boolean default false,      -- true = mở cho anon + Googlebot
  word_count int,
  created_at timestamptz default now(),
  unique (book_id, index)
);
create index if not exists chapters_book_index_idx on chapters (book_id, index);

-- Chương: NỘI DUNG — gated
create table if not exists chapter_contents (
  chapter_id uuid primary key references chapters(id) on delete cascade,
  content text not null               -- plain text, đoạn tách bằng \n\n
);

-- Tiến độ đọc
create table if not exists reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  scroll_pct real default 0,          -- 0.0 → 1.0
  updated_at timestamptz default now(),
  primary key (user_id, book_id)
);

-- Bookmark
create table if not exists bookmarks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  note text,
  created_at timestamptz default now()
);

-- Log đọc: phục vụ rate limit + phát hiện bot
create table if not exists read_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete set null,
  ip_hash text,
  created_at timestamptz default now()
);
create index if not exists read_events_user_idx on read_events (user_id, created_at desc);
create index if not exists read_events_ip_idx on read_events (ip_hash, created_at desc);

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------

alter table profiles          enable row level security;
alter table books             enable row level security;
alter table chapters          enable row level security;
alter table chapter_contents  enable row level security;
alter table reading_progress  enable row level security;
alter table bookmarks         enable row level security;
alter table read_events       enable row level security;

-- profiles: chỉ chính chủ
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- books: ai cũng xem được truyện đã publish
drop policy if exists "public books" on books;
create policy "public books" on books
  for select using (is_published = true);

-- chapters (metadata): công khai nếu truyện đã publish
drop policy if exists "public chapter meta" on chapters;
create policy "public chapter meta" on chapters
  for select using (
    exists (select 1 from books b where b.id = book_id and b.is_published)
  );

-- chapter_contents: CHỈ chương free mới lộ ra client.
-- Chương gated → không policy nào cho phép → chỉ service role đọc được.
drop policy if exists "free chapter content" on chapter_contents;
create policy "free chapter content" on chapter_contents
  for select using (
    exists (
      select 1 from chapters c
      join books b on b.id = c.book_id
      where c.id = chapter_id and c.is_free = true and b.is_published = true
    )
  );

-- reading_progress: chính chủ
drop policy if exists "own progress" on reading_progress;
create policy "own progress" on reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bookmarks: chính chủ
drop policy if exists "own bookmarks" on bookmarks;
create policy "own bookmarks" on bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- read_events: client không đọc/không ghi trực tiếp.
-- enable RLS, KHÔNG tạo policy nào = khóa hoàn toàn (chỉ service role).

-- ------------------------------------------------------------------
-- Tự tạo profile khi có user mới
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
