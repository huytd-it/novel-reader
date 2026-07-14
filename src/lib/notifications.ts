/**
 * src/lib/notifications.ts
 * Thông báo in-app (0008). Client chỉ đọc / đánh dấu đã đọc / xoá — việc tạo
 * do trigger DB đảm nhiệm khi có chương mới.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { AppNotification } from './types';

export async function fetchMyNotifications(
  limit = 20,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, book:books(slug), chapter:chapters(index)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new ApiError(500, error.message);
  return (data as unknown as AppNotification[]) ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw new ApiError(500, error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
  if (error) throw new ApiError(500, error.message);
}
