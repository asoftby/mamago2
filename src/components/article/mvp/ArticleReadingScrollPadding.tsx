"use client";

import { useEffect } from "react";

const BASE_REM = 5.5;

/** Якорные ссылки #heading-* учитывают высоту шапки при прокрутке viewport. */
export function ArticleReadingScrollPadding({ extraTopRem = 0 }: { extraTopRem?: number }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.scrollPaddingTop;
    el.style.scrollPaddingTop = `${BASE_REM + extraTopRem}rem`;
    return () => {
      if (prev) el.style.scrollPaddingTop = prev;
      else el.style.removeProperty("scroll-padding-top");
    };
  }, [extraTopRem]);
  return null;
}
