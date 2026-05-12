import { randomId } from "@/lib/utils/randomId";

const STORAGE_KEY = "anonymousId";

/**
 * Стабильный anonymousId в localStorage (не IP).
 * Fallback — sessionStorage; если недоступно — пустая строка (сервер: IP + User-Agent).
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === "undefined") return "";
  const create = () => randomId();

  try {
    let id = localStorage.getItem(STORAGE_KEY)?.trim();
    if (!id) {
      id = sessionStorage.getItem(STORAGE_KEY)?.trim();
    }
    if (!id) {
      id = create();
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        sessionStorage.setItem(STORAGE_KEY, id);
      }
    }
    return id;
  } catch {
    try {
      let id = sessionStorage.getItem(STORAGE_KEY)?.trim();
      if (!id) {
        id = create();
        sessionStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      return "";
    }
  }
}
