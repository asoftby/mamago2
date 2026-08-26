"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaLibraryPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type MediaLibraryPageLoader<T> = (args: {
  cursor: string | null;
  limit: number;
}) => Promise<MediaLibraryPage<T>>;

/** Appends `next` to `prev`, skipping any id already present. Exported for unit testing. */
export function mergeMediaLibraryItems<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((item) => item.id));
  const merged = [...prev];
  for (const item of next) {
    if (item?.id && !seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }
  return merged;
}

/**
 * Cursor-paginated media library state: initial load + infinite-scroll append,
 * with request-guard refs so a stray extra sentinel trigger can't double-fetch.
 * Resets automatically when `ownerKey` changes (e.g. article author switched).
 */
export function useMediaLibraryPager<T extends { id: string }>(options: {
  pageSize: number;
  loadPage: MediaLibraryPageLoader<T> | null | undefined;
  ownerKey?: string | null;
}) {
  const { pageSize, loadPage, ownerKey } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const hasMoreRef = useRef(false);
  const requestIdRef = useRef(0);
  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    cursorRef.current = null;
    inFlightRef.current = false;
    hasMoreRef.current = false;
    setItems([]);
    setHasMore(false);
    setLoadingInitial(false);
    setLoadingMore(false);
  }, []);

  const loadInitial = useCallback(async () => {
    const loader = loadPageRef.current;
    if (!loader) return;
    const requestId = ++requestIdRef.current;
    cursorRef.current = null;
    inFlightRef.current = true;
    setItems([]);
    setHasMore(false);
    setLoadingInitial(true);
    try {
      const page = await loader({ cursor: null, limit: pageSize });
      if (requestId !== requestIdRef.current) return;
      setItems(page.items.filter((item) => item?.id));
      cursorRef.current = page.nextCursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingInitial(false);
        inFlightRef.current = false;
      }
    }
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    const loader = loadPageRef.current;
    if (!loader || inFlightRef.current || !hasMoreRef.current) return;
    const requestId = requestIdRef.current;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const page = await loader({ cursor: cursorRef.current, limit: pageSize });
      if (requestId !== requestIdRef.current) return;
      setItems((prev) => mergeMediaLibraryItems(prev, page.items));
      cursorRef.current = page.nextCursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
        inFlightRef.current = false;
      }
    }
  }, [pageSize]);

  useEffect(() => {
    reset();
  }, [ownerKey, reset]);

  return { items, loadingInitial, loadingMore, hasMore, loadInitial, loadMore, reset };
}
