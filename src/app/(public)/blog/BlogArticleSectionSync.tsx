"use client";

import { useEffect } from "react";

/** Keep the shared journal navigation in sync on both client transitions and direct article loads. */
export function BlogArticleSectionSync({ slug }: { slug: string | null }) {
  useEffect(() => {
    const notify = (value: string | null) => {
      window.dispatchEvent(new CustomEvent("mamago:journal-article-section", {
        detail: { slug: value },
      }));
    };
    notify(slug);
    return () => notify(null);
  }, [slug]);
  return null;
}
