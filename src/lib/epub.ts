/**
 * src/lib/epub.ts
 * Parser EPUB thuần (không phụ thuộc DOM hay Node fs) — chạy được cả trong
 * trình duyệt (admin import) lẫn Node (scripts/ingest-epub.ts).
 *
 * Vào: buffer của file .epub. Ra: metadata + danh sách chương (plain text) +
 * ảnh bìa (bytes). Không đụng tới mạng/DB — phần đó do người gọi lo.
 */

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface RawChapter {
  title: string;
  content: string;
}

export interface RawCover {
  data: Uint8Array;
  ext: string;
  contentType: string;
}

export interface ParsedEpub {
  metaTitle: string;
  metaAuthor: string;
  chapters: RawChapter[];
  cover: RawCover | null;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

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
export function htmlToText(html: string): string {
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

/** Chỉ lấy phần <body> để không kéo <title> trong <head> vào nội dung. */
function bodyOf(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : html;
}

function extractTitle(html: string, fallback: string): string {
  // Ưu tiên heading trong body (khớp với thứ sẽ bị gỡ khỏi nội dung).
  const body = bodyOf(html);
  const h = body.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
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

/**
 * Gỡ các thẻ heading có nội dung trùng tiêu đề chương ra khỏi body, để tiêu đề
 * không bị lặp (reader đã hiển thị `title` riêng ở phần header).
 */
function stripHeadingTitle(bodyHtml: string, title: string): string {
  const norm = title.trim().toLowerCase();
  if (!norm) return bodyHtml;
  return bodyHtml.replace(
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    (full, inner) => {
      const t = htmlToText(inner).trim().toLowerCase();
      return t === norm ? '' : full;
    },
  );
}

/** Phát hiện trang mục lục (TOC) lọt vào spine mà không được đánh dấu nav. */
function looksLikeToc(bodyHtml: string, title: string): boolean {
  const t = title.trim().toLowerCase();
  if (
    /^(mục lục|muc luc|table of contents|contents|nội dung|noi dung)$/.test(t)
  ) {
    return true;
  }
  const links = (bodyHtml.match(/<a\b[^>]*href=/gi) ?? []).length;
  if (links < 5) return false;
  const text = htmlToText(bodyHtml);
  // TOC = nhiều link, mỗi link rất ít chữ (chỉ là tên chương).
  return text.length / links < 60;
}

function extFromType(type: string, path: string): string {
  const t = type.toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  if (t.includes('svg')) return 'svg';
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : 'jpg';
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

async function extractCover(
  zip: JSZip,
  opfDir: string,
  manifestItems: Array<Record<string, string>>,
  metadata: Record<string, unknown>,
  maps: {
    hrefById: Map<string, string>;
    typeById: Map<string, string>;
  },
): Promise<RawCover | null> {
  const { hrefById, typeById } = maps;
  let coverId: string | undefined;

  // EPUB3: manifest item có properties="cover-image".
  for (const item of manifestItems) {
    if (/cover-image/.test(item['@_properties'] ?? '')) {
      coverId = item['@_id'];
      break;
    }
  }
  // EPUB2: <meta name="cover" content="<id>">.
  if (!coverId) {
    const metas = asArray(
      metadata.meta as
        | Record<string, string>
        | Record<string, string>[]
        | undefined,
    );
    const meta = metas.find((m) => (m['@_name'] ?? '') === 'cover');
    if (meta?.['@_content']) coverId = meta['@_content'];
  }
  // Suy đoán: item ảnh có id/href chứa "cover".
  if (!coverId) {
    for (const item of manifestItems) {
      const type = item['@_media-type'] ?? '';
      const id = (item['@_id'] ?? '').toLowerCase();
      const href = (item['@_href'] ?? '').toLowerCase();
      if (
        /^image\//.test(type) &&
        (id.includes('cover') || href.includes('cover'))
      ) {
        coverId = item['@_id'];
        break;
      }
    }
  }

  if (!coverId) return null;
  const href = hrefById.get(coverId);
  if (!href) return null;
  const coverPath = joinPath(opfDir, href);
  const data = await zip.file(coverPath)?.async('uint8array');
  if (!data) return null;

  const type = typeById.get(coverId) ?? '';
  const ext = extFromType(type, coverPath);
  return { data, ext, contentType: type || `image/${ext}` };
}

/**
 * Parse một buffer EPUB. `input` là ArrayBuffer/Uint8Array (browser: File →
 * arrayBuffer; Node: readFileSync). JSZip nhận cả hai kiểu.
 */
export async function parseEpubBuffer(
  input: ArrayBuffer | Uint8Array,
): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(input);

  // 1. container.xml → OPF path.
  const containerXml = await zip
    .file('META-INF/container.xml')
    ?.async('string');
  if (!containerXml) throw new Error('EPUB không hợp lệ: thiếu container.xml');
  const container = xml.parse(containerXml);
  const opfPath: string = container.container.rootfiles.rootfile['@_full-path'];
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
    const id = item['@_id'];
    hrefById.set(id, item['@_href']);
    typeById.set(id, item['@_media-type'] ?? '');
  }

  // Các href cần bỏ qua khi duyệt spine: trang nav (EPUB3), và các mục
  // guide kiểu toc/cover/title-page (EPUB2).
  const skipPaths = new Set<string>();
  for (const item of manifestItems) {
    if (/\bnav\b/.test(item['@_properties'] ?? '')) {
      skipPaths.add(joinPath(opfDir, item['@_href']));
    }
  }
  for (const ref of asArray(pkg.guide?.reference)) {
    const gtype = (ref['@_type'] ?? '').toLowerCase();
    if (['toc', 'cover', 'title-page'].includes(gtype)) {
      const ghref = (ref['@_href'] ?? '').split('#')[0];
      if (ghref) skipPaths.add(joinPath(opfDir, ghref));
    }
  }

  // Ảnh bìa: EPUB3 (properties="cover-image"), EPUB2 (<meta name="cover">),
  // hoặc suy đoán từ id/href có chữ "cover".
  const cover = await extractCover(zip, opfDir, manifestItems, metadata, {
    hrefById,
    typeById,
  });

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
    if (skipPaths.has(fullPath)) continue;

    const doc = await zip.file(fullPath)?.async('string');
    if (!doc) continue;

    const title = extractTitle(doc, `Chương ${seq + 1}`);
    const body = bodyOf(doc);

    // Bỏ trang mục lục lọt vào spine mà không đánh dấu nav.
    if (looksLikeToc(body, title)) continue;

    // Gỡ heading trùng tiêu đề để không lặp lại (reader render title riêng).
    const content = htmlToText(stripHeadingTitle(body, title));
    // Bỏ trang bìa/ngăn cách rỗng.
    if (content.length < 40) continue;

    seq++;
    chapters.push({ title, content });
  }

  return { metaTitle, metaAuthor, chapters, cover };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
