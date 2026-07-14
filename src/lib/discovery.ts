/**
 * src/lib/discovery.ts
 * Dữ liệu cho trang chủ: truyện tuyển chọn (hero), xếp hạng Hot, thông báo.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { Announcement, Book, PopularBook } from './types';

/** Truyện được admin gắn cờ tuyển chọn (hero carousel). */
export async function fetchFeaturedBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('is_published', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

/** Bảng xếp hạng "Hot" theo cửa sổ ngày (RPC popular_books). */
export async function fetchPopularBooks(
  days = 7,
  limit = 10,
): Promise<PopularBook[]> {
  const { data, error } = await supabase.rpc('popular_books', {
    p_days: days,
    p_limit: limit,
  });
  if (error) throw new ApiError(500, error.message);
  return (data as PopularBook[]) ?? [];
}

/** Truyện đã hoàn thành — cho module "Hoàn thành". */
export async function fetchCompletedBooks(limit = 12): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('is_published', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

/** Thông báo đang bật (announcement bar). Lấy cái mới nhất. */
export async function fetchActiveAnnouncement(): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  return data;
}

// ---- Admin: quản lý thông báo ----

export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function createAnnouncement(
  message: string,
  kind: Announcement['kind'],
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .insert({ message: message.trim(), kind });
  if (error) throw new ApiError(500, error.message);
}

export async function setAnnouncementActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw new ApiError(500, error.message);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw new ApiError(500, error.message);
}
