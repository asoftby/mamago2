"use client";

import { useEffect } from "react";

/** Intercepting routes are shared by all blog slugs; regular articles must not appear in the news dialog. */
export function JournalRegularArticleNavigation({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return <p role="status" className="p-6 text-sm">Открываем статью…</p>;
}
