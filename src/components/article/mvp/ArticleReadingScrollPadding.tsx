"use client";

import { useEffect } from "react";

/**
 * Добавляет только дополнительный offset поверх локального scroll-margin заголовков.
 * Обычная статья не меняет scroll-padding у <html>, чтобы клиентская навигация Next.js
 * всегда открывала страницу с самого начала.
 */
export function ArticleReadingScrollPadding({ extraTopRem = 0 }: { extraTopRem?: number }) {
  useEffect(() => {
    if (extraTopRem <= 0) return;

    const el = document.documentElement;
    const prev = el.style.scrollPaddingTop;
    el.style.scrollPaddingTop = `${extraTopRem}rem`;
    return () => {
      if (prev) el.style.scrollPaddingTop = prev;
      else el.style.removeProperty("scroll-padding-top");
    };
  }, [extraTopRem]);
  return null;
}
