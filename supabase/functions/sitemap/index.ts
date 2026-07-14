// Edge Function: sitemap
// Trả về sitemap.xml động — cập nhật theo truyện đã publish. Dùng service role
// để đọc books (chỉ cột công khai). Nội dung chương KHÔNG đưa vào sitemap.
//
// Deploy: supabase functions deploy sitemap --no-verify-jwt
// Cấu hình host route /sitemap.xml → function này (hoặc trỏ robots.txt tới
// URL function trực tiếp).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Domain công khai của site (đặt qua secret): dùng làm gốc cho URL.
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://example.com').replace(
  /\/$/,
  '',
);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<'
      ? '&lt;'
      : c === '>'
        ? '&gt;'
        : c === '&'
          ? '&amp;'
          : c === "'"
            ? '&apos;'
            : '&quot;',
  );
}

Deno.serve(async () => {
  const { data: books, error } = await admin
    .from('books')
    .select('slug, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(`error: ${error.message}`, { status: 500 });
  }

  const urls = [
    `<url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq></url>`,
    ...(books ?? []).map(
      (b) =>
        `<url><loc>${SITE_URL}/truyen/${xmlEscape(b.slug)}</loc>` +
        `<lastmod>${new Date(b.created_at).toISOString()}</lastmod>` +
        `<changefreq>daily</changefreq></url>`,
    ),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join('\n') +
    `\n</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=1800',
    },
  });
});
