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
import process from 'node:process';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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
// EPUB parsing
// ------------------------------------------------------------------
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

interface RawChapter {
  title: string;
  content: string;
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

function joinPath(base: string, rel: string): string {
  if (!base) return rel;
  const parts = (base + '/' + rel).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** HTML → plain text: đoạn tách bằng \n\n, làm sạch tag/entity. */
function htmlToText(html: string): string {
  let s = html;
  // Bỏ script/style.
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
  // Ngắt đoạn ở các thẻ block.
  s = s.replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // Bỏ toàn bộ tag còn lại.
  s = s.replace(/<[^>]+>/g, '');
  // Decode entity phổ biến.
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  // Chuẩn hóa khoảng trắng.
  s = s.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  // Trim từng dòng + tổng thể.
  s = s
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
  return s;
}

function extractTitle(html: string, fallback: string): string {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (h) {
    const t = htmlToText(h[1]).trim();
    if (t) return t;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    const t = htmlToText(title[1]).trim();
    if (t) return t;
  }
  return fallback;
}

async function parseEpub(epubPath: string): Promise<{
  metaTitle: string;
  metaAuthor: string;
  chapters: RawChapter[];
}> {
  const buf = readFileSync(resolve(epubPath));
  const zip = await JSZip.loadAsync(buf);

  // 1. container.xml → OPF path.
  const containerXml = await zip
    .file('META-INF/container.xml')
    ?.async('string');
  if (!containerXml) throw new Error('EPUB không hợp lệ: thiếu container.xml');
  const container = xml.parse(containerXml);
  const opfPath: string =
    container.container.rootfiles.rootfile['@_full-path'];
  const opfDir = dirname(opfPath);

  // 2. OPF → manifest + spine + metadata.
  const opfXml = await zip.file(opfPath)?.async('string');
  if (!opfXml) throw new Error('Không đọc được OPF: ' + opfPath);
  const opf = xml.parse(opfXml);
  const pkg = opf.package;

  const metadata = pkg.metadata ?? {};
  const metaTitle = textOf(metadata['dc:title']) || 'Không rõ tựa';
  const metaAuthor = textOf(metadata['dc:creator']) || '';

  const manifestItems = asArray(pkg.manifest.item);
  const hrefById = new Map<string, string>();
  const typeById = new Map<string, string>();
  for (const item of manifestItems) {
    hrefById.set(item['@_id'], item['@_href']);
    typeById.set(item['@_id'], item['@_media-type'] ?? '');
  }

  const spineItems = asArray(pkg.spine.itemref);

  // 3. Duyệt spine theo thứ tự → đọc từng xhtml.
  const chapters: RawChapter[] = [];
  let seq = 0;
  for (const ref of spineItems) {
    const idref = ref['@_idref'];
    const href = hrefById.get(idref);
    const type = typeById.get(idref);
    if (!href) continue;
    if (type && !/xhtml|html/.test(type)) continue;

    const fullPath = joinPath(opfDir, href);
    const doc = await zip.file(fullPath)?.async('string');
    if (!doc) continue;

    const content = htmlToText(doc);
    // Bỏ trang bìa/mục lục rỗng.
    if (content.length < 40) continue;

    seq++;
    const title = extractTitle(doc, `Chương ${seq}`);
    chapters.push({ title, content });
  }

  return { metaTitle, metaAuthor, chapters };
}

function textOf(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node.trim();
  if (Array.isArray(node)) return textOf(node[0]);
  if (typeof node === 'object' && '#text' in (node as object)) {
    return String((node as { '#text': unknown })['#text']).trim();
  }
  return '';
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ------------------------------------------------------------------
// Insert
// ------------------------------------------------------------------
async function main() {
  const args = parseArgs();
  console.log(`Đọc EPUB: ${args.epubPath}`);

  const { metaTitle, metaAuthor, chapters } = await parseEpub(args.epubPath);
  if (chapters.length === 0) {
    console.error('Không tách được chương nào từ EPUB.');
    process.exit(1);
  }

  const title = args.title ?? metaTitle;
  const author = (args.author ?? metaAuthor) || null;
  console.log(
    `→ "${title}" (${author ?? 'không rõ tác giả'}) — ${chapters.length} chương, free ≤ ${args.free}`,
  );

  // Upsert book theo slug.
  const { data: book, error: bookErr } = await supabase
    .from('books')
    .upsert(
      {
        slug: args.slug,
        title,
        author,
        is_published: args.publish,
        chapter_count: chapters.length,
      },
      { onConflict: 'slug' },
    )
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
