/**
 * src/lib/follows.ts
 * Theo dõi truyện (follows, 0008). Khi có chương mới, trigger DB tạo
 * notification cho người theo dõi.
 */

import { supabase } from './supabase';
import { ApiError } from './api';

export async function isFollowing(bookId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('book_id')
    .eq('book_id', bookId)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  return !!data;
}

export async function followBook(bookId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Cần đăng nhập để theo dõi.');

  const { error } = await supabase
    .from('follows')
    .upsert(
      { user_id: user.id, book_id: bookId },
      { onConflict: 'user_id,book_id' },
    );
  if (error) throw new ApiError(500, error.message);
}

export async function unfollowBook(bookId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('book_id', bookId);
  if (error) throw new ApiError(500, error.message);
}
