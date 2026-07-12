// Edge Function: admin-import
// Nhập một truyện (EPUB đã parse ở client) vào DB bằng service role.
// Chỉ user có profiles.role = 'admin' mới gọi được.
//
// Luồng: verify JWT → check admin → upload bìa → upsert book →
//        thay toàn bộ chapters + chapter_contents → cập nhật chapter_count.
//
// Deploy: supabase functions deploy admin-import --no-verify-jwt
//   (tự verify JWT trong code để trả JSON lỗi rõ ràng; SUPABASE_URL &
//    SUPABASE_SERVICE_ROLE_KEY được Supabase inject sẵn.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const COVER_BUCKET = 'covers';

// Client service-role: bỏ qua RLS để ghi books/chapters/contents + storage.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface InChapter {
  title: string;
  content: string;
}
interface InCover {
  base64: string;
  contentType: string;
  ext: string;
}
interface Payload {
  slug: string;
  title?: string;
  author?: string;
  free: number;
  publish: boolean;
  chapters: InChapter[];
  cover?: InCover | null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Đọc + kiểm tra payload. Trả lỗi (string) nếu không hợp lệ. */
function parsePayload(body: unknown): { data?: Payload; error?: string } {
  if (typeof body !== 'object' || body === null) return { error: 'bad_body' };
  const b = body as Record<string, unknown>;

  const slug = String(b.slug ?? '').trim();
  if (!SLUG_RE.test(slug)) return { error: 'invalid_slug' };

  if (!Array.isArray(b.chapters) || b.chapters.length === 0) {
    return { error: 'no_chapters' };
  }
  const chapters: InChapter[] = [];
  for (const c of b.chapters) {
    const title = String((c as InChapter)?.title ?? '').trim();
    const content = String((c as InChapter)?.content ?? '');
    if (!title || !content.trim()) return { error: 'empty_chapter' };
    chapters.push({ title, content });
  }

  const free = Number(b.free ?? 0);
  if (!Number.isFinite(free) || free < 0) return { error: 'invalid_free' };

  let cover: InCover | null = null;
  if (b.cover && typeof b.cover === 'object') {
    const cv = b.cover as Record<string, unknown>;
    const base64 = String(cv.base64 ?? '');
    const contentType = String(cv.contentType ?? '');
    const ext = String(cv.ext ?? '').replace(/[^a-z0-9]/gi, '') || 'jpg';
    if (base64) cover = { base64, contentType: contentType || 'image/jpeg', ext };
  }

  return {
    data: {
      slug,
      title: b.title ? String(b.title) : undefined,
      author: b.author ? String(b.author) : undefined,
      free,
      publish: b.publish === true,
      chapters,
      cover,
    },
  };
}

async function uploadCover(
  slug: string,
  cover: InCover,
): Promise<string | null> {
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === COVER_BUCKET)) {
    const { error } = await admin.storage.createBucket(COVER_BUCKET, {
      public: true,
    });
    if (error) {
      console.error('createBucket:', error.message);
      return null;
    }
  }
  const path = `${slug}.${cover.ext}`;
  const { error } = await admin.storage
    .from(COVER_BUCKET)
    .upload(path, base64ToBytes(cover.base64), {
      contentType: cover.contentType,
      upsert: true,
    });
  if (error) {
    console.error('upload cover:', error.message);
    return null;
  }
  return admin.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // ---- 1. Xác thực JWT (bắt buộc) ----
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // ---- 2. Chỉ admin ----
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role !== 'admin') return json({ error: 'forbidden' }, 403);

  // ---- 3. Validate payload ----
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'bad_body' }, 400);
  }
  const { data: payload, error: perr } = parsePayload(raw);
  if (!payload) return json({ error: perr }, 400);

  const title = payload.title ?? '';
  const author = payload.author ?? null;

  // ---- 4. Upload bìa (nếu có) ----
  let coverUrl: string | null = null;
  if (payload.cover) {
    coverUrl = await uploadCover(payload.slug, payload.cover);
  }

  // ---- 5. Upsert book ----
  const bookRow: Record<string, unknown> = {
    slug: payload.slug,
    title: title || payload.slug,
    author,
    is_published: payload.publish,
    chapter_count: payload.chapters.length,
  };
  if (coverUrl) bookRow.cover_url = coverUrl;

  const { data: book, error: bookErr } = await admin
    .from('books')
    .upsert(bookRow, { onConflict: 'slug' })
    .select('id')
    .single();
  if (bookErr || !book) {
    console.error('upsert book:', bookErr?.message);
    return json({ error: 'db_book', detail: bookErr?.message }, 500);
  }

  // ---- 6. Thay toàn bộ chương (cascade xóa chapter_contents) ----
  await admin.from('chapters').delete().eq('book_id', book.id);

  const metaRows = payload.chapters.map((ch, i) => ({
    book_id: book.id,
    index: i + 1,
    title: ch.title,
    is_free: i + 1 <= payload.free,
    word_count: countWords(ch.content),
  }));

  // Insert metadata theo lô, lấy id để ghép nội dung.
  const idByIndex = new Map<number, string>();
  for (const batch of chunk(metaRows, 200)) {
    const { data: inserted, error: chErr } = await admin
      .from('chapters')
      .insert(batch)
      .select('id, index');
    if (chErr || !inserted) {
      console.error('insert chapters:', chErr?.message);
      return json({ error: 'db_chapters', detail: chErr?.message }, 500);
    }
    for (const row of inserted) idByIndex.set(row.index, row.id);
  }

  const contentRows = payload.chapters.map((ch, i) => ({
    chapter_id: idByIndex.get(i + 1)!,
    content: ch.content,
  }));
  for (const batch of chunk(contentRows, 100)) {
    const { error: cErr } = await admin.from('chapter_contents').insert(batch);
    if (cErr) {
      console.error('insert contents:', cErr.message);
      return json({ error: 'db_contents', detail: cErr.message }, 500);
    }
  }

  return json({
    bookId: book.id,
    slug: payload.slug,
    chapters: payload.chapters.length,
    coverUrl,
    published: payload.publish,
  });
});
