/**
 * Global fetch wrapper that automatically includes credentials for httpOnly cookies
 * This ensures all API requests send the session cookie
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include", // Always include cookies
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

/**
 * Convenience method for GET requests
 */
export function apiGet(url: string, options?: RequestInit) {
  return apiFetch(url, { ...options, method: "GET" });
}

/**
 * Convenience method for POST requests
 */
export function apiPost(url: string, body?: unknown, options?: RequestInit) {
  return apiFetch(url, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for PATCH requests
 */
export function apiPatch(url: string, body?: unknown, options?: RequestInit) {
  return apiFetch(url, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Convenience method for DELETE requests
 */
export function apiDelete(url: string, options?: RequestInit) {
  return apiFetch(url, { ...options, method: "DELETE" });
}
