-- 0007_discovery.sql
-- Trang chủ & khám phá: truyện tuyển chọn (hero), thanh thông báo, và
-- xếp hạng "Hot" suy từ read_events.

-- ------------------------------------------------------------------
-- Truyện tuyển chọn (hero carousel)
-- ------------------------------------------------------------------
-- Admin bật cờ này để đưa truyện lên hero. Admin đã có quyền UPDATE books
-- qua RLS "admin update books" (0003); books không revoke cột nào nên
-- không cần grant thêm. Người thường không UPDATE được books.
alter table books
  add column if not exists is_featured boolean not null default false;

create index if not exists books_featured_idx
  on books (is_featured) where is_featured;

-- ------------------------------------------------------------------
-- Thông báo (announcement bar)
-- ------------------------------------------------------------------
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  message text not null,
  kind text not null default 'info',          -- info | warning | success
  is_active boolean not null default true,
  created_at timestamptz default now()
);
alter table announcements
  drop constraint if exists announcements_kind_check;
alter table announcements
  add constraint announcements_kind_check check (kind in ('info', 'warning', 'success'));

alter table announcements enable row level security;

-- Ai cũng đọc được thông báo đang bật.
drop policy if exists "public active announcements" on announcements;
create policy "public active announcements" on announcements
  for select using (is_active = true);

-- Admin quản lý (thêm/sửa/xoá) — dùng is_admin() (0003).
drop policy if exists "admin select announcements" on announcements;
create policy "admin select announcements" on announcements
  for select using (public.is_admin());
drop policy if exists "admin insert announcements" on announcements;
create policy "admin insert announcements" on announcements
  for insert with check (public.is_admin());
drop policy if exists "admin update announcements" on announcements;
create policy "admin update announcements" on announcements
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete announcements" on announcements;
create policy "admin delete announcements" on announcements
  for delete using (public.is_admin());

-- ------------------------------------------------------------------
-- Xếp hạng "Hot" — suy từ read_events (bảng khóa RLS)
-- ------------------------------------------------------------------
-- read_events chỉ service role đọc được nên phải qua RPC. security definer
-- nhưng CHỈ trả truyện đã publish + số liệu tổng hợp (không lộ hàng thô,
-- không lộ user_id). Trend = so cửa sổ hiện tại với cửa sổ trước đó.
create or replace function public.popular_books(p_days int default 7, p_limit int default 10)
returns table (
  id uuid,
  slug text,
  title text,
  author text,
  cover_url text,
  status text,
  chapter_count int,
  reads bigint,
  trend text
)
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select least(greatest(coalesce(p_days, 7), 1), 90) as d
  ),
  cur as (
    select c.book_id, count(*)::bigint as n
    from read_events e
    join chapters c on c.id = e.chapter_id
    where e.created_at >= now() - make_interval(days => (select d from win))
    group by c.book_id
  ),
  prev as (
    select c.book_id, count(*)::bigint as n
    from read_events e
    join chapters c on c.id = e.chapter_id
    where e.created_at >= now() - make_interval(days => (select d from win) * 2)
      and e.created_at <  now() - make_interval(days => (select d from win))
    group by c.book_id
  )
  select
    b.id, b.slug, b.title, b.author, b.cover_url, b.status, b.chapter_count,
    cur.n as reads,
    case
      when coalesce(prev.n, 0) = 0 and cur.n > 0 then '↑'
      when cur.n > coalesce(prev.n, 0) then '↑'
      when cur.n < coalesce(prev.n, 0) then '↓'
      else '→'
    end as trend
  from cur
  join books b on b.id = cur.book_id and b.is_published
  left join prev on prev.book_id = cur.book_id
  order by cur.n desc, b.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

grant execute on function public.popular_books(int, int) to anon, authenticated;
