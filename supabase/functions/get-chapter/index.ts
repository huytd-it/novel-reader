// Edge Function: get-chapter
// Đường DUY NHẤT lấy nội dung chương gated.
// Luồng: verify JWT → rate limit → log read_events → trả nội dung.
//
// Deploy: supabase functions deploy get-chapter
// Secrets cần set:
//   supabase secrets set IP_HASH_SALT=<random 32 bytes>
//   (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY được Supabase inject sẵn)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IP_HASH_SALT = Deno.env.get('IP_HASH_SALT') ?? '';

// Client service-role: bỏ qua RLS để đọc chương gated + ghi read_events.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Ngưỡng rate limit (xem SPEC §6). Người đọc thật ~1–3 phút/chương.
const LIMIT_USER_PER_MIN = 20; // > 20 chương/phút → 429
const LIMIT_USER_PER_5MIN = 60; // > 60 chương/5 phút → 429 + cờ
const LIMIT_IP_PER_MIN = 10; // request anon: > 10/phút → 429

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let bookSlug: string;
  let chapterIndex: number;
  try {
    const body = await req.json();
    bookSlug = String(body.bookSlug);
    chapterIndex = Number(body.chapterIndex);
    if (!bookSlug || !Number.isFinite(chapterIndex)) {
      return json({ error: 'bad_request' }, 400);
    }
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // ---- 1. Xác thực JWT (nếu có) ----
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (token) {
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user) userId = data.user.id;
  }

  // ---- 2. Tìm truyện + chương ----
  const { data: book } = await admin
    .from('books')
    .select('id')
    .eq('slug', bookSlug)
    .eq('is_published', true)
    .maybeSingle();

  if (!book) return json({ error: 'not_found' }, 404);

  const { data: chapter } = await admin
    .from('chapters')
    .select('id, index, title, is_free')
    .eq('book_id', book.id)
    .eq('index', chapterIndex)
    .maybeSingle();

  if (!chapter) return json({ error: 'not_found' }, 404);

  // ---- 3. Gate: chương không free bắt buộc có user ----
  if (!chapter.is_free && !userId) {
    return json({ error: 'unauthorized' }, 401);
  }

  const ipHash = await sha256(getClientIp(req) + IP_HASH_SALT);

  // ---- 4. Rate limit ----
  const now = Date.now();
  const oneMinAgo = new Date(now - 60_000).toISOString();
  const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();

  if (userId) {
    const { count: perMin } = await admin
      .from('read_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneMinAgo);

    if ((perMin ?? 0) >= LIMIT_USER_PER_MIN) {
      return json({ error: 'rate_limited' }, 429);
    }

    const { count: per5Min } = await admin
      .from('read_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', fiveMinAgo);

    if ((per5Min ?? 0) >= LIMIT_USER_PER_5MIN) {
      // Gắn cờ tài khoản để review sau.
      await admin.from('profiles').update({ flagged: true }).eq('id', userId);
      return json({ error: 'rate_limited_flagged' }, 429);
    }
  } else {
    // Request anon (chương free): giới hạn theo IP.
    const { count: ipPerMin } = await admin
      .from('read_events')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', oneMinAgo);

    if ((ipPerMin ?? 0) >= LIMIT_IP_PER_MIN) {
      return json({ error: 'rate_limited' }, 429);
    }
  }

  // ---- 5. Log read_event ----
  await admin.from('read_events').insert({
    user_id: userId,
    chapter_id: chapter.id,
    ip_hash: ipHash,
  });

  // ---- 6. Lấy nội dung + prev/next ----
  const { data: contentRow } = await admin
    .from('chapter_contents')
    .select('content')
    .eq('chapter_id', chapter.id)
    .maybeSingle();

  if (!contentRow) return json({ error: 'not_found' }, 404);

  // prev/next: chỉ trả index tồn tại.
  const { data: neighbors } = await admin
    .from('chapters')
    .select('index')
    .eq('book_id', book.id)
    .in('index', [chapterIndex - 1, chapterIndex + 1]);

  const indices = new Set((neighbors ?? []).map((r) => r.index));
  const prevIndex = indices.has(chapterIndex - 1) ? chapterIndex - 1 : null;
  const nextIndex = indices.has(chapterIndex + 1) ? chapterIndex + 1 : null;

  return json({
    title: chapter.title,
    index: chapter.index,
    content: contentRow.content,
    prevIndex,
    nextIndex,
  });
});
