import { useEffect } from 'react';

/**
 * SEO nhẹ cho Vite SPA (không SSR): cập nhật <title>, meta description,
 * Open Graph / Twitter, canonical và JSON-LD theo route. Crawler hiện đại
 * (Googlebot) render JS nên đọc được; đây là giải pháp trong khả năng của SPA.
 */

const SITE = 'Đọc Truyện';

interface SeoInput {
  title?: string;
  description?: string;
  image?: string | null;
  canonical?: string;
  type?: 'website' | 'article' | 'book';
  jsonLd?: object | object[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useSeo({
  title,
  description,
  image,
  canonical,
  type = 'website',
  jsonLd,
}: SeoInput) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} — Truyện chữ tiếng Việt`;

    if (description) upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:site_name', SITE);
    upsertMeta('property', 'og:title', title ?? SITE);
    upsertMeta('property', 'og:type', type);
    if (description) upsertMeta('property', 'og:description', description);
    if (image) upsertMeta('property', 'og:image', image);

    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title ?? SITE);
    if (description) upsertMeta('name', 'twitter:description', description);
    if (image) upsertMeta('name', 'twitter:image', image);

    const href = canonical ?? window.location.href;
    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);

    const SCRIPT_ID = 'route-jsonld';
    document.getElementById(SCRIPT_ID)?.remove();
    if (ld) {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'application/ld+json';
      script.textContent = ld;
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [title, description, image, canonical, type, ld]);
}
