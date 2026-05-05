/**
 * Generates a random UUID-like string.
 */
export function randomId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") {
    return c.randomUUID();
  }
  const values = new Uint32Array(2);
  c.getRandomValues(values);
  return `${Date.now().toString(36)}-${Array.from(values).join("-")}`;
}
