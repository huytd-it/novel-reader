// Edge Function: admin-import
// Nhập một truyện (EPUB đã parse ở client) vào DB bằng service role.
// Chỉ user có profiles.role = 'admin' mới gọi được.
//
// Luồng: verify JWT → check admin → upload bìa → tìm/tạo book →
//        ghi chapters + chapter_contents theo index tường minh
//        (mode replace: thay toàn bộ; mode merge: upsert theo index,
//        giữ chương hiện có) → đếm lại chapter_count.
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
  // Số thứ tự tường minh (lấy từ tên chương ở client, vd "Chương 10" → 10).
  // Thiếu thì fallback vị trí trong mảng (i + 1) — tương thích payload cũ.
  index?: number;
}
interface InCover {
  base64: string;
  contentType: string;
  ext: string;
}
// replace = xoá toàn bộ chương cũ rồi ghi mới (import lần đầu / làm lại).
// merge   = upsert theo (book_id, index): chương trùng số bị ghi đè (giữ
//           nguyên id → không mất tiến độ/bookmark), chương mới thêm vào —
//           dùng khi bổ sung chương từ nguồn khác.
type ImportMode = 'replace' | 'merge';
interface Payload {
  slug: string;
  title?: string;
  author?: string;
  free: number;
  publish: boolean;
  mode: ImportMode;
  chapters: Array<Required<InChapter>>;
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
  const chapters: Array<Required<InChapter>> = [];
  const usedIndexes = new Set<number>();
  for (let i = 0; i < b.chapters.length; i++) {
    const c = b.chapters[i] as InChapter;
    const title = String(c?.title ?? '').trim();
    const content = String(c?.content ?? '');
    if (!title || !content.trim()) return { error: 'empty_chapter' };

    const index = c?.index === undefined ? i + 1 : Number(c.index);
    if (!Number.isSafeInteger(index) || index < 1) {
      return { error: 'invalid_index' };
    }
    if (usedIndexes.has(index)) return { error: 'duplicate_index' };
    usedIndexes.add(index);

    chapters.push({ title, content, index });
  }

  const mode: ImportMode = b.mode === 'merge' ? 'merge' : 'replace';

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
      mode,
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

  // ---- 5. Tìm/tạo book ----
  // merge vào book đã có: KHÔNG ghi đè metadata/is_published (chỉ bổ sung
  // chương từ nguồn khác); chỉ cập nhật cover nếu upload mới thành công.
  const { data: existing } = await admin
    .from('books')
    .select('id, is_published')
    .eq('slug', payload.slug)
    .maybeSingle();

  let bookId: string;
  let published: boolean;
  if (existing && payload.mode === 'merge') {
    bookId = existing.id;
    published = existing.is_published;
    if (coverUrl) {
      await admin.from('books').update({ cover_url: coverUrl }).eq('id', bookId);
    }
  } else {
    const bookRow: Record<string, unknown> = {
      slug: payload.slug,
      title: title || payload.slug,
      author,
      is_published: payload.publish,
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
    bookId = book.id;
    published = payload.publish;
  }

  // ---- 6. Ghi chương ----
  // replace: xoá sạch rồi ghi mới (cascade xoá chapter_contents).
  // merge:   upsert theo (book_id, index) — chương trùng số giữ nguyên id
  //          (không mất tiến độ/bookmark), chỉ thay title/nội dung.
  if (payload.mode === 'replace') {
    await admin.from('chapters').delete().eq('book_id', bookId);
  }

  const metaRows = payload.chapters.map((ch) => ({
    book_id: bookId,
    index: ch.index,
    title: ch.title,
    is_free: ch.index <= payload.free,
    word_count: countWords(ch.content),
  }));

  // Upsert metadata theo lô, lấy id để ghép nội dung.
  const idByIndex = new Map<number, string>();
  for (const batch of chunk(metaRows, 200)) {
    const { data: upserted, error: chErr } = await admin
      .from('chapters')
      .upsert(batch, { onConflict: 'book_id,index' })
      .select('id, index');
    if (chErr || !upserted) {
      console.error('upsert chapters:', chErr?.message);
      return json({ error: 'db_chapters', detail: chErr?.message }, 500);
    }
    for (const row of upserted) idByIndex.set(row.index, row.id);
  }

  const contentRows = payload.chapters.map((ch) => ({
    chapter_id: idByIndex.get(ch.index)!,
    content: ch.content,
  }));
  for (const batch of chunk(contentRows, 100)) {
    const { error: cErr } = await admin
      .from('chapter_contents')
      .upsert(batch);
    if (cErr) {
      console.error('upsert contents:', cErr.message);
      return json({ error: 'db_contents', detail: cErr.message }, 500);
    }
  }

  // ---- 7. Đếm lại chapter_count (merge có thể chỉ thêm một phần) ----
  const { count } = await admin
    .from('chapters')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId);
  await admin
    .from('books')
    .update({ chapter_count: count ?? payload.chapters.length })
    .eq('id', bookId);

  return json({
    bookId,
    slug: payload.slug,
    chapters: payload.chapters.length,
    coverUrl,
    published,
  });
});
