import type { SearchResultType } from "@/lib/search/types";

const STORAGE_KEY = "mmg.publicSearch.lastQuery";
const MIN_LEN = 2;
const MAX_LEN = 200;
export const LAST_PUBLIC_SEARCH_UPDATED_EVENT = "mmg-last-search-updated";

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Считать сохранённый запрос (только в браузере). */
export function readLastPublicSearchQuery(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = normalizeQuery(localStorage.getItem(STORAGE_KEY) ?? "");
    if (v.length < MIN_LEN || v.length > MAX_LEN) return null;
    return v;
  } catch {
    return null;
  }
}

/** Запомнить запрос после перехода из выдачи поиска. */
export function rememberPublicSearchQuery(raw: string): void {
  if (typeof window === "undefined") return;
  const q = normalizeQuery(raw);
  if (q.length < MIN_LEN || q.length > MAX_LEN) return;
  try {
    const prev = readLastPublicSearchQuery();
    if (prev === q) {
      window.dispatchEvent(new Event(LAST_PUBLIC_SEARCH_UPDATED_EVENT));
      return;
    }
    localStorage.setItem(STORAGE_KEY, q);
    window.dispatchEvent(new Event(LAST_PUBLIC_SEARCH_UPDATED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

const LAST_RESULT_STORAGE_KEY = "mmg.publicSearch.lastOpenedResult";
const LAST_RESULT_TITLE_MAX_LEN = 240;
const LAST_RESULT_URL_MAX_LEN = 1200;
export const LAST_PUBLIC_SEARCH_RESULT_UPDATED_EVENT = "mmg-last-search-result-updated";

export type LastPublicSearchResult = {
  type: SearchResultType;
  title: string;
  url: string;
  /** Original query that led to opening this page, for context only. */
  query: string;
};

const VALID_RESULT_TYPES: ReadonlySet<string> = new Set([
  "activity", "offer", "place", "route", "article",
]);

function isSafeLocalSearchResultPath(url: string): boolean {
  return (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(url) &&
    url.length <= LAST_RESULT_URL_MAX_LEN
  );
}

/** Pure reader: old/malformed localStorage entries never crash public search. */
export function parseLastPublicSearchResult(raw: string | null): LastPublicSearchResult | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.type !== "string" || !VALID_RESULT_TYPES.has(item.type) ||
      typeof item.title !== "string" ||
      typeof item.url !== "string" ||
      typeof item.query !== "string"
    ) return null;
    const title = item.title.trim();
    const query = normalizeQuery(item.query);
    if (
      !title || title.length > LAST_RESULT_TITLE_MAX_LEN ||
      !isSafeLocalSearchResultPath(item.url) ||
      query.length < MIN_LEN || query.length > MAX_LEN
    ) return null;
    return { type: item.type as SearchResultType, title, url: item.url, query };
  } catch {
    return null;
  }
}

/** Stable serialized snapshot for useSyncExternalStore (no new objects on reads). */
export function readLastPublicSearchResultSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_RESULT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readLastPublicSearchResult(): LastPublicSearchResult | null {
  return parseLastPublicSearchResult(readLastPublicSearchResultSnapshot());
}

/** Store only the page actually opened from search; browsing/search typing doesn't change history. */
export function rememberLastOpenedPublicSearchResult(
  result: Pick<LastPublicSearchResult, "type" | "title" | "url">,
  rawQuery: string,
): void {
  if (typeof window === "undefined") return;
  const query = normalizeQuery(rawQuery);
  const payload = { ...result, title: result.title.trim(), query };
  if (
    !VALID_RESULT_TYPES.has(payload.type) ||
    !payload.title || payload.title.length > LAST_RESULT_TITLE_MAX_LEN ||
    !isSafeLocalSearchResultPath(payload.url) ||
    query.length < MIN_LEN || query.length > MAX_LEN
  ) return;

  // Preserve the old one-query preference as a backward-compatible fallback.
  rememberPublicSearchQuery(query);
  try {
    const serialized = JSON.stringify(payload);
    if (readLastPublicSearchResultSnapshot() !== serialized) {
      window.localStorage.setItem(LAST_RESULT_STORAGE_KEY, serialized);
    }
    window.dispatchEvent(new Event(LAST_PUBLIC_SEARCH_RESULT_UPDATED_EVENT));
  } catch {
    /* storage unavailable (private mode, quota, etc.) */
  }
}
