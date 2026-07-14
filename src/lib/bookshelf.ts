/**
 * src/lib/bookshelf.ts
 * Tủ sách phân loại thủ công (Đang đọc / Muốn đọc / Đã đọc) — bảng book_lists
 * (0008), RLS own-rows. Khác reading_progress: đây là do user chủ động xếp.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { BookListEntry, BookListStatus } from './types';

export async function fetchBookListStatus(
  bookId: string,
): Promise<BookListStatus | null> {
  const { data, error } = await supabase
    .from('book_lists')
    .select('status')
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  return (data?.status as BookListStatus | undefined) ?? null;
}

export async function setBookListStatus(
  bookId: string,
  status: BookListStatus,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Cần đăng nhập.');

  const { error } = await supabase.from('book_lists').upsert(
    {
      user_id: user.id,
      book_id: bookId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' },
  );
  if (error) throw new ApiError(500, error.message);
}

export async function removeFromBookList(bookId: string): Promise<void> {
  const { error } = await supabase
    .from('book_lists')
    .delete()
    .eq('book_id', bookId);
  if (error) throw new ApiError(500, error.message);
}

/** Tủ sách của user theo trạng thái, kèm metadata truyện. */
export async function fetchMyBookList(
  status: BookListStatus,
): Promise<BookListEntry[]> {
  const { data, error } = await supabase
    .from('book_lists')
    .select('*, book:books(*)')
    .eq('status', status)
    .order('updated_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  const rows = (data as unknown as BookListEntry[]) ?? [];
  return rows.filter((r) => r.book);
}
