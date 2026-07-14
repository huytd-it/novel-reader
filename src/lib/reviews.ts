/**
 * src/lib/reviews.ts
 * Đánh giá + review (0009). Public đọc; chính chủ viết (cần đọc >= 3 chương).
 * Tên người đánh giá lưu denormalize (author_name) nên không phải lộ profiles.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { Review } from './types';

export async function fetchBookReviews(bookId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function fetchMyReview(bookId: string): Promise<Review | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('book_id', bookId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function upsertReview(
  bookId: string,
  rating: number,
  body: string,
  authorName: string | null,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Cần đăng nhập để đánh giá.');

  const { error } = await supabase.from('reviews').upsert(
    {
      user_id: user.id,
      book_id: bookId,
      rating,
      body: body.trim() || null,
      author_name: authorName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' },
  );
  if (error) {
    // RLS chặn khi chưa đọc đủ chương.
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      throw new ApiError(403, 'Cần đọc ít nhất 3 chương để đánh giá truyện này.');
    }
    throw new ApiError(500, error.message);
  }
}

export async function deleteReview(bookId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('book_id', bookId)
    .eq('user_id', user.id);
  if (error) throw new ApiError(500, error.message);
}
