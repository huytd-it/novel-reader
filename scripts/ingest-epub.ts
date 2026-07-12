/**
 * scripts/ingest-epub.ts
 * EPUB → Supabase (books + chapters + chapter_contents).
 *
 * Chạy LOCAL, bằng SERVICE ROLE KEY (bỏ qua RLS). KHÔNG commit key.
 *
 * Cách dùng:
 *   npm run ingest -- ./scripts/epub/truyen.epub \
 *     --slug ten-truyen --free 5 [--author "Tác giả"] [--publish]
 *
 * Cờ:
 *   --slug     bắt buộc — slug URL của truyện
 *   --free N   số chương đầu để is_free = true (mặc định 5)
 *   --title    ghi đè tiêu đề (mặc định lấy từ metadata EPUB)
 *   --author   ghi đè tác giả
 *   --publish  set is_published = true ngay (mặc định false)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parseEpubBuffer, countWords, type RawCover } from '../src/lib/epub';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------------
// Arg parsing
// ------------------------------------------------------------------
interface Args {
  epubPath: string;
  slug: string;
  free: number;
  title?: string;
  author?: string;
  publish: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }

  const epubPath = positional[0];
  const slug = flags.slug as string | undefined;
  if (!epubPath || !slug) {
    console.error(
      'Cách dùng: npm run ingest -- <file.epub> --slug <slug> [--free 5] [--publish]',
    );
    process.exit(1);
  }

  return {
    epubPath,
    slug,
    free: flags.free ? Number(flags.free) : 5,
    title: flags.title as string | undefined,
    author: flags.author as string | undefined,
    publish: flags.publish === true,
  };
}

// ------------------------------------------------------------------
// EPUB parsing (logic dùng chung ở src/lib/epub.ts)
// ------------------------------------------------------------------
const COVER_BUCKET = 'covers';

/** Đọc file .epub từ đĩa → parse. Bọc parseEpubBuffer cho tiện dùng CLI. */
async function parseEpub(epubPath: string) {
  const buf = readFileSync(resolve(epubPath));
  return parseEpubBuffer(buf);
}

// ------------------------------------------------------------------
// Cover upload
// ------------------------------------------------------------------
/** Upload ảnh bìa lên Storage bucket công khai, trả về public URL. */
async function uploadCover(
  slug: string,
  cover: RawCover,
): Promise<string | null> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === COVER_BUCKET)) {
    const { error } = await supabase.storage.createBucket(COVER_BUCKET, {
      public: true,
    });
    if (error) {
      console.error('Không tạo được bucket ảnh bìa:', error.message);
      return null;
    }
  }

  const path = `${slug}.${cover.ext}`;
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(path, cover.data, { contentType: cover.contentType, upsert: true });
  if (error) {
    console.error('Lỗi upload ảnh bìa:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ------------------------------------------------------------------
// Insert
// ------------------------------------------------------------------
async function main() {
  const args = parseArgs();
  console.log(`Đọc EPUB: ${args.epubPath}`);

  const { metaTitle, metaAuthor, chapters, cover } = await parseEpub(
    args.epubPath,
  );
  if (chapters.length === 0) {
    console.error('Không tách được chương nào từ EPUB.');
    process.exit(1);
  }

  const title = args.title ?? metaTitle;
  const author = (args.author ?? metaAuthor) || null;
  console.log(
    `→ "${title}" (${author ?? 'không rõ tác giả'}) — ${chapters.length} chương, free ≤ ${args.free}`,
  );

  // Trích + upload ảnh bìa (nếu EPUB có).
  let coverUrl: string | null = null;
  if (cover) {
    coverUrl = await uploadCover(args.slug, cover);
    console.log(
      coverUrl ? `→ Ảnh bìa: ${coverUrl}` : '→ Có ảnh bìa nhưng upload thất bại.',
    );
  } else {
    console.log('→ Không tìm thấy ảnh bìa trong EPUB.');
  }

  // Upsert book theo slug. Chỉ ghi đè cover_url khi upload thành công.
  const bookRow: Record<string, unknown> = {
    slug: args.slug,
    title,
    author,
    is_published: args.publish,
    chapter_count: chapters.length,
  };
  if (coverUrl) bookRow.cover_url = coverUrl;

  const { data: book, error: bookErr } = await supabase
    .from('books')
    .upsert(bookRow, { onConflict: 'slug' })
    .select('id')
    .single();

  if (bookErr || !book) {
    console.error('Lỗi insert book:', bookErr?.message);
    process.exit(1);
  }

  // Xóa chương cũ của book này (ingest lại từ đầu, sạch sẽ).
  await supabase.from('chapters').delete().eq('book_id', book.id);

  // Insert chương lần lượt.
  let done = 0;
  for (let i = 0; i < chapters.length; i++) {
    const index = i + 1;
    const ch = chapters[i];

    const { data: chapterRow, error: chErr } = await supabase
      .from('chapters')
      .insert({
        book_id: book.id,
        index,
        title: ch.title,
        is_free: index <= args.free,
        word_count: countWords(ch.content),
      })
      .select('id')
      .single();

    if (chErr || !chapterRow) {
      console.error(`Lỗi insert chương ${index}:`, chErr?.message);
      continue;
    }

    const { error: contentErr } = await supabase
      .from('chapter_contents')
      .insert({ chapter_id: chapterRow.id, content: ch.content });

    if (contentErr) {
      console.error(`Lỗi insert nội dung chương ${index}:`, contentErr.message);
      continue;
    }

    done++;
    if (done % 20 === 0) console.log(`  …đã nạp ${done}/${chapters.length}`);
  }

  // Cập nhật chapter_count cho khớp thực tế.
  await supabase
    .from('books')
    .update({ chapter_count: done })
    .eq('id', book.id);

  console.log(`✓ Xong: nạp ${done}/${chapters.length} chương cho "${title}".`);
  console.log(
    args.publish
      ? '  Truyện đã publish.'
      : '  Truyện đang ở trạng thái nháp (is_published = false). Thêm --publish để mở.',
  );
}

// Chỉ chạy khi gọi trực tiếp (không chạy khi được import để test parseEpub).
const invokedDirectly =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
