-- 0004_bookmarks.sql
-- Bookmark hoạt động theo kiểu toggle: mỗi user chỉ có 1 bookmark / chương.
-- Bảng + RLS "own bookmarks" đã có từ 0001; ở đây chỉ thêm ràng buộc unique
-- để upsert on_conflict (user_id, chapter_id) từ client không tạo trùng khi
-- double-tap / race.

-- Dọn trùng phòng hờ (bảng chưa từng có frontend nên thường rỗng).
delete from bookmarks a
  using bookmarks b
  where a.user_id = b.user_id
    and a.chapter_id = b.chapter_id
    and a.ctid < b.ctid;

create unique index if not exists bookmarks_user_chapter_uidx
  on bookmarks (user_id, chapter_id);
