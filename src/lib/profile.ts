/**
 * src/lib/profile.ts
 * Hồ sơ người dùng. RLS "own profile" (0001) + grant cột (0002):
 * user chỉ UPDATE được đúng cột display_name — các cột role/flagged
 * chỉ service role đặt được.
 */

import { supabase } from './supabase';
import { ApiError } from './api';
import type { Profile } from './types';

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() || null })
    .eq('id', userId);

  if (error) throw new ApiError(500, error.message);
}
