/**
 * src/lib/adminBooks.ts
 * Quản lý sách cho admin: xem toàn bộ (kể cả nháp), sửa metadata, xoá.
 * Không cần Edge Function — RLS (0003_admin_books_manage.sql) cho phép admin
 * (profiles.role='admin') tự SELECT/UPDATE/DELETE bảng `books` bằng JWT của
 * chính họ. Xoá 1 book cascade xoá chapters/chapter_contents liên quan.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { Book, BookStatus } from './types';

/** Toàn bộ book (kể cả nháp) — chỉ admin gọi được (RLS 0003). */
export async function fetchAllBooksForAdmin(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

/** 1 book theo id, không lọc is_published — dùng cho trang sửa. */
export async function fetchBookById(id: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  return data;
}

export interface UpdateBookInput {
  title?: string;
  author?: string | null;
  description?: string | null;
  genre?: string[] | null;
  status?: BookStatus;
  is_published?: boolean;
  is_featured?: boolean;
}

export async function updateBook(
  id: string,
  patch: UpdateBookInput,
): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  if (!data) throw new ApiError(404, 'Không tìm thấy truyện này (có thể đã bị xoá).');
  return data;
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw new ApiError(500, error.message);
}

/** Genre hiện có trên mọi book (kể cả nháp) — gợi ý khi admin gõ tag. */
export async function fetchDistinctGenres(): Promise<string[]> {
  const { data, error } = await supabase.from('books').select('genre');
  if (error) throw new ApiError(500, error.message);

  const set = new Set<string>();
  data?.forEach((row) => row.genre?.forEach((g: string) => set.add(g)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
}
