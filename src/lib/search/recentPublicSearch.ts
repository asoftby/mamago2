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
