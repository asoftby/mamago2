/** Remove simple HTML tags (TipTap / legacy markup); keep plain text only. */
export function stripHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Join unique non-empty text fragments into one searchable blob.
 * No HTML/JSON — callers must pass already decoded strings.
 */
export function buildSearchText(parts: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    if (raw == null) continue;
    const t = stripHtml(String(raw)).trim();
    if (!t) continue;
    const k = normKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.join("\n").trim();
}

const SUMMARY_MAX_LEN = 180;

/** Plain-text snippet for search result cards; null if nothing usable. */
export function summarizeForSearchCard(
  text: string | null | undefined,
  maxLen = SUMMARY_MAX_LEN,
): string | null {
  if (text == null) return null;
  const t = stripHtml(String(text)).replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen).trimEnd();
  const cut = slice.lastIndexOf(" ");
  const base = cut > maxLen * 0.55 ? slice.slice(0, cut) : slice;
  return `${base}…`;
}
