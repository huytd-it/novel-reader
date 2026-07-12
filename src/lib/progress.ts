import { supabase } from './supabase';
import type { ReadingProgress } from './types';

/**
 * Lưu tiến độ đọc.
 * - Trong lúc đọc: gọi `saveProgressDebounced` (debounce 2s).
 * - Khi rời trang: gọi `flushProgressBeacon` (navigator.sendBeacon) để
 *   ghi kịp trước khi tab đóng.
 */

interface ProgressPayload {
  book_id: string;
  chapter_id: string;
  scroll_pct: number;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: ProgressPayload | null = null;

export function saveProgressDebounced(payload: ProgressPayload, delay = 2000) {
  pending = payload;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void writeProgress(payload);
    timer = null;
    pending = null;
  }, delay);
}

async function writeProgress(payload: ProgressPayload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // khách vãng lai: không lưu cross-device

  await supabase.from('reading_progress').upsert(
    {
      user_id: user.id,
      book_id: payload.book_id,
      chapter_id: payload.chapter_id,
      scroll_pct: payload.scroll_pct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' },
  );
}

/**
 * Ghi tiến độ đang chờ ngay lập tức khi rời trang.
 *
 * Dùng `fetch` với `keepalive: true` (KHÔNG dùng navigator.sendBeacon):
 * sendBeacon không cho set header `Authorization`, mà RLS của
 * `reading_progress` cần JWT của user (auth.uid() = user_id). keepalive
 * vừa cho gắn header, vừa sống sót qua unload (payload nhỏ, dưới 64KB).
 */
export function flushProgressBeacon(
  accessToken: string | undefined,
  supabaseUrl: string,
  anonKey: string,
  userId: string,
) {
  if (!pending || !accessToken) return;

  const body = JSON.stringify({
    user_id: userId,
    book_id: pending.book_id,
    chapter_id: pending.chapter_id,
    scroll_pct: pending.scroll_pct,
    updated_at: new Date().toISOString(),
  });

  // PostgREST upsert: on_conflict + Prefer resolution=merge-duplicates.
  const url = `${supabaseUrl}/rest/v1/reading_progress?on_conflict=user_id,book_id`;

  void fetch(url, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'resolution=merge-duplicates',
    },
    body,
  });
}

export async function fetchProgress(
  bookId: string,
): Promise<ReadingProgress | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle();

  return data;
}
