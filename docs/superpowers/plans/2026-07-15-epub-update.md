# Cập nhật truyện từ EPUB (merge mode) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin cập nhật một truyện đã có từ file EPUB mới — chương trùng index được ghi đè tại chỗ (giữ chapter id → không mất tiến độ đọc/bookmark), chương mới được append (trigger tự thông báo follower).

**Architecture:** Mở rộng Edge Function `admin-import` với chế độ merge (kích hoạt bằng trường `updateBookId` trong payload). Frontend thêm route lazy `/admin/books/:id/update` với trang parse EPUB trong trình duyệt + tóm tắt diff trước khi xác nhận. Một migration mới cho admin SELECT chapters của truyện nháp qua RLS.

**Tech Stack:** React 18 + react-router 6 + @tanstack/react-query 5 + Tailwind (frontend); Supabase Edge Function (Deno) + supabase-js 2 (backend); jszip + fast-xml-parser (parser EPUB sẵn có, không sửa).

**Spec:** `docs/superpowers/specs/2026-07-15-epub-update-design.md`

## Global Constraints

- Toàn bộ copy UI bằng tiếng Việt, giọng điệu như các trang admin hiện có.
- Route admin phải lazy-load trong `src/App.tsx` (không phình bundle người đọc).
- Không thêm dependency mới.
- Chế độ import mới của `admin-import` (payload không có `updateBookId`) giữ nguyên hành vi và response hiện tại — không breaking change.
- Project không có test infra → mỗi task kiểm chứng bằng `npm run typecheck` + `npm run lint` (cả hai phải pass, 0 warning); kiểm thử hành vi end-to-end dồn ở Task 5.
- Commit sau mỗi task, message tiếng Anh theo kiểu `feat:`/`docs:` như git log hiện có.

---

### Task 1: Migration RLS + hàm fetch tựa chương cho admin

**Files:**
- Create: `supabase/migrations/0010_admin_chapters_select.sql`
- Modify: `src/lib/adminBooks.ts` (thêm cuối file)

**Interfaces:**
- Consumes: `public.is_admin()` (đã có từ migration 0003), `supabase`/`ApiError` (đã import sẵn trong adminBooks.ts).
- Produces: `fetchChapterMetaForAdmin(bookId: string): Promise<AdminChapterMeta[]>` và interface `AdminChapterMeta { index: number; title: string }` — Task 4 dùng để hiển thị diff.

**Bối cảnh:** Policy `"public chapter meta"` (0001) chỉ cho SELECT chapters của truyện đã publish. Trang cập nhật cần đọc tựa chương của cả truyện nháp → thêm policy admin (OR với policy cũ), đúng pattern 0003 đã làm cho bảng `books`.

- [ ] **Step 1: Viết migration**

Tạo `supabase/migrations/0010_admin_chapters_select.sql`:

```sql
-- 0010_admin_chapters_select.sql
-- Cho admin SELECT toàn bộ chapters (kể cả của truyện nháp) từ client,
-- phục vụ trang "Cập nhật EPUB" so tựa chương trước khi merge.
-- Ghép OR với policy "public chapter meta" (0001); is_admin() từ 0003.

drop policy if exists "admin select all chapters" on chapters;
create policy "admin select all chapters" on chapters
  for select using (public.is_admin());
```

- [ ] **Step 2: Thêm hàm fetch vào adminBooks.ts**

Thêm vào cuối `src/lib/adminBooks.ts`:

```ts
export interface AdminChapterMeta {
  index: number;
  title: string;
}

/**
 * Tựa các chương của một book (kể cả truyện nháp — RLS 0010) — dùng cho
 * trang "Cập nhật EPUB" so tựa chương giữa DB và file mới.
 */
export async function fetchChapterMetaForAdmin(
  bookId: string,
): Promise<AdminChapterMeta[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('index, title')
    .eq('book_id', bookId)
    .order('index', { ascending: true });

  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck` rồi `npm run lint`
Expected: cả hai exit 0, không warning.

- [ ] **Step 4: Áp migration lên Supabase**

Run: `supabase db push` (hoặc nếu project này apply migration qua Dashboard: dán nội dung file vào SQL Editor và chạy — làm theo cách các migration 0004–0009 đã được áp trước đây).
Expected: policy `admin select all chapters` tồn tại trên bảng `chapters`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_admin_chapters_select.sql src/lib/adminBooks.ts
git commit -m "feat: admin RLS select on chapters + fetchChapterMetaForAdmin"
```

---

### Task 2: Chế độ merge trong Edge Function admin-import

**Files:**
- Modify: `supabase/functions/admin-import/index.ts`

**Interfaces:**
- Consumes: các helper sẵn có trong file — `admin` (service-role client), `json()`, `countWords()`, `chunk()`, `uploadCover()`, `parsePayload()`.
- Produces: chế độ merge kích hoạt khi payload có `updateBookId: string`; nhận thêm `updateCover?: boolean`; response JSON `{ bookId, slug, chaptersUpdated, chaptersAdded, chaptersKept, coverUrl }` — Task 3 gọi qua `supabase.functions.invoke('admin-import')`.

- [ ] **Step 1: Mở rộng interface Payload + parsePayload**

Trong `supabase/functions/admin-import/index.ts`, sửa interface `Payload` (dòng ~47) thành:

```ts
interface Payload {
  slug: string;
  title?: string;
  author?: string;
  free: number;
  publish: boolean;
  chapters: InChapter[];
  cover?: InCover | null;
  // Chế độ merge: cập nhật truyện đã có, giữ chapter id (spec 2026-07-15).
  updateBookId?: string;
  updateCover?: boolean;
}
```

Trong `parsePayload`, thay hai dòng validate slug:

```ts
  const slug = String(b.slug ?? '').trim();
  if (!SLUG_RE.test(slug)) return { error: 'invalid_slug' };
```

bằng:

```ts
  // Chế độ merge nhận diện qua updateBookId; khi đó slug không bắt buộc
  // (book đã có slug riêng, không đổi).
  const updateBookId = b.updateBookId ? String(b.updateBookId) : undefined;
  const slug = String(b.slug ?? '').trim();
  if (!updateBookId && !SLUG_RE.test(slug)) return { error: 'invalid_slug' };
```

và trong object `return { data: { ... } }` cuối hàm, thêm hai trường:

```ts
      updateBookId,
      updateCover: b.updateCover === true,
```

- [ ] **Step 2: Viết handleMerge**

Thêm hàm sau vào trước `Deno.serve(...)` (sau `uploadCover`):

```ts
/**
 * Chế độ merge: cập nhật truyện đã có từ EPUB mới.
 * - Chương trùng index: upsert theo id (giữ chapter id → reading_progress/
 *   bookmarks còn nguyên; path ON CONFLICT DO UPDATE không kích hoạt trigger
 *   on_chapter_insert → không spam thông báo).
 * - Chương mới (index > số chương DB): insert → trigger fanout thông báo
 *   chương mới cho follower như bình thường.
 * - EPUB ít chương hơn DB: chương ngoài phạm vi giữ nguyên, không xóa.
 * - Metadata (tựa/tác giả/slug/publish/is_free) không đổi; bìa chỉ ghi đè
 *   khi updateCover=true.
 */
async function handleMerge(payload: Payload): Promise<Response> {
  const { data: book, error: bookErr } = await admin
    .from('books')
    .select('id, slug')
    .eq('id', payload.updateBookId!)
    .maybeSingle();
  if (bookErr) {
    console.error('fetch book:', bookErr.message);
    return json({ error: 'db_book', detail: bookErr.message }, 500);
  }
  if (!book) return json({ error: 'book_not_found' }, 404);

  const { data: existing, error: exErr } = await admin
    .from('chapters')
    .select('id, index, is_free')
    .eq('book_id', book.id)
    .order('index', { ascending: true });
  if (exErr) {
    console.error('fetch chapters:', exErr.message);
    return json({ error: 'db_chapters', detail: exErr.message }, 500);
  }

  const existingByIndex = new Map<
    number,
    { id: string; index: number; is_free: boolean }
  >();
  for (const row of existing ?? []) existingByIndex.set(row.index, row);
  const existingCount = existing?.length ?? 0;
  const epubCount = payload.chapters.length;

  // Tách chương trùng index (ghi đè tại chỗ) và chương mới (append).
  const updateMetaRows: Record<string, unknown>[] = [];
  const updateContentRows: { chapter_id: string; content: string }[] = [];
  const newMetaRows: Record<string, unknown>[] = [];
  const newContentByIndex = new Map<number, string>();

  payload.chapters.forEach((ch, i) => {
    const index = i + 1;
    const ex = existingByIndex.get(index);
    if (ex) {
      updateMetaRows.push({
        id: ex.id,
        book_id: book.id,
        index,
        title: ch.title,
        is_free: ex.is_free, // giữ nguyên trạng thái free đã cấu hình
        word_count: countWords(ch.content),
      });
      updateContentRows.push({ chapter_id: ex.id, content: ch.content });
    } else {
      newMetaRows.push({
        book_id: book.id,
        index,
        title: ch.title,
        is_free: false,
        word_count: countWords(ch.content),
      });
      newContentByIndex.set(index, ch.content);
    }
  });

  for (const batch of chunk(updateMetaRows, 200)) {
    const { error } = await admin
      .from('chapters')
      .upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error('upsert chapters:', error.message);
      return json({ error: 'db_chapters', detail: error.message }, 500);
    }
  }
  for (const batch of chunk(updateContentRows, 100)) {
    const { error } = await admin
      .from('chapter_contents')
      .upsert(batch, { onConflict: 'chapter_id' });
    if (error) {
      console.error('upsert contents:', error.message);
      return json({ error: 'db_contents', detail: error.message }, 500);
    }
  }

  // Chương mới: insert lấy id để ghép nội dung (trigger thông báo tự chạy).
  const idByIndex = new Map<number, string>();
  for (const batch of chunk(newMetaRows, 200)) {
    const { data: inserted, error } = await admin
      .from('chapters')
      .insert(batch)
      .select('id, index');
    if (error || !inserted) {
      console.error('insert chapters:', error?.message);
      return json({ error: 'db_chapters', detail: error?.message }, 500);
    }
    for (const row of inserted) idByIndex.set(row.index, row.id);
  }
  const newContentRows: { chapter_id: string; content: string }[] = [];
  for (const [index, content] of newContentByIndex) {
    const id = idByIndex.get(index);
    if (id) newContentRows.push({ chapter_id: id, content });
  }
  for (const batch of chunk(newContentRows, 100)) {
    const { error } = await admin.from('chapter_contents').insert(batch);
    if (error) {
      console.error('insert contents:', error.message);
      return json({ error: 'db_contents', detail: error.message }, 500);
    }
  }

  // Bìa (tùy chọn) + chapter_count.
  let coverUrl: string | null = null;
  if (payload.updateCover && payload.cover) {
    coverUrl = await uploadCover(book.slug, payload.cover);
  }
  const bookPatch: Record<string, unknown> = {
    chapter_count: Math.max(existingCount, epubCount),
  };
  if (coverUrl) bookPatch.cover_url = coverUrl;
  const { error: patchErr } = await admin
    .from('books')
    .update(bookPatch)
    .eq('id', book.id);
  if (patchErr) {
    console.error('update book:', patchErr.message);
    return json({ error: 'db_book', detail: patchErr.message }, 500);
  }

  return json({
    bookId: book.id,
    slug: book.slug,
    chaptersUpdated: updateContentRows.length,
    chaptersAdded: newMetaRows.length,
    chaptersKept: Math.max(0, existingCount - epubCount),
    coverUrl,
  });
}
```

- [ ] **Step 3: Rẽ nhánh trong handler**

Trong `Deno.serve`, ngay sau dòng `if (!payload) return json({ error: perr }, 400);`, thêm:

```ts
  // ---- Chế độ merge: cập nhật truyện đã có ----
  if (payload.updateBookId) {
    return await handleMerge(payload);
  }
```

(Các bước 4–6 của flow import mới giữ nguyên phía dưới, không sửa.)

- [ ] **Step 4: Deploy function**

Run: `supabase functions deploy admin-import --no-verify-jwt`
Expected: deploy thành công. (Nếu môi trường này không đăng nhập supabase CLI, đánh dấu bước này để user tự chạy — ghi rõ trong báo cáo task.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/admin-import/index.ts
git commit -m "feat: merge mode in admin-import edge function (update book from EPUB)"
```

---

### Task 3: Client API — adminUpdateFromEpub

**Files:**
- Modify: `src/lib/admin.ts`

**Interfaces:**
- Consumes: `supabase`, `ApiError`, `ParsedEpub`, `extractStatus`, `messageForStatus` (tất cả đã có trong file).
- Produces: `adminUpdateFromEpub(input: AdminUpdateInput): Promise<AdminUpdateResult>`; types `AdminUpdateInput { bookId: string; parsed: ParsedEpub; coverBase64: string | null; updateCover: boolean }` và `AdminUpdateResult { bookId; slug; chaptersUpdated; chaptersAdded; chaptersKept; coverUrl }` — Task 4 dùng.

- [ ] **Step 1: Thêm types + hàm gọi function**

Thêm vào cuối `src/lib/admin.ts`:

```ts
export interface AdminUpdateResult {
  bookId: string;
  slug: string;
  chaptersUpdated: number;
  chaptersAdded: number;
  chaptersKept: number;
  coverUrl: string | null;
}

export interface AdminUpdateInput {
  bookId: string;
  parsed: ParsedEpub;
  coverBase64: string | null;
  updateCover: boolean;
}

/**
 * Cập nhật truyện đã có từ EPUB mới (chế độ merge của admin-import):
 * chương trùng index ghi đè tại chỗ (giữ chapter id), chương mới append.
 */
export async function adminUpdateFromEpub(
  input: AdminUpdateInput,
): Promise<AdminUpdateResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const payload = {
    updateBookId: input.bookId,
    updateCover: input.updateCover,
    chapters: input.parsed.chapters,
    cover:
      input.updateCover && input.parsed.cover && input.coverBase64
        ? {
            base64: input.coverBase64,
            contentType: input.parsed.cover.contentType,
            ext: input.parsed.cover.ext,
          }
        : null,
  };

  const { data, error } = await supabase.functions.invoke<AdminUpdateResult>(
    'admin-import',
    {
      body: payload,
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    },
  );

  if (error) {
    const status = extractStatus(error);
    throw new ApiError(status, messageForStatus(status));
  }
  if (!data) throw new ApiError(500, 'Không nhận được kết quả cập nhật.');
  return data;
}
```

- [ ] **Step 2: Bổ sung message 404**

Trong `messageForStatus` (cùng file), thêm case trước `default`:

```ts
    case 404:
      return 'Không tìm thấy truyện cần cập nhật (có thể đã bị xoá).';
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck` rồi `npm run lint`
Expected: cả hai exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin.ts
git commit -m "feat: adminUpdateFromEpub client API for merge mode"
```

---

### Task 4: Trang AdminBookUpdate + route + nút vào

**Files:**
- Create: `src/components/admin/ChapterPreview.tsx` (tách từ AdminImport để dùng chung)
- Create: `src/routes/AdminBookUpdate.tsx`
- Modify: `src/routes/AdminImport.tsx` (bỏ ChapterPreview nội bộ, import từ components)
- Modify: `src/App.tsx` (route lazy mới)
- Modify: `src/routes/AdminBooks.tsx` (nút "Cập nhật EPUB")

**Interfaces:**
- Consumes: `prepareEpub`, `adminUpdateFromEpub`, `AdminUpdateResult`, `PreparedImport` (Task 3 + sẵn có trong `@/lib/admin`); `fetchBookById` (sẵn có), `fetchChapterMetaForAdmin` (Task 1) từ `@/lib/adminBooks`; `AdminGate`, `Button`, `Spinner` từ components hiện có.
- Produces: route `/admin/books/:id/update`; component `ChapterPreview({ index, title, content })` xuất từ `src/components/admin/ChapterPreview.tsx`.

- [ ] **Step 1: Tách ChapterPreview thành component dùng chung**

Tạo `src/components/admin/ChapterPreview.tsx` với nội dung (chuyển nguyên văn từ `AdminImport.tsx`, chỉ thêm import/export):

```tsx
import { useMemo, useState } from 'react';

/** Preview một chương đã parse: mở/đóng, mặc định 3 đoạn đầu. */
export function ChapterPreview({
  index,
  title,
  content,
}: {
  index: number;
  title: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const paragraphs = useMemo(
    () => content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [content],
  );
  const shown = open ? paragraphs : paragraphs.slice(0, 3);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="rounded-lg border border-hairline bg-surface p-4"
    >
      <summary className="cursor-pointer list-none">
        <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">
          Chương {index}
        </span>
        <span className="ml-2 font-medium text-ink-strong">{title}</span>
        <span className="ml-2 font-mono text-xs text-ink-muted">
          · {paragraphs.length} đoạn
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
        {shown.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {!open && paragraphs.length > 3 && (
          <p className="text-ink-muted">… (mở để xem đầy đủ)</p>
        )}
      </div>
    </details>
  );
}
```

Trong `src/routes/AdminImport.tsx`: xóa function `ChapterPreview` nội bộ (dòng ~283–324) và thêm import:

```tsx
import { ChapterPreview } from '@/components/admin/ChapterPreview';
```

- [ ] **Step 2: Viết trang AdminBookUpdate**

Tạo `src/routes/AdminBookUpdate.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBookById,
  fetchChapterMetaForAdmin,
} from '@/lib/adminBooks';
import {
  prepareEpub,
  adminUpdateFromEpub,
  type PreparedImport,
  type AdminUpdateResult,
} from '@/lib/admin';
import { AdminGate } from '@/components/admin/AdminGate';
import { ChapterPreview } from '@/components/admin/ChapterPreview';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const NEW_PREVIEW_COUNT = 10;
const TITLE_MISMATCH_LIMIT = 5;

export default function AdminBookUpdate() {
  return (
    <AdminGate next="/admin/books" wide>
      <UpdateWorkspace />
    </AdminGate>
  );
}

function UpdateWorkspace() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: book, isLoading: loadingBook } = useQuery({
    queryKey: ['admin-book', id],
    queryFn: () => fetchBookById(id),
    enabled: !!id,
  });
  const { data: existingChapters } = useQuery({
    queryKey: ['admin-book-chapters', id],
    queryFn: () => fetchChapterMetaForAdmin(id),
    enabled: !!id,
  });

  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [updateCover, setUpdateCover] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<AdminUpdateResult | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setResult(null);
    setUpdateError(null);
    try {
      const p = await prepareEpub(file);
      setPrepared(p);
      setFileName(file.name);
      setUpdateCover(false);
    } catch (err) {
      setPrepared(null);
      setParseError(
        err instanceof Error ? err.message : 'Không đọc được file EPUB.',
      );
    } finally {
      setParsing(false);
    }
  }

  async function onUpdate() {
    if (!prepared || !book) return;
    setUpdating(true);
    setUpdateError(null);
    setResult(null);
    try {
      const res = await adminUpdateFromEpub({
        bookId: book.id,
        parsed: prepared.parsed,
        coverBase64: prepared.coverBase64,
        updateCover,
      });
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ['admin-books'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-book', id] });
      void queryClient.invalidateQueries({
        queryKey: ['admin-book-chapters', id],
      });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : 'Có lỗi khi cập nhật truyện.',
      );
    } finally {
      setUpdating(false);
    }
  }

  // ----- Diff giữa DB và EPUB -----
  const epubChapters = prepared?.parsed.chapters ?? [];
  const dbCount = existingChapters?.length ?? book?.chapter_count ?? 0;
  const epubCount = epubChapters.length;
  const updatedCount = Math.min(dbCount, epubCount);
  const addedCount = Math.max(0, epubCount - dbCount);
  const keptCount = Math.max(0, dbCount - epubCount);

  const titleMismatches = useMemo(() => {
    if (!prepared || !existingChapters) return [];
    const out: { index: number; db: string; epub: string }[] = [];
    for (const ex of existingChapters) {
      const ep = epubChapters[ex.index - 1];
      if (!ep) continue;
      if (ex.title.trim().toLowerCase() !== ep.title.trim().toLowerCase()) {
        out.push({ index: ex.index, db: ex.title, epub: ep.title });
      }
    }
    return out;
    // epubChapters dẫn xuất từ prepared — không cần trong deps riêng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, existingChapters]);

  const newChapters = useMemo(
    () => epubChapters.slice(updatedCount),
    [epubChapters, updatedCount],
  );

  if (loadingBook) return <Spinner label="Đang tải thông tin truyện…" />;
  if (!book) {
    return (
      <p className="py-16 text-center text-ink-muted">
        Không tìm thấy truyện này.{' '}
        <Link to="/admin/books" className="underline underline-offset-2">
          ← Quản lý truyện
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
          Quản trị · Cập nhật truyện
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-ink-strong">
          Cập nhật từ EPUB
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Chương trùng số thứ tự sẽ được ghi đè nội dung (giữ nguyên tiến độ
          đọc và bookmark của người dùng); chương mới sẽ được thêm vào cuối và
          tự thông báo cho người theo dõi.
        </p>
      </header>

      {/* ---- Truyện hiện tại ---- */}
      <section className="rounded-xl border border-hairline bg-surface p-6">
        <div className="flex gap-5">
          <div className="h-40 w-28 shrink-0 overflow-hidden rounded-md border border-hairline bg-canvas">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt="Ảnh bìa hiện tại"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-ink-muted">
                Không có ảnh bìa
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-muted">Tựa</dt>
              <dd className="truncate text-ink-strong">{book.title}</dd>
              <dt className="text-ink-muted">Slug</dt>
              <dd className="truncate font-mono text-xs">{book.slug}</dd>
              <dt className="text-ink-muted">Số chương trong DB</dt>
              <dd className="font-mono">{dbCount}</dd>
            </dl>
          </div>
        </div>

        <div className="mt-6">
          <input
            ref={fileRef}
            type="file"
            accept=".epub,application/epub+zip"
            onChange={onPickFile}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="solid" onClick={() => fileRef.current?.click()}>
              Chọn file EPUB mới
            </Button>
            {fileName && (
              <span className="font-mono text-xs text-ink-muted">
                {fileName}
              </span>
            )}
          </div>
          {parsing && <Spinner label="Đang phân tích EPUB…" />}
          {parseError && (
            <p className="mt-3 text-sm text-clay-red">{parseError}</p>
          )}
        </div>
      </section>

      {prepared && !parsing && (
        <>
          {/* ---- Tóm tắt thay đổi ---- */}
          <section className="rounded-xl border border-hairline bg-surface p-6">
            <h2 className="font-display text-lg font-medium text-ink-strong">
              Thay đổi sẽ áp dụng
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-ink">
              <li>
                <span className="font-mono">{updatedCount}</span> chương sẽ
                được cập nhật nội dung (chương 1–{updatedCount || 0}).
              </li>
              <li>
                <span className="font-mono">{addedCount}</span> chương mới sẽ
                được thêm
                {addedCount > 0 && (
                  <> (chương {dbCount + 1}–{epubCount})</>
                )}
                .
              </li>
            </ul>

            {keptCount > 0 && (
              <p className="mt-3 rounded-lg bg-pale-yellow px-3 py-2 text-sm text-clay-yellow">
                ⚠ File EPUB có ít chương hơn DB: {keptCount} chương (chương{' '}
                {epubCount + 1}–{dbCount}) nằm ngoài file sẽ được giữ nguyên,
                không bị xóa.
              </p>
            )}

            {titleMismatches.length > 0 && (
              <div className="mt-3 rounded-lg bg-pale-yellow px-3 py-2 text-sm text-clay-yellow">
                <p>
                  ⚠ {titleMismatches.length} chương có tựa khác giữa DB và
                  EPUB — kiểm tra xem thứ tự chương có bị lệch không:
                </p>
                <ul className="mt-1 space-y-0.5 font-mono text-xs">
                  {titleMismatches.slice(0, TITLE_MISMATCH_LIMIT).map((m) => (
                    <li key={m.index}>
                      Chương {m.index}: “{m.db}” → “{m.epub}”
                    </li>
                  ))}
                  {titleMismatches.length > TITLE_MISMATCH_LIMIT && (
                    <li>
                      … và {titleMismatches.length - TITLE_MISMATCH_LIMIT} chương
                      khác.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {prepared.coverDataUrl && (
              <label className="mt-4 flex items-center gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={updateCover}
                  onChange={(e) => setUpdateCover(e.target.checked)}
                  className="h-4 w-4 accent-ink-strong"
                />
                Cập nhật ảnh bìa từ EPUB
                <img
                  src={prepared.coverDataUrl}
                  alt="Bìa trong EPUB"
                  className="h-14 w-10 rounded border border-hairline object-cover"
                />
              </label>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="solid"
                disabled={updating || epubCount === 0}
                onClick={() => void onUpdate()}
              >
                {updating ? 'Đang cập nhật…' : 'Xác nhận cập nhật'}
              </Button>
              <Link to="/admin/books">
                <Button variant="hairline">Hủy</Button>
              </Link>
              {updateError && (
                <span className="text-sm text-clay-red">{updateError}</span>
              )}
            </div>

            {result && (
              <div className="mt-4 rounded-lg border border-hairline bg-canvas p-4 text-sm">
                <p className="font-medium text-ink-strong">
                  ✓ Đã cập nhật {result.chaptersUpdated} chương, thêm{' '}
                  {result.chaptersAdded} chương mới
                  {result.chaptersKept > 0 &&
                    `, giữ nguyên ${result.chaptersKept} chương ngoài file`}
                  .
                </p>
                <p className="mt-1 text-ink-muted">
                  {result.coverUrl ? 'Đã cập nhật ảnh bìa. ' : ''}
                  <Link
                    to={`/truyen/${result.slug}`}
                    className="text-ink underline underline-offset-2"
                  >
                    Xem trang truyện →
                  </Link>
                </p>
              </div>
            )}
          </section>

          {/* ---- Preview chương mới ---- */}
          {newChapters.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-medium text-ink-strong">
                Xem trước {Math.min(NEW_PREVIEW_COUNT, newChapters.length)}{' '}
                chương mới đầu tiên
              </h2>
              <div className="flex flex-col gap-3">
                {newChapters.slice(0, NEW_PREVIEW_COUNT).map((ch, i) => (
                  <ChapterPreview
                    key={i}
                    index={dbCount + i + 1}
                    title={ch.title}
                    content={ch.content}
                  />
                ))}
              </div>
              {newChapters.length > NEW_PREVIEW_COUNT && (
                <p className="mt-3 text-sm text-ink-muted">
                  … và {newChapters.length - NEW_PREVIEW_COUNT} chương mới nữa
                  sẽ được thêm cùng.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Đăng ký route trong App.tsx**

Trong `src/App.tsx`, thêm lazy import sau dòng `AdminBookEdit`:

```tsx
const AdminBookUpdate = lazy(() => import('./routes/AdminBookUpdate'));
```

và thêm Route sau block `/admin/books/:id`:

```tsx
        <Route
          path="/admin/books/:id/update"
          element={
            <Suspense fallback={null}>
              <AdminBookUpdate />
            </Suspense>
          }
        />
```

- [ ] **Step 4: Nút "Cập nhật EPUB" trong AdminBooks**

Trong `src/routes/AdminBooks.tsx`, trong cell actions (div `flex justify-end gap-2 whitespace-nowrap`), thêm ngay trước nút "Sửa":

```tsx
                      <Link to={`/admin/books/${book.id}/update`}>
                        <Button variant="hairline">Cập nhật EPUB</Button>
                      </Link>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck` rồi `npm run lint`
Expected: cả hai exit 0. (Nếu eslint kêu về comment disable trong useMemo, sửa deps thành `[prepared, existingChapters, epubChapters]` và bỏ comment.)

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ChapterPreview.tsx src/routes/AdminBookUpdate.tsx src/routes/AdminImport.tsx src/routes/AdminBooks.tsx src/App.tsx
git commit -m "feat: admin page to update a book from a new EPUB (merge mode)"
```

---

### Task 5: Kiểm thử end-to-end + hoàn tất

**Files:** không sửa code (trừ khi phát hiện bug).

**Interfaces:** consume toàn bộ Task 1–4.

- [ ] **Step 1: Chạy dev server và đi hết flow**

Dùng preview tool (launch.json `npm run dev`, port 5173) hoặc bảo user tự chạy nếu thiếu env Supabase:

1. Đăng nhập tài khoản admin → `/admin/books`.
2. Nhấn "Cập nhật EPUB" trên một truyện có sẵn → trang update hiển thị đúng bìa/tựa/số chương.
3. Chọn file EPUB có NHIỀU chương hơn DB → kiểm tra tóm tắt diff: số chương cập nhật/thêm đúng, preview chương mới đúng index.
4. Xác nhận → kết quả hiển thị đúng số liệu; mở trang truyện thấy chương mới.
5. Kiểm tra trong DB (SQL Editor):
   - `select id from chapters where book_id = '<id>' and index = 1;` — id **không đổi** so với trước khi cập nhật;
   - `reading_progress`/`bookmarks` của user test còn nguyên;
   - `notifications` chỉ có record cho chương mới (không spam chương cũ);
   - `books.chapter_count` đúng.
6. Case EPUB ÍT chương hơn: cảnh báo vàng hiển thị; sau xác nhận chương thừa vẫn còn.
7. Case checkbox bìa: bật → `cover_url` đổi; không bật → giữ nguyên.
8. Case regression: `/admin/import` với EPUB mới hoạt động như cũ (parse, import, kết quả).

Expected: tất cả pass. Nếu có bug → dùng superpowers:systematic-debugging, sửa, commit riêng.

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit cuối (nếu có sửa) + báo cáo**

Tổng kết cho user: các commit đã tạo, migration cần áp (0010), lệnh deploy function (`supabase functions deploy admin-import --no-verify-jwt`), và các bước kiểm thử đã chạy/còn chờ user.
