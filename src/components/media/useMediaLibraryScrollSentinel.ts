"use client";

import { useEffect, type RefObject } from "react";

/**
 * Fires `onLoadMore` when the sentinel element scrolls into view, via
 * IntersectionObserver rather than a scroll handler. No-ops (and disconnects)
 * once `hasMore` is false, so exhausted lists never trigger further requests.
 */
export function useMediaLibraryScrollSentinel(options: {
  active: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  sentinelRef: RefObject<HTMLElement | null>;
  rootRef?: RefObject<HTMLElement | null>;
}) {
  const { active, hasMore, onLoadMore, sentinelRef, rootRef } = options;

  useEffect(() => {
    if (!active || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root: rootRef?.current ?? null, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active, hasMore, onLoadMore, sentinelRef, rootRef]);
}
