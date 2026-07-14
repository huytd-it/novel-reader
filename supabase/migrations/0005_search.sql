-- 0005_search.sql
-- Tìm kiếm server-side, không phân biệt dấu, cho bảng books.
--
-- Client đang lọc in-memory bằng stripDiacritics (src/lib/text.ts):
-- NFD-strip + đ→d + lowercase. Phía SQL phải chuẩn hóa Y HỆT để hành vi
-- tìm kiếm nhất quán → f_unaccent = unaccent + đ→d + lower.
--
-- Chọn pg_trgm (substring match) thay vì FTS: giữ nguyên UX contains-match
-- hiện tại, tiếng Việt không có stemmer, catalog nhỏ-vừa nên trigram đủ.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() gốc là STABLE nên không index được; wrapper 2-arg với dictionary
-- tường minh thì IMMUTABLE-safe.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select lower(
    extensions.unaccent(
      'extensions.unaccent'::regdictionary,
      replace(replace($1, 'đ', 'd'), 'Đ', 'D')
    )
  )
$$;

-- Index trigram trên đúng biểu thức mà search_books lọc.
create index if not exists books_search_trgm_idx on books
  using gin (
    public.f_unaccent(
      title || ' ' || coalesce(author, '') || ' ' || coalesce(description, '')
    ) extensions.gin_trgm_ops
  );

-- SECURITY INVOKER (mặc định): RLS của books tự áp dụng → anon/user chỉ
-- thấy truyện đã publish, admin thấy tất (policy 0003) — đúng như đọc bảng.
create or replace function public.search_books(
  p_query text,
  p_limit int default 24,
  p_offset int default 0
)
returns setof books
language sql
stable
set search_path = public, extensions
as $$
  select *
  from books
  where is_published
    and f_unaccent(title || ' ' || coalesce(author, '') || ' ' || coalesce(description, ''))
        like '%' || f_unaccent(p_query) || '%'
  order by
    similarity(f_unaccent(title), f_unaccent(p_query)) desc,
    created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

grant execute on function public.search_books(text, int, int) to anon, authenticated;
