/**
 * Generates a random UUID-like string.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  
  // Fallback for non-secure contexts or older environments
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).substring(2, 10) +
    "-" +
    Math.random().toString(36).substring(2, 10)
  );
}
