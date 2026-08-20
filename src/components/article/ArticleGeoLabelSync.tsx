"use client";

import { useEffect } from "react";
import { useSetArticleGeoLabel } from "@/contexts/ArticleGeoLabelContext";

/**
 * Publishes this article's geo label to the header (see
 * ArticleGeoLabelContext) for the lifetime of the mount, clearing it on
 * unmount/navigation. Renders nothing.
 */
export function ArticleGeoLabelSync({ label }: { label: string }) {
  const setArticleGeoLabel = useSetArticleGeoLabel();

  useEffect(() => {
    setArticleGeoLabel(label);
    return () => setArticleGeoLabel(null);
  }, [label, setArticleGeoLabel]);

  return null;
}
