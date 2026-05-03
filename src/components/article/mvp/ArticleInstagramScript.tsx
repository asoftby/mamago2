"use client";

import Script from "next/script";

/**
 * Загружает Instagram embed.js только когда в статье есть Instagram-вставки.
 * Вынесен в Client Component — next/script в Server Component вызывает
 * баг Next.js 16 + webpack: ENOENT .next/browser/default-stylesheet.css
 */
export function ArticleInstagramScript() {
  return <Script src="https://www.instagram.com/embed.js" strategy="lazyOnload" />;
}
