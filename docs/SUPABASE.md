# Hướng dẫn cài đặt Supabase

Tài liệu này hướng dẫn dựng backend Supabase cho Novel Reader **từ đầu đến chạy được**:
database + RLS, Auth (magic link / Google), Edge Function `get-chapter`, nạp nội dung, và
kiểm thử bảo mật. Có hai lối đi:

- **[Option A — Supabase Cloud](#option-a--supabase-cloud)**: dùng cho staging/production.
- **[Option B — Local (Docker)](#option-b--local-docker)**: dùng để phát triển, không cần tài khoản cloud.

> Đọc `SPEC.md` §4–§6 để hiểu vì sao tách `chapters` / `chapter_contents` và vì sao chương
> gated **chỉ** đi qua Edge Function.

---

## 0. Kiến trúc backend (đọc trước 2 phút)

```
                    ┌─────────────────────────────────────────┐
   Anon (Googlebot) │  books, chapters        → RLS: public    │
   ─────────────────┤  chapter_contents(free) → RLS: is_free   │
                    │                                          │
   User (JWT)       │  reading_progress, bookmarks → RLS: own  │
   ─────────────────┤                                          │
                    │  chapter_contents(gated) → CHỈ service    │
   Edge Function ───┤  read_events            → CHỈ service     │
   (service role)   └─────────────────────────────────────────┘
```

- **Frontend** (anon key) đọc trực tiếp: danh sách truyện, mục lục, và nội dung chương **free**.
- **Chương gated** không có policy nào cho anon → **chỉ** `get-chapter` (service role) đọc được,
  sau khi verify JWT + rate limit.
- `read_events` bật RLS nhưng **không có policy** = khóa hoàn toàn với client.

Các thành phần trong repo:

| Đường dẫn | Vai trò |
|---|---|
| `supabase/migrations/0001_init.sql` | Schema + RLS + trigger tạo profile |
| `supabase/functions/get-chapter/` | Edge Function lấy chương gated |
| `supabase/seed.sql` | 1 truyện mẫu (5 free + 1 gated) để test |
| `supabase/config.toml` | Cấu hình CLI + Auth + ports |
| `scripts/ingest-epub.ts` | Nạp EPUB → DB (service role, chạy local) |

---

## 1. Biến môi trường

Sao chép mẫu rồi điền giá trị thật:

```bash
cp .env.local.example .env.local
```

| Biến | Dùng ở đâu | Lấy từ đâu |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend + script ingest | Dashboard → Project Settings → **Data API** → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Project Settings → **API Keys** → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Script ingest + secret Edge Function | Project Settings → **API Keys** → `service_role` (bí mật!) |
| `IP_HASH_SALT` | Secret Edge Function | Tự sinh: `openssl rand -hex 32` |
| `VITE_TURNSTILE_SITE_KEY` | Frontend (tùy chọn) | Cloudflare Turnstile (xem §6) |

> ⚠️ **KHÔNG bao giờ** đặt tiền tố `VITE_` cho `SUPABASE_SERVICE_ROLE_KEY` — Vite sẽ nhúng nó
> vào bundle client và lộ toàn quyền database. `.env.local` đã nằm trong `.gitignore`, đừng commit.

---

## Option A — Supabase Cloud

### A1. Tạo project

1. Vào <https://supabase.com/dashboard> → **New project**.
2. Đặt tên, chọn **region** gần người dùng (VN → Singapore), đặt **Database Password** (lưu lại).
3. Chờ ~2 phút để project khởi tạo.
4. Vào **Project Settings** lấy `Project URL`, `anon key`, `service_role key` → điền vào `.env.local`.
   Ghi lại `project-ref` (chuỗi trong URL `https://<project-ref>.supabase.co`).

### A2. Cài Supabase CLI & link

```bash
npm i -g supabase           # hoặc: brew install supabase/tap/supabase
supabase login              # mở trình duyệt để xác thực
supabase link --project-ref <project-ref>
```

### A3. Nạp schema (migrations)

```bash
supabase db push
```

Lệnh này chạy `migrations/0001_init.sql`: tạo bảng, bật RLS, tạo policy, và trigger
`handle_new_user` (tự tạo dòng `profiles` mỗi khi có user mới).

**Kiểm tra nhanh** ở Dashboard → **Table Editor**: phải thấy 7 bảng (`profiles`, `books`,
`chapters`, `chapter_contents`, `reading_progress`, `bookmarks`, `read_events`) và mỗi bảng có
biểu tượng khóa RLS.

### A4. Đặt secret & deploy Edge Function

```bash
# Salt để hash IP (rate limit theo IP cho request anon)
supabase secrets set IP_HASH_SALT=$(openssl rand -hex 32)

# Deploy hàm. LƯU Ý: get-chapter tự verify JWT trong code (để cho phép cả anon
# đọc chương free), nên deploy với --no-verify-jwt.
supabase functions deploy get-chapter --no-verify-jwt
```

- `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` được Supabase **inject tự động** vào function
  runtime — **không cần** set thủ công.
- `config.toml` đã khai báo `verify_jwt = false` cho hàm này; cờ `--no-verify-jwt` khi deploy đảm
  bảo hành vi khớp trên cloud.

### A5. Cấu hình Auth

Vào **Authentication → URL Configuration**:

- **Site URL**: URL production của frontend (vd `https://doctruyen.pages.dev`). Khi dev để
  `http://localhost:5173`.
- **Redirect URLs**: thêm mọi origin sẽ nhận magic link / OAuth callback, ví dụ:
  ```
  http://localhost:5173
  http://localhost:5173/**
  https://doctruyen.pages.dev/**
  ```
  (App gắn `?next=...` vào redirect nên cần cho phép cả subpath — dùng `/**`.)

**Email / Magic link** (mặc định đã bật): **Authentication → Providers → Email** để bật
"Email OTP / Magic Link". Bản free của Supabase gửi email qua SMTP dùng chung, giới hạn thấp
và dễ vào spam — production nên cấu hình **Custom SMTP** (Resend, SendGrid…) ở
**Project Settings → Auth → SMTP Settings**.

**Google OAuth** (xem §5 để lấy Client ID/Secret): **Authentication → Providers → Google** →
bật, dán Client ID + Client Secret → Save.

**Turnstile captcha** (tùy chọn, chống bot đăng nhập): **Authentication → Attack Protection →
Enable Captcha protection** → chọn **Turnstile** → dán **Secret key** của Turnstile. Rồi điền
`VITE_TURNSTILE_SITE_KEY` (site key, không phải secret) vào `.env.local`. Khi biến này trống,
component captcha tự ẩn (tiện cho dev).

### A6. Nạp dữ liệu mẫu (tùy chọn, để test ngay)

Cách nhanh nhất: mở **SQL Editor** trên Dashboard, dán nội dung `supabase/seed.sql`, chạy.
Sẽ có 1 truyện `thu-nghiem` với 5 chương free + 1 chương gated.

→ Tiếp tục [§4 Nạp nội dung thật (EPUB)](#4-nạp-nội-dung-epub) và
[§5 Google OAuth](#5-cấu-hình-google-oauth-chi-tiết) / [§7 Kiểm thử](#7-kiểm-thử-bảo-mật-bắt-buộc-trước-deploy).

---

## Option B — Local (Docker)

Cần **Docker Desktop** đang chạy.

### B1. Khởi động stack local

```bash
supabase start
```

Lần đầu sẽ kéo image (vài phút). Khi xong, CLI in ra:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
anon key: eyJ...
service_role key: eyJ...
```

`supabase start` **tự nạp** `migrations/0001_init.sql` **và** `seed.sql`.

Điền `.env.local`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key ở trên>
SUPABASE_SERVICE_ROLE_KEY=<service_role key ở trên>
IP_HASH_SALT=$(openssl rand -hex 32)   # hoặc một chuỗi bất kỳ khi dev
```

### B2. Chạy Edge Function local

```bash
supabase functions serve get-chapter --env-file .env.local --no-verify-jwt
```

Giữ terminal này chạy song song với `npm run dev`.

### B3. Google OAuth ở local (tùy chọn)

Sửa `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_SECRET)"
```

Thêm `GOOGLE_CLIENT_ID` / `GOOGLE_SECRET` vào `.env.local` rồi `supabase stop && supabase start`
để nạp lại. Nếu chỉ cần magic link, có thể bỏ qua — email khi dev hiện trong **Inbucket** tại
<http://127.0.0.1:54324> (không gửi ra ngoài thật).

### B4. Reset khi cần làm lại từ đầu

```bash
supabase db reset      # xóa & nạp lại migrations + seed
supabase stop          # tắt stack
```

---

## 4. Nạp nội dung (EPUB)

Script `scripts/ingest-epub.ts` đọc `SUPABASE_SERVICE_ROLE_KEY` từ `.env.local` để **bỏ qua RLS**
khi ghi. Vì dùng service role, **chỉ chạy local**, không đưa lên CI/CD.

```bash
npm run ingest -- ./scripts/epub/ten-truyen.epub --slug ten-truyen --free 5 --publish
```

| Cờ | Ý nghĩa |
|---|---|
| `--slug` | **Bắt buộc.** Định danh trên URL `/truyen/<slug>`. |
| `--free N` | Số chương đầu đặt `is_free = true` (mặc định `5`). Đây là "mồi" cho Google index. |
| `--publish` | Đặt `is_published = true` ngay. Bỏ cờ này thì truyện ở trạng thái nháp. |
| `--title` / `--author` | Ghi đè metadata lấy từ EPUB. |

Script sẽ: upsert `books` theo slug → tách chương theo TOC → insert `chapters` + `chapter_contents`
→ cập nhật `chapter_count` → trích + upload ảnh bìa vào bucket `covers`.

> Muốn mở truyện đã nạp ở dạng nháp: chạy lại kèm `--publish`, hoặc `update books set is_published = true where slug = '...'`.

---

## 4b. Nhập truyện qua giao diện admin (`/admin/import`)

Ngoài CLI, có thể nhập truyện ngay trên web: chọn file `.epub`, **xem trước 10 chương đầu**
+ ảnh bìa, rồi mới ghi vào DB. File được phân tích **trong trình duyệt** (dùng chung
`src/lib/epub.ts` với CLI); việc ghi DB đi qua Edge Function `admin-import` (service role),
nên anon key không bao giờ chạm được quyền ghi.

### 4b.1 Nạp migration vai trò admin

`migrations/0002_admin_role.sql` thêm cột `profiles.role` (`user` | `admin`) và **thu hồi quyền
UPDATE** để user không tự nâng quyền. Nạp cùng các migration khác:

```bash
supabase db push          # cloud
# hoặc local: supabase db reset (đã tự nạp mọi migration)
```

### 4b.2 Cấp quyền admin cho một tài khoản

Đăng nhập bằng tài khoản sẽ làm admin (để có dòng trong `profiles`), rồi ở **SQL Editor** chạy:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ban@example.com');
```

> Chỉ service role đặt được `role` (client đã bị thu hồi quyền UPDATE cột này).

### 4b.3 Deploy Edge Function

```bash
# Tự verify JWT + check admin trong code → deploy với --no-verify-jwt.
supabase functions deploy admin-import --no-verify-jwt
```

Local: `supabase functions serve admin-import --env-file .env.local --no-verify-jwt`.
`SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` được inject sẵn — không cần set thủ công.

### 4b.4 Dùng

Vào `/admin/import` (link **"Nhập truyện"** hiện trên header khi bạn là admin) → chọn `.epub` →
kiểm tra tựa/tác giả/slug/số chương free + xem trước 10 chương → **Nhập … chương vào DB**.
Function upsert `books` theo slug, thay toàn bộ `chapters` + `chapter_contents`, và upload ảnh bìa.

> Truyện rất dài (hàng nghìn chương) nên nhập bằng CLI để tránh giới hạn kích thước request của
> Edge Function.

---

## 4c. Quản lý truyện qua giao diện admin (`/admin/books`)

Sau khi nhập, vào `/admin/books` (link **"Quản lý truyện"** trong menu tài khoản khi bạn là
admin) để xem **toàn bộ** truyện — kể cả bản nháp (`is_published = false`) — sửa tựa/tác
giả/mô tả/thể loại/trạng thái, publish/ẩn nhanh, hoặc xoá hẳn một truyện.

Khác với `admin-import`, thao tác này **không đi qua Edge Function**: `migrations/0003_admin_books_manage.sql`
thêm hàm `is_admin()` và 3 RLS policy trên bảng `books` (SELECT/UPDATE/DELETE) cho phép admin
tự thao tác thẳng bằng JWT của mình — vì đây chỉ là sửa 1 hàng metadata, không đụng Storage hay
phải thay hàng loạt `chapters`. Nạp cùng các migration khác:

```bash
supabase db push          # cloud
# hoặc local: supabase db reset
```

Xoá một truyện sẽ **cascade xoá** `chapters` + `chapter_contents` + `reading_progress` +
`bookmarks` liên quan (đã khai báo `on delete cascade` từ `0001`). **Giới hạn đã biết**: ảnh
bìa trong bucket Storage `covers` **không** tự xoá theo (SQL cascade không chạm Storage) — chấp
nhận để lại file orphan ở v1, dọn thủ công trong Storage Dashboard nếu cần.

> Trường `genre` (mảng text tự do) trước đây không có đường ghi nào — cả CLI ingest lẫn
> `admin-import` đều không set. Giờ sửa được qua `/admin/books/<id>` (ô nhập, phân tách bằng
> dấu phẩy).

---

## 5. Cấu hình Google OAuth chi tiết

1. Vào <https://console.cloud.google.com> → tạo/ chọn một **Project**.
2. **APIs & Services → OAuth consent screen**: chọn **External**, điền tên app, email hỗ trợ,
   thêm scope `.../auth/userinfo.email` và `.../auth/userinfo.profile`. Khi còn "Testing", thêm
   email của bạn vào **Test users**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:5173`, và origin production.
   - **Authorized redirect URIs**: dán **callback của Supabase**:
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
     (Local: `http://127.0.0.1:54321/auth/v1/callback`.)
4. Lấy **Client ID** + **Client Secret** → dán vào Supabase (A5) hoặc `.env.local` (B3).

> Luồng: nút "Tiếp tục với Google" → Supabase → Google → callback về Supabase → redirect về
> `redirectTo` của app (`window.location.origin + next`). Vì vậy origin của app phải nằm trong
> **Redirect URLs** ở §A5.

---

## 6. Turnstile (chống bot đăng nhập)

1. Cloudflare Dashboard → **Turnstile → Add site**.
2. Domain: thêm `localhost` và domain production.
3. Lấy **Site Key** → `.env.local` → `VITE_TURNSTILE_SITE_KEY=...`.
4. Lấy **Secret Key** → dán vào Supabase **Auth → Attack Protection → Captcha** (§A5).

App tự gắn `captchaToken` vào `signInWithOtp`. Nếu `VITE_TURNSTILE_SITE_KEY` trống, widget ẩn
và bỏ qua bước captcha (thuận tiện khi dev).

---

## 7. Kiểm thử bảo mật (bắt buộc trước deploy)

Đây là 3 mục trong Definition of Done (`SPEC.md` §13). Đặt biến cho gọn:

```bash
URL=$VITE_SUPABASE_URL
ANON=$VITE_SUPABASE_ANON_KEY
```

### 7.1 RLS — anon chỉ thấy chương free

```bash
curl -s "$URL/rest/v1/chapter_contents?select=chapter_id" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" | jq 'length'
```

Kết quả phải **chỉ bằng số chương `is_free = true`** (seed: 5). Nếu nhiều hơn → RLS sai, **dừng deploy**.

### 7.2 Gate — chương gated không JWT → 401

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/functions/v1/get-chapter" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"bookSlug":"thu-nghiem","chapterIndex":6}'
```

Phải trả **`401`** (chương 6 gated, không có Bearer JWT của user). Chương free (`"chapterIndex":1`)
phải trả `200`.

### 7.3 Rate limit — spam → 429

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code} " -X POST "$URL/functions/v1/get-chapter" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d '{"bookSlug":"thu-nghiem","chapterIndex":1}'
done; echo
```

Sau ~10 request anon/phút theo IP, phải bắt đầu thấy **`429`** (ngưỡng trong
`functions/get-chapter/index.ts`: anon 10/phút, user 20/phút & 60/5phút).

---

## 8. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| App trắng, console báo *"Thiếu VITE_SUPABASE_URL…"* | Chưa tạo `.env.local` hoặc thiếu key. Xem §1. Nhớ **restart** `npm run dev` sau khi sửa `.env.local`. |
| `get-chapter` trả **401** cho **cả chương free** | Deploy quên `--no-verify-jwt` → gateway chặn trước khi vào code. Deploy lại như §A4. |
| Đăng nhập Google báo **redirect_uri_mismatch** | Redirect URI ở Google Console chưa khớp `https://<ref>.supabase.co/auth/v1/callback`. Xem §5. |
| Magic link mở ra nhưng **không đăng nhập được** | Origin của app chưa nằm trong **Redirect URLs** (§A5). Local dùng Inbucket `:54324` để đọc mail. |
| `db push` báo lỗi quyền / kết nối | Chưa `supabase link`, hoặc sai Database Password. Link lại (§A2). |
| Ingest báo *"Thiếu … SERVICE_ROLE_KEY"* | `.env.local` chưa có `SUPABASE_SERVICE_ROLE_KEY` (không có tiền tố `VITE_`). |
| `429` xuất hiện quá sớm khi test | Đúng như thiết kế — chờ 1 phút cho cửa sổ rate limit trôi qua, hoặc test bằng user JWT (ngưỡng cao hơn). |

---

## 9. Checklist trước khi public

- [ ] `supabase db push` chạy sạch, thấy đủ 7 bảng có RLS.
- [ ] `get-chapter` deploy với `--no-verify-jwt`, secret `IP_HASH_SALT` đã set.
- [ ] Auth: Site URL + Redirect URLs đúng cho production; Custom SMTP đã cấu hình.
- [ ] Google OAuth + Turnstile hoạt động trên domain production.
- [ ] Ba bài test §7 đều đạt (chương free anon xem được, gated → 401, spam → 429).
- [ ] Cloudflare (xem `README.md` §Bảo mật): Bot Fight Mode, WAF, Rate Limiting cho
      `/functions/v1/get-chapter` = 30 req/phút/IP, block ASN datacenter.
