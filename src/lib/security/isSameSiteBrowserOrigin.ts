/**
 * Check a browser Origin against the public request host rather than Next's
 * internal request URL (which can point at localhost or a reverse proxy).
 * A matching host alone is insufficient: the browser's protocol must match.
 */
export function isSameSiteBrowserOrigin(input: {
  origin: string | null;
  host: string | null;
  protocol: string;
}): boolean {
  if (!input.origin) return true; // Same-site clients may omit Origin.
  if (!input.host || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(input.host)) return false;
  const expectedProtocol = input.protocol.replace(/:$/, "").toLowerCase();
  if (expectedProtocol !== "https" && expectedProtocol !== "http") return false;
  try {
    const candidate = new URL(input.origin);
    return candidate.origin === input.origin && candidate.protocol === expectedProtocol + ":" && candidate.host.toLowerCase() === input.host.toLowerCase();
  } catch { return false; }
}
