import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail sớm, rõ ràng — tránh lỗi mờ mịt lúc runtime.
  throw new Error(
    'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Sao chép .env.local.example → .env.local và điền giá trị.',
  );
}

/**
 * Client Supabase dùng anon key.
 * QUAN TRỌNG: không bao giờ dùng client này để SELECT trực tiếp
 * `chapter_contents` cho chương gated — nội dung gated chỉ đi qua
 * Edge Function `get-chapter` (xem lib/api.ts). RLS sẽ chặn, nhưng
 * quy ước này giữ cho luồng dữ liệu rõ ràng.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // cần cho magic link + OAuth redirect
  },
});
