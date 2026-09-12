export const URL_CLASS_RULES_VERSION = 1;

export type UrlClass = "evergreen" | "event" | "unclear";

export interface UrlClassResult {
  class: UrlClass;
  basis: string;
}

/**
 * URL classification rules for the SEO recovery gate.
 *
 * Rules are deterministic and evaluated in this exact order; the first match wins:
 * 1. Invalid/unparseable input -> unclear.
 * 2. Calendar-bound slug (explicit year or holiday/calendar keyword) -> event.
 *    This intentionally runs before namespace rules so, for example,
 *    /minsk/blog/novyj-god-2027-... is classified as event, not evergreen.
 * 3. Event namespaces (/events, /events/*, /minsk/events, /minsk/events/*) -> event.
 * 4. Place namespaces (/places/*, /minsk/places/*) -> evergreen.
 * 5. Route namespaces (/routes/*, /minsk/routes/*) -> evergreen.
 * 6. Homepage (/) -> evergreen.
 * 7. Undated /breakingnews/* -> unclear.
 * 8. Blog namespaces (/blog/*, /minsk/blog/*) -> evergreen.
 * 9. Everything else that is not calendar-bound or event-namespaced -> evergreen.
 *
 * The classifier separates dated/calendar event traffic from undated traffic. It does
 * not attempt to remove ordinary seasonality from evergreen pages: beaches, pools,
 * parks and other undated seasonal-interest pages remain evergreen by design.
 */

const CALENDAR_KEYWORDS = [
  "novyj-god",
  "novyy-god",
  "novogod",
  "rozhdestv",
  "maslen",
  "kupala",
  "kupale",
  "kupalle",
  "hellouin",
  "halloween",
  "14-go-fevral",
  "den-valentina",
  "den-materi",
  "den-zashhity-detej",
  "1-iyunya",
  "1-sent",
  "den-nezavisimosti",
  "3-iyulya",
  "9-maya",
  "pasha-",
  "kanikuly",
] as const;

function normalizePath(url: string): string | null {
  if (typeof url !== "string" || url.trim().length === 0) return null;

  try {
    const parsed = new URL(url, "https://mamago.by");
    let path = parsed.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      // Keep the raw path when percent-decoding is malformed; classification can
      // still be deterministic from the remaining ASCII path structure.
    }
    const normalized = path.toLowerCase().replace(/\/{2,}/g, "/");
    return normalized.length > 1 && normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;
  } catch {
    return null;
  }
}

function isNamespace(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

function calendarBasis(path: string): string | null {
  const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
  if (/(?:^|[-_])20\d{2}(?:$|[-_])/.test(lastSegment)) {
    return "calendar: explicit year in slug";
  }

  const keyword = CALENDAR_KEYWORDS.find((candidate) => lastSegment.includes(candidate));
  return keyword ? `calendar: holiday keyword (${keyword})` : null;
}

export function classifyUrl(url: string): UrlClassResult {
  const path = normalizePath(url);
  if (path === null) return { class: "unclear", basis: "invalid or unparseable URL" };

  const calendar = calendarBasis(path);
  if (calendar) return { class: "event", basis: calendar };

  if (isNamespace(path, "/events") || isNamespace(path, "/minsk/events")) {
    return { class: "event", basis: "namespace: event" };
  }

  if (isNamespace(path, "/places") || isNamespace(path, "/minsk/places")) {
    return { class: "evergreen", basis: "namespace: place" };
  }

  if (isNamespace(path, "/routes") || isNamespace(path, "/minsk/routes")) {
    return { class: "evergreen", basis: "namespace: route" };
  }

  if (path === "/") return { class: "evergreen", basis: "namespace: homepage" };

  if (isNamespace(path, "/breakingnews") || isNamespace(path, "/minsk/breakingnews")) {
    return { class: "unclear", basis: "namespace: undated breakingnews" };
  }

  if (isNamespace(path, "/blog") || isNamespace(path, "/minsk/blog")) {
    return { class: "evergreen", basis: "namespace: blog" };
  }

  return { class: "evergreen", basis: "default: undated non-event URL" };
}
