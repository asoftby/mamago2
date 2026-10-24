"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  LAST_PUBLIC_SEARCH_RESULT_UPDATED_EVENT,
  parseLastPublicSearchResult,
  readLastPublicSearchResultSnapshot,
} from "@/lib/search/recentPublicSearch";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(LAST_PUBLIC_SEARCH_RESULT_UPDATED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LAST_PUBLIC_SEARCH_RESULT_UPDATED_EVENT, onChange);
  };
}

/** A single latest clicked result, shared between mobile and desktop search in this browser. */
export function useLastPublicSearchResult() {
  const raw = useSyncExternalStore(subscribe, readLastPublicSearchResultSnapshot, () => null);
  return useMemo(() => parseLastPublicSearchResult(raw), [raw]);
}
