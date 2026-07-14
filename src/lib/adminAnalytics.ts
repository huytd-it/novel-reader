/**
 * src/lib/adminAnalytics.ts
 * Thống kê cho admin. read_events bị khóa RLS hoàn toàn (0001) nên số liệu
 * đi qua RPC security definer guard bằng is_admin() (0006). List tài khoản
 * bị gắn cờ đọc qua policy "admin select profiles" (0006); gắn/gỡ cờ phải
 * qua RPC vì cột flagged không grant update cho authenticated.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { Profile, ReadsPerBook, ReadsPerDay } from './types';

export async function fetchReadsPerDay(days = 30): Promise<ReadsPerDay[]> {
  const { data, error } = await supabase.rpc('admin_reads_per_day', {
    p_days: days,
  });
  if (error) throw new ApiError(500, error.message);
  return (data as ReadsPerDay[]) ?? [];
}

export async function fetchReadsPerBook(days = 30): Promise<ReadsPerBook[]> {
  const { data, error } = await supabase.rpc('admin_reads_per_book', {
    p_days: days,
  });
  if (error) throw new ApiError(500, error.message);
  return (data as ReadsPerBook[]) ?? [];
}

export async function fetchFlaggedProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('flagged', true)
    .order('created_at', { ascending: false });

  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function setFlagged(
  userId: string,
  flagged: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_flagged', {
    p_user_id: userId,
    p_flagged: flagged,
  });
  if (error) throw new ApiError(500, error.message);
}
