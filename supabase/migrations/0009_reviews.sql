-- 0009_reviews.sql
-- Đánh giá (sao) + review. Chống spam: phải đọc đủ số chương mới được review.
-- Điểm trung bình denormalize vào books để hiện nhanh trên card.

-- Điểm tổng hợp trên books (cập nhật bởi trigger bên dưới).
alter table books add column if not exists rating_avg numeric(3, 2);
alter table books add column if not exists rating_count int not null default 0;

create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  rating int not null,
  body text,
  author_name text,                     -- denormalize để hiện tên không lộ profiles
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, book_id)
);
alter table reviews
  drop constraint if exists reviews_rating_check;
alter table reviews
  add constraint reviews_rating_check check (rating between 1 and 5);
create index if not exists reviews_book_idx on reviews (book_id, created_at desc);

-- Đã đọc đủ chưa? (đọc chương có index >= p_min). security definer để đọc
-- reading_progress của chính user trong policy without exposing bảng.
create or replace function public.has_read_enough(p_book_id uuid, p_min int default 3)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from reading_progress rp
    join chapters c on c.id = rp.chapter_id
    where rp.user_id = auth.uid()
      and rp.book_id = p_book_id
      and c.index >= p_min
  );
$$;
grant execute on function public.has_read_enough(uuid, int) to authenticated;

alter table reviews enable row level security;

-- Ai cũng đọc được review.
drop policy if exists "public reviews" on reviews;
create policy "public reviews" on reviews for select using (true);

-- Viết review: chính chủ + đã đọc >= 3 chương (chống spam).
drop policy if exists "insert own review" on reviews;
create policy "insert own review" on reviews
  for insert with check (
    auth.uid() = user_id and public.has_read_enough(book_id, 3)
  );

drop policy if exists "update own review" on reviews;
create policy "update own review" on reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own review" on reviews;
create policy "delete own review" on reviews
  for delete using (auth.uid() = user_id);

-- Cập nhật điểm tổng hợp trên books. security definer vì user thường không
-- UPDATE được books.
create or replace function public.refresh_book_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bid uuid := coalesce(new.book_id, old.book_id);
begin
  update books set
    rating_avg = (select round(avg(rating)::numeric, 2) from reviews where book_id = bid),
    rating_count = (select count(*) from reviews where book_id = bid)
  where id = bid;
  return null;
end;
$$;

drop trigger if exists reviews_aggregate on reviews;
create trigger reviews_aggregate
  after insert or update or delete on reviews
  for each row execute function public.refresh_book_rating();
