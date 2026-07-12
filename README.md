# Novel Reader

Web app đọc truyện chữ tiếng Việt — ưu tiên **trải nghiệm đọc: đơn giản, nhẹ, mượt**.
Nội dung được bảo vệ ở mức chặn bot phổ thông nhưng vẫn cho Google index phần công khai.

> Xem `SPEC.md` (bản gốc) để hiểu đầy đủ mục tiêu và các đánh đổi thiết kế.

## Stack

- **Frontend:** Vite + React 18 + TypeScript, React Router v6, Tailwind CSS (theming bằng CSS vars)
- **State:** TanStack Query (server) + Zustand (settings đọc, persist localStorage)
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **Bảo mật/CDN:** Cloudflare (Bot Fight, WAF, Rate Limiting, Turnstile)

## Cấu trúc

```
src/
  routes/        Library · BookDetail · Reader · Auth · NotFound
  components/
    reader/      ReaderPane · ReaderToolbar · SettingsSheet · ChapterNav
    ui/          primitives (Button, IconButton, Spinner, icons)
  lib/           supabase · api · progress · auth · types
  stores/        readerSettings (zustand + localStorage)
  styles/        themes.css (3 theme + reader typography)
supabase/
  migrations/    0001_init.sql  (schema + RLS)
  functions/     get-chapter/   (Edge Function lấy chương gated)
  seed.sql       dữ liệu mẫu
scripts/
  ingest-epub.ts EPUB → chapters
```

## Chạy local

### 1. Cài dependencies

```bash
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.local.example .env.local
# Điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (và SERVICE_ROLE_KEY, IP_HASH_SALT cho backend)
```

### 3. Supabase

**Option A — Supabase Cloud:**

```bash
npm i -g supabase
supabase link --project-ref <project-ref>
supabase db push                 # nạp migrations/0001_init.sql
supabase secrets set IP_HASH_SALT=$(openssl rand -hex 32)
supabase functions deploy get-chapter
```

**Option B — Local (Docker):**

```bash
supabase start                   # tự nạp migrations + seed.sql
supabase functions serve get-chapter --env-file .env.local
```

Bật **Google OAuth** ở Supabase Dashboard → Authentication → Providers (hoặc trong `config.toml`).

### 4. Chạy frontend

```bash
npm run dev
```

## Nạp nội dung (EPUB)

Chạy **local**, dùng service role key (đã có trong `.env.local`):

```bash
npm run ingest -- ./scripts/epub/ten-truyen.epub --slug ten-truyen --free 5 --publish
```

Cờ: `--slug` (bắt buộc), `--free N` (số chương đầu mở tự do, mặc định 5),
`--title` / `--author` (ghi đè metadata), `--publish` (mở truyện ngay).

## Kiểm thử bảo mật (bắt buộc trước deploy)

- **RLS:** gọi `chapter_contents` bằng anon key → chỉ trả chương `is_free = true`.
- **Gate:** gọi `get-chapter` không JWT trên chương gated → `401`.
- **Rate limit:** spam `get-chapter` 25 lần/phút → `429`.

Cloudflare (làm trước khi public): Bot Fight Mode + WAF, Rate Limiting
`/functions/v1/get-chapter` = 30 req/phút/IP, Turnstile ở trang đăng nhập,
block ASN datacenter trên route đọc.

## Reader UX (tóm tắt)

- Pane căn giữa `max-width: 68ch`, padding ngang mobile 20px.
- 5 cỡ chữ (16 / 17.5 / 19 / 21 / 23px), 3 theme (paper/sepia/night), đổi font serif↔sans.
- Toolbar auto-hide khi cuộn xuống; tap giữa màn hình để hiện lại.
- Prefetch chương kế khi đọc quá 50%; lưu tiến độ debounce 2s + `sendBeacon` khi rời trang.
- Tôn trọng `prefers-reduced-motion`.

## Scripts

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run build` | Typecheck + build production |
| `npm run preview` | Xem thử bản build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ingest -- <epub> --slug <slug>` | Nạp truyện từ EPUB |
