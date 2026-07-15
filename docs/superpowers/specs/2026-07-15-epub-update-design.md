# Cập nhật truyện từ file EPUB — Thiết kế

**Ngày:** 2026-07-15
**Trạng thái:** Đã duyệt

## Mục tiêu

Cho phép admin cập nhật một truyện đã có trong DB bằng một file EPUB mới
(thường là bản có thêm chương, hoặc bản sửa nội dung chương cũ) mà **không
làm mất tiến độ đọc, bookmark của người dùng** và **không spam thông báo**
cho người theo dõi.

## Bối cảnh & vấn đề

Flow import hiện tại (`admin-import`) upsert book theo slug rồi **xóa toàn
bộ chương và insert lại**. Dùng nó để cập nhật truyện đã có người đọc gây
hai hậu quả:

1. `reading_progress`, `bookmarks` tham chiếu `chapters(id)` với
   `on delete cascade` → xóa chương là mất sạch tiến độ đọc và bookmark.
2. Trigger `on_chapter_insert` (migration 0008) fanout thông báo "chương
   mới" cho follower trên **mỗi** insert → re-import 500 chương tạo 500
   thông báo rác cho mỗi follower.

## Quyết định thiết kế (đã chốt với user)

| Quyết định | Lựa chọn |
|---|---|
| Kiểu cập nhật | **Merge thông minh theo index**: chương trùng index → UPDATE tại chỗ (giữ chapter id); chương mới → append |
| Vị trí UI | Nút "Cập nhật EPUB" trên từng hàng ở `/admin/books` → route mới `/admin/books/:id/update` |
| Metadata | Giữ nguyên tựa/tác giả/slug/publish; checkbox tùy chọn "Cập nhật ảnh bìa từ EPUB" |
| EPUB ít chương hơn DB | Giữ nguyên chương thừa + hiển thị cảnh báo trước khi xác nhận |
| Backend | Mở rộng Edge Function `admin-import` hiện có (thêm chế độ merge), không tạo function mới |

## 1. Luồng người dùng

Trang **Quản lý truyện** (`/admin/books`): mỗi hàng thêm nút **"Cập nhật
EPUB"** dẫn đến `/admin/books/:id/update`. Route mới lazy-load (kéo theo
jszip + fast-xml-parser như `/admin/import`).

Trang cập nhật (`src/routes/AdminBookUpdate.tsx`), bọc trong `AdminGate`:

1. Load thông tin truyện hiện tại: bìa, tựa, slug, số chương trong DB, và
   danh sách tựa chương hiện có (để so diff).
2. Chọn file `.epub` → parse trong trình duyệt bằng `prepareEpub` (tái dùng
   nguyên vẹn từ `src/lib/admin.ts`).
3. Hiển thị **tóm tắt diff** trước khi xác nhận:
   - *X chương sẽ được cập nhật nội dung* (index trùng giữa DB và EPUB);
   - *Y chương mới sẽ được thêm* (index > số chương DB), kèm preview
     mở/đóng từng chương như trang import (tái dùng pattern
     `ChapterPreview`);
   - Cảnh báo vàng nếu EPUB **ít** chương hơn DB: "Z chương trong DB nằm
     ngoài EPUB sẽ giữ nguyên";
   - Cảnh báo nếu tựa chương EPUB ≠ tựa chương DB cùng index (dấu hiệu
     lệch thứ tự chương) — liệt kê tối đa vài mục đầu tiên.
4. Checkbox **"Cập nhật ảnh bìa từ EPUB"**: mặc định tắt, chỉ hiển thị khi
   EPUB có bìa.
5. Nút xác nhận → gọi edge function chế độ merge → hiển thị kết quả: số
   chương cập nhật / thêm mới / giữ nguyên, link xem trang truyện.

## 2. Backend — mở rộng Edge Function `admin-import`

Payload thêm hai trường tùy chọn:

```ts
interface Payload {
  // ... các trường hiện có (slug, title, author, free, publish, chapters, cover)
  updateBookId?: string;   // có mặt → chế độ merge
  updateCover?: boolean;   // chỉ dùng ở chế độ merge
}
```

Khi có `updateBookId`, function chạy **chế độ merge** và bỏ qua
`slug`/`title`/`author`/`free`/`publish` (client không cần gửi; validate
slug được nới lỏng trong chế độ này — chỉ `chapters` là bắt buộc):

1. Verify JWT + check `profiles.role = 'admin'` (như cũ).
2. Fetch book theo `updateBookId` → trả 404 `book_not_found` nếu không có.
3. Fetch toàn bộ chương hiện có (`id, index, title, is_free`) theo
   `index` tăng dần.
4. **Chương trùng index** (`index ≤ existingCount`):
   - Batch **upsert `chapters` theo `id`** — giữ `book_id`, `index`,
     `is_free` từ row cũ; ghi `title`, `word_count` mới.
   - Batch **upsert `chapter_contents` theo `chapter_id`** (PK) với nội
     dung mới.
   - Chapter id không đổi → `reading_progress`/`bookmarks` còn nguyên.
     Upsert đi path `ON CONFLICT DO UPDATE` → trigger AFTER INSERT không
     kích hoạt → không spam thông báo.
5. **Chương mới** (`index > existingCount`): insert `chapters` +
   `chapter_contents` theo batch (chunk 200/100 như flow cũ),
   `is_free = false`. Trigger fanout thông báo chương mới cho follower —
   đúng hành vi mong muốn.
6. EPUB ngắn hơn DB: các chương `index > epubCount` **giữ nguyên**, không
   xóa.
7. Cập nhật `books.chapter_count = max(existingCount, epubCount)`.
8. Nếu `updateCover === true` và payload có `cover`: upload đè lên path
   `<slug>.<ext>` trong bucket `covers` (upsert như cũ) + update
   `books.cover_url`.
9. Response chế độ merge:

```ts
interface AdminUpdateResult {
  bookId: string;
  slug: string;
  chaptersUpdated: number; // chương trùng index đã ghi đè nội dung
  chaptersAdded: number;   // chương mới append
  chaptersKept: number;    // chương DB ngoài phạm vi EPUB, giữ nguyên
  coverUrl: string | null; // URL mới nếu có cập nhật bìa
}
```

Chế độ import mới (không có `updateBookId`) giữ nguyên hành vi và response
hiện tại — không breaking change.

## 3. Frontend lib

- `src/lib/admin.ts`: thêm `adminUpdateFromEpub(input: { bookId: string;
  parsed: ParsedEpub; coverBase64: string | null; updateCover: boolean })`
  gọi function `admin-import` với payload merge; thêm type
  `AdminUpdateResult`. Xử lý lỗi qua `extractStatus`/`messageForStatus`
  hiện có (bổ sung message cho 404).
- `src/lib/adminBooks.ts`: thêm hàm fetch tựa chương của một book
  (`index, title`) phục vụ diff — dùng client supabase thường. Cần
  migration mới `0010_admin_chapters_select.sql` thêm policy
  `admin select all chapters` (RLS 0001 chỉ cho SELECT chương của truyện
  đã publish, còn trang cập nhật cần đọc cả truyện nháp).
- `src/App.tsx`: đăng ký route lazy `/admin/books/:id/update`.
- `src/routes/AdminBooks.tsx`: thêm nút "Cập nhật EPUB" mỗi hàng.

## 4. Giới hạn chấp nhận & xử lý lỗi

- **Merge theo index, không theo nội dung.** Nếu EPUB mới đánh lại thứ tự
  chương, nội dung ghi đè sẽ lệch. Giảm thiểu bằng cảnh báo so tựa chương
  ở bước preview; admin chịu trách nhiệm xác nhận.
- Nội dung chương trùng index **luôn được ghi đè** (không so sánh hash) —
  đơn giản và đúng; chấp nhận write thừa khi nội dung không đổi.
- `is_free` của chương mới append mặc định `false`; admin chỉnh sau nếu
  cần (ngoài phạm vi tính năng này).
- Lỗi parse EPUB, lỗi mạng, 401/403 hiển thị như trang import hiện tại;
  thêm case 404 book không tồn tại.
- Deploy: `supabase functions deploy admin-import --no-verify-jwt` (như
  ghi chú sẵn trong file function).

## 5. Kiểm thử

Project chưa có test infra; kiểm chứng bằng:

1. `tsc` typecheck + eslint pass.
2. Chạy dev server, import một EPUB mẫu thành truyện mới.
3. Cập nhật truyện đó bằng EPUB có thêm chương, xác nhận:
   - chapter id các chương cũ **không đổi** (query trực tiếp DB);
   - chương mới xuất hiện đúng thứ tự, `chapter_count` đúng;
   - `reading_progress`/`bookmarks` tạo trước đó còn nguyên;
   - follower nhận thông báo **chỉ** cho chương mới.
4. Case EPUB ngắn hơn: cảnh báo hiển thị, chương thừa giữ nguyên.
5. Case checkbox bìa: bật → `cover_url` đổi; tắt → giữ nguyên.
