/**
 * src/lib/bookmarks.ts
 * Đánh dấu chương (bookmark). Bảng + RLS "own bookmarks" có từ 0001;
 * unique (user_id, chapter_id) từ 0004 → toggle an toàn qua upsert.
 * RLS đã scope về hàng của chính user nên không cần filter user_id khi đọc.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { Bookmark, BookmarkWithContext } from './types';

/** Bookmark của user hiện tại trên 1 chương (nếu có). */
export async function fetchBookmarkForChapter(
  chapterId: string,
): Promise<Bookmark | null> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('chapter_id', chapterId)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  return data;
}

/**
 * Toàn bộ bookmark của user, kèm chương + truyện để hiển thị và deep-link.
 * Truyện unpublish → embed book = null (RLS books) → lọc bỏ.
 */
export async function fetchMyBookmarks(): Promise<BookmarkWithContext[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(
      '*, chapter:chapters(id, index, title, book:books(id, slug, title, cover_url))',
    )
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(500, error.message);
  const rows = (data as unknown as BookmarkWithContext[]) ?? [];
  return rows.filter((b) => b.chapter?.book);
}

/** Thêm bookmark (upsert để double-tap / race không tạo trùng). */
export async function addBookmark(
  chapterId: string,
  note?: string,
): Promise<Bookmark> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Cần đăng nhập để đánh dấu chương.');

  const { data, error } = await supabase
    .from('bookmarks')
    .upsert(
      { user_id: user.id, chapter_id: chapterId, note: note ?? null },
      { onConflict: 'user_id,chapter_id' },
    )
    .select('*')
    .single();

  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function removeBookmark(id: string): Promise<void> {
  const { error } = await supabase.from('bookmarks').delete().eq('id', id);
  if (error) throw new ApiError(500, error.message);
}

export async function updateBookmarkNote(
  id: string,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from('bookmarks')
    .update({ note: note.trim() || null })
    .eq('id', id);
  if (error) throw new ApiError(500, error.message);
}
