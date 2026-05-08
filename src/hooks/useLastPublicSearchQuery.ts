"use client";

import { useSyncExternalStore } from "react";
import {
  LAST_PUBLIC_SEARCH_UPDATED_EVENT,
  readLastPublicSearchQuery,
} from "@/lib/search/recentPublicSearch";

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("storage", handler);
  window.addEventListener(LAST_PUBLIC_SEARCH_UPDATED_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LAST_PUBLIC_SEARCH_UPDATED_EVENT, handler);
  };
}

function snapshot(): string | null {
  return readLastPublicSearchQuery();
}

function serverSnapshot(): string | null {
  return null;
}

/** Последний публичный поискозапрос из localStorage (один пользователь → один браузер). */
export function useLastPublicSearchQuery(): string | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
