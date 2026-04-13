/**
 * Generates a random UUID-like string.
 * Uses crypto.randomUUID() when available (HTTPS / localhost),
 * falls back to a timestamp + Math.random() string for HTTP contexts.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
