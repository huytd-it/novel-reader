-- 0006_admin_analytics.sql
-- Thống kê cho admin (/admin/analytics) + quản lý cờ nghi bot.
--
-- read_events bật RLS KHÔNG policy (0001) — chỉ service role đọc được —
-- nên client admin phải đi qua RPC security definer, guard bằng is_admin()
-- (0003). Aggregate ngay trong SQL cũng rẻ hơn nhiều so với trả raw rows.
--
-- flagged KHÔNG được grant update cho authenticated: policy "own profile"
-- (0001) cho update hàng của chính mình → user bị flag sẽ tự gỡ cờ được.
-- Vì vậy flag/unflag cũng phải qua RPC security definer.

-- Aggregate theo ngày cần quét theo created_at (index 0001 chỉ có
-- (user_id, created_at) và (ip_hash, created_at)).
create index if not exists read_events_created_idx
  on read_events (created_at desc);

-- Admin xem được mọi profile (list tài khoản bị gắn cờ). Chỉ SELECT.
drop policy if exists "admin select profiles" on profiles;
create policy "admin select profiles" on profiles
  for select using (public.is_admin());

-- Lượt đọc theo ngày.
create or replace function public.admin_reads_per_day(p_days int default 30)
returns table (day date, total bigint, unique_users bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select e.created_at::date, count(*), count(distinct e.user_id)
    from read_events e
    where e.created_at >= now() - make_interval(days => least(coalesce(p_days, 30), 90))
    group by 1
    order by 1;
end;
$$;

-- Lượt đọc theo truyện.
create or replace function public.admin_reads_per_book(p_days int default 30)
returns table (book_id uuid, title text, slug text, total bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select b.id, b.title, b.slug, count(*)
    from read_events e
    join chapters c on c.id = e.chapter_id
    join books b on b.id = c.book_id
    where e.created_at >= now() - make_interval(days => least(coalesce(p_days, 30), 90))
    group by b.id, b.title, b.slug
    order by count(*) desc;
end;
$$;

-- Gắn / gỡ cờ nghi bot.
create or replace function public.admin_set_flagged(p_user_id uuid, p_flagged boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update profiles set flagged = p_flagged where id = p_user_id;
end;
$$;

revoke all on function public.admin_reads_per_day(int) from public;
revoke all on function public.admin_reads_per_book(int) from public;
revoke all on function public.admin_set_flagged(uuid, boolean) from public;
grant execute on function public.admin_reads_per_day(int) to authenticated;
grant execute on function public.admin_reads_per_book(int) to authenticated;
grant execute on function public.admin_set_flagged(uuid, boolean) to authenticated;
