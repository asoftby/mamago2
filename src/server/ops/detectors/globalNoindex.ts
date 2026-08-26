/**
 * Detector #3: global_noindex (§21 Step 4, Phase B).
 *
 * Proves INDEXABILITY, not generic uptime. If the probe cannot obtain
 * enough information (network failure, timeout, non-2xx response) to
 * evaluate indexability, the probe THROWS — the executor then records
 * FAILED/TIMEOUT and does not reconcile signals. Never turn "unknown" into
 * "no noindex problem", and never duplicate health_endpoint's job by
 * fabricating a noindex signal for a transport outage.
 */
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { Detector, DetectorContext, DetectorResult, SignalDraft } from "../types";

export const GLOBAL_NOINDEX_FINGERPRINT = "seo.global_noindex:prod";
export const GLOBAL_NOINDEX_TIMEOUT_MS = 15_000;
const PER_REQUEST_TIMEOUT_MS = 7_000;

export interface GlobalNoindexProbe {
  robotsTxt: string;
  homepageHtml: string;
  homepageXRobotsTag: string | null;
}

// ── robots.txt parser ───────────────────────────────────────────────────
// Real group-aware parsing: comments stripped, directive names
// case-insensitive, User-agent groups tracked. Only a `User-agent: *`
// group with an EXACT `Disallow: /` rule counts as a site-wide block —
// `Disallow: /private` or a block scoped to a specific non-wildcard bot
// must never false-positive.

interface RobotsGroup {
  userAgents: string[];
  disallow: string[];
}

function parseRobotsGroups(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastLineWasUserAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const field = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (field === "user-agent") {
      if (current && !lastLineWasUserAgent) current = null;
      if (!current) {
        current = { userAgents: [], disallow: [] };
        groups.push(current);
      }
      current.userAgents.push(value.toLowerCase());
      lastLineWasUserAgent = true;
    } else if (field === "disallow") {
      if (current) current.disallow.push(value);
      lastLineWasUserAgent = false;
    } else {
      lastLineWasUserAgent = false;
    }
  }

  return groups;
}

export function robotsHasSiteWideDisallow(text: string): boolean {
  return parseRobotsGroups(text).some(
    (group) => group.userAgents.includes("*") && group.disallow.some((rule) => rule.trim() === "/"),
  );
}

// ── X-Robots-Tag header parser ──────────────────────────────────────────

export function xRobotsTagHasNoindex(headerValue: string | null): boolean {
  if (!headerValue) return false;
  return headerValue
    .split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .includes("noindex");
}

// ── HTML <meta name="robots"> parser ────────────────────────────────────
// Scoped regex extraction over <meta> tags only — attribute order and
// case are irrelevant since each attribute is matched independently
// within the tag's own text, not by fixed position.

const META_TAG_RE = /<meta\b[^>]*>/gi;
const NAME_ATTR_RE = /\bname\s*=\s*["']([^"']*)["']/i;
const CONTENT_ATTR_RE = /\bcontent\s*=\s*["']([^"']*)["']/i;

export function htmlHasNoindexMeta(html: string): boolean {
  const metaTags = html.match(META_TAG_RE) ?? [];
  for (const tag of metaTags) {
    const nameMatch = tag.match(NAME_ATTR_RE);
    if (!nameMatch || nameMatch[1].trim().toLowerCase() !== "robots") continue;
    const contentMatch = tag.match(CONTENT_ATTR_RE);
    if (!contentMatch) continue;
    const directives = contentMatch[1].split(",").map((d) => d.trim().toLowerCase());
    if (directives.includes("noindex")) return true;
  }
  return false;
}

// ── probe / evaluate ────────────────────────────────────────────────────

/**
 * Wraps one `fetch` with a diagnostic error message identifying which
 * request failed and why (timeout vs. transport error, plus the
 * underlying `cause`) — never changes whether we throw, only what the
 * thrown message says. Without this, a bare `Promise.all([fetch, fetch])`
 * surfaces Node's generic `TypeError: fetch failed` with no indication of
 * which of the two concurrent requests failed or what the actual network
 * cause was (e.g. ECONNREFUSED/ENOTFOUND live on `err.cause`, not
 * `err.message`), making `DetectorRun.error` useless for on-call triage.
 */
async function fetchIndexabilitySource(
  ctx: DetectorContext,
  label: "robots.txt" | "homepage",
  url: string,
): Promise<Response> {
  try {
    return await ctx.fetch(url, { signal: AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS) });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(`${label} request timed out after ${PER_REQUEST_TIMEOUT_MS}ms (${url})`);
    }
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : "";
    throw new Error(`${label} network error (${url}): ${message}${cause}`);
  }
}

export async function probeGlobalNoindex(ctx: DetectorContext): Promise<GlobalNoindexProbe> {
  const base = getCanonicalPublicAppUrl();

  const [robotsRes, homeRes] = await Promise.all([
    fetchIndexabilitySource(ctx, "robots.txt", `${base}/robots.txt`),
    fetchIndexabilitySource(ctx, "homepage", `${base}/`),
  ]);

  // robots.txt missing (404) is normal/permissive web semantics — treat as
  // "no disallow rules", not a failure. Any other non-2xx means we cannot
  // trust its content.
  let robotsTxt = "";
  if (robotsRes.status !== 404) {
    if (!robotsRes.ok) {
      throw new Error(`robots.txt returned HTTP ${robotsRes.status}`);
    }
    robotsTxt = await robotsRes.text();
  }

  // The homepage itself must load successfully — we cannot reliably prove
  // indexability from an error page.
  if (!homeRes.ok) {
    throw new Error(`homepage returned HTTP ${homeRes.status}`);
  }
  const homepageHtml = await homeRes.text();
  const homepageXRobotsTag = homeRes.headers.get("x-robots-tag");

  return { robotsTxt, homepageHtml, homepageXRobotsTag };
}

export function evaluateGlobalNoindex(probe: GlobalNoindexProbe): DetectorResult {
  const reasons: string[] = [];

  if (robotsHasSiteWideDisallow(probe.robotsTxt)) {
    reasons.push("robots.txt disallows / for User-agent: *");
  }
  if (xRobotsTagHasNoindex(probe.homepageXRobotsTag)) {
    reasons.push(`homepage X-Robots-Tag contains noindex: "${probe.homepageXRobotsTag}"`);
  }
  if (htmlHasNoindexMeta(probe.homepageHtml)) {
    reasons.push("homepage HTML meta robots contains noindex");
  }

  if (reasons.length === 0) {
    return { samples: [], signals: [] };
  }

  const signal: SignalDraft = {
    fingerprint: GLOBAL_NOINDEX_FINGERPRINT,
    type: "GLOBAL_NOINDEX",
    severity: "CRITICAL",
    title: "Public site is blocking search indexing",
    summary: reasons.join("; "),
  };
  return { samples: [], signals: [signal] };
}

export const globalNoindexDetector: Detector<GlobalNoindexProbe> = {
  name: "global_noindex",
  intervalSec: 300,
  timeoutMs: GLOBAL_NOINDEX_TIMEOUT_MS,
  nodes: ["Indexability"],
  probe: probeGlobalNoindex,
  evaluate: evaluateGlobalNoindex,
};
