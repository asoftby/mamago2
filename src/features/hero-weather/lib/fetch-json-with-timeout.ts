export type FetchJsonWithTimeoutOptions = {
  timeoutMs?: number;
  init?: RequestInit;
};

/**
 * Server-safe JSON fetch with AbortController timeout.
 * Returns `null` on network error, non-JSON, timeout, or non-ok response.
 */
export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  options?: FetchJsonWithTimeoutOptions,
): Promise<T | null> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options?.init,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
