"use client";

const INTERNAL_HISTORY_DEPTH_KEY = "__mamagoInternalHistoryDepth";

type HistoryStateRecord = Record<string, unknown>;

function asRecord(state: unknown): HistoryStateRecord {
  return state && typeof state === "object" ? { ...(state as HistoryStateRecord) } : {};
}

function readDepthFromState(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as HistoryStateRecord)[INTERNAL_HISTORY_DEPTH_KEY];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function withDepth(state: unknown, depth: number): HistoryStateRecord {
  return {
    ...asRecord(state),
    [INTERNAL_HISTORY_DEPTH_KEY]: Math.max(0, Math.trunc(depth)),
  };
}

/**
 * Marks browser history entries created inside the current mamaGo document.
 *
 * Why this exists: document.referrer is fixed for the lifetime of the document
 * and does not change on Next.js client navigations. Without an explicit marker,
 * a detail page opened from an internal Link may look like a direct visit and
 * Smart Back incorrectly falls back to the city home page.
 */
export function installInternalHistoryTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  const history = window.history;
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  // The current document entry is depth 0 unless it was already marked.
  const initialDepth = readDepthFromState(history.state) ?? 0;
  originalReplaceState(withDepth(history.state, initialDepth), document.title);

  const trackedPushState: History["pushState"] = function (
    state: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    const currentDepth = readDepthFromState(history.state) ?? 0;
    return originalPushState(withDepth(state, currentDepth + 1), unused, url);
  };

  const trackedReplaceState: History["replaceState"] = function (
    state: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    const currentDepth = readDepthFromState(history.state) ?? 0;
    return originalReplaceState(withDepth(state, currentDepth), unused, url);
  };

  history.pushState = trackedPushState;
  history.replaceState = trackedReplaceState;

  return () => {
    // Do not clobber a wrapper installed after ours.
    if (history.pushState === trackedPushState) {
      history.pushState = originalPushState;
    }
    if (history.replaceState === trackedReplaceState) {
      history.replaceState = originalReplaceState;
    }
  };
}

export function hasInternalHistoryBackEntry(): boolean {
  if (typeof window === "undefined") return false;
  return (readDepthFromState(window.history.state) ?? 0) > 0;
}
