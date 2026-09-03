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

/**
 * Keep picker data warm for an editor session, but not indefinitely: another
 * tab/user can still change the library, so a stale snapshot is refreshed.
 */
export const MEDIA_LIBRARY_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

const invalidationVersionByOwner = new Map<string, number>();

function normalizeOwnerKey(ownerKey?: string | null): string {
  const normalized = ownerKey?.trim();
  return normalized || "__current-user__";
}

function getInvalidationVersion(ownerKey?: string | null): number {
  return invalidationVersionByOwner.get(normalizeOwnerKey(ownerKey)) ?? 0;
}

/**
 * Mark every mounted picker for this owner stale. The next open performs one
 * fresh initial-page request instead of serving the old snapshot.
 */
export function invalidateMediaLibraryClientCache(ownerKey?: string | null): void {
  const key = normalizeOwnerKey(ownerKey);
  invalidationVersionByOwner.set(key, getInvalidationVersion(ownerKey) + 1);
}

export function shouldReuseMediaLibrarySnapshot(args: {
  loadedOwnerKey: string | null;
  ownerKey?: string | null;
  loadedAt: number;
  now: number;
  loadedInvalidationVersion: number;
  currentInvalidationVersion: number;
  ttlMs?: number;
}): boolean {
  const ttlMs = args.ttlMs ?? MEDIA_LIBRARY_CLIENT_CACHE_TTL_MS;
  return (
    args.loadedOwnerKey === normalizeOwnerKey(args.ownerKey) &&
    args.loadedAt > 0 &&
    args.now - args.loadedAt < ttlMs &&
    args.loadedInvalidationVersion === args.currentInvalidationVersion
  );
}

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
 * Cursor-paginated media library state: initial load + infinite-scroll append.
 *
 * Reopening the same picker within the TTL reuses the already loaded pages
 * instead of clearing state and hitting the API/DB again. A stale snapshot is
 * refreshed on open. Upload flows can explicitly invalidate by owner so newly
 * created media appears on the next open without waiting for the TTL.
 *
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
  const loadedOwnerKeyRef = useRef<string | null>(null);
  const loadedAtRef = useRef(0);
  const loadedInvalidationVersionRef = useRef(-1);
  loadPageRef.current = loadPage;

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    cursorRef.current = null;
    inFlightRef.current = false;
    hasMoreRef.current = false;
    loadedOwnerKeyRef.current = null;
    loadedAtRef.current = 0;
    loadedInvalidationVersionRef.current = -1;
    setItems([]);
    setHasMore(false);
    setLoadingInitial(false);
    setLoadingMore(false);
  }, []);

  const loadInitial = useCallback(async () => {
    const loader = loadPageRef.current;
    if (!loader || inFlightRef.current) return;

    const currentInvalidationVersion = getInvalidationVersion(ownerKey);
    const now = Date.now();
    if (
      shouldReuseMediaLibrarySnapshot({
        loadedOwnerKey: loadedOwnerKeyRef.current,
        ownerKey,
        loadedAt: loadedAtRef.current,
        now,
        loadedInvalidationVersion: loadedInvalidationVersionRef.current,
        currentInvalidationVersion,
      })
    ) {
      return;
    }

    const normalizedOwnerKey = normalizeOwnerKey(ownerKey);
    const hasSnapshotForOwner =
      loadedOwnerKeyRef.current === normalizedOwnerKey && loadedAtRef.current > 0;
    const requestId = ++requestIdRef.current;
    cursorRef.current = null;
    inFlightRef.current = true;

    // First load still shows the normal loading state. A stale snapshot stays
    // visible while it is refreshed, avoiding the "empty grid -> reload" flash.
    if (!hasSnapshotForOwner) {
      setItems([]);
      setHasMore(false);
      setLoadingInitial(true);
    }

    try {
      const page = await loader({ cursor: null, limit: pageSize });
      if (requestId !== requestIdRef.current) return;
      setItems(page.items.filter((item) => item?.id));
      cursorRef.current = page.nextCursor;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      loadedOwnerKeyRef.current = normalizedOwnerKey;
      loadedAtRef.current = Date.now();
      loadedInvalidationVersionRef.current = currentInvalidationVersion;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingInitial(false);
        inFlightRef.current = false;
      }
    }
  }, [ownerKey, pageSize]);

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
