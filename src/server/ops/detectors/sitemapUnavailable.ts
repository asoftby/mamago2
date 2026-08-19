/**
 * Detector #4: sitemap_unavailable (§21 Step 4, Phase C).
 *
 * WARNING and CRITICAL share the SAME fingerprint (severity never lives in
 * the fingerprint) — this is the mandatory live exercise of Step 3's
 * severity-mutation lifecycle, handled entirely by the shared
 * reconciliation engine (reconciliation.ts), never reimplemented here.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";

import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { Detector, DetectorContext, DetectorResult, SignalDraft } from "../types";

export const SITEMAP_FINGERPRINT = "seo.sitemap_unavailable:prod";
export const SITEMAP_TIMEOUT_MS = 15_000;

export type SitemapProbeOutcome =
  | { kind: "network_error"; message: string }
  | { kind: "timeout" }
  | { kind: "http_5xx"; httpStatus: number }
  | { kind: "http_other"; httpStatus: number }
  | { kind: "parsed"; httpStatus: number; body: string };

export async function probeSitemapUnavailable(ctx: DetectorContext): Promise<SitemapProbeOutcome> {
  const url = `${getCanonicalPublicAppUrl()}/sitemap.xml`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await ctx.fetch(url, { signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) return { kind: "timeout" };
      return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
    }

    if (res.status >= 500) return { kind: "http_5xx", httpStatus: res.status };
    if (!res.ok) return { kind: "http_other", httpStatus: res.status };

    const body = await res.text();
    return { kind: "parsed", httpStatus: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the entry count for a valid sitemap (`urlset` or
 * `sitemapindex`), or null when the XML itself is invalid. Uses a real
 * parser (fast-xml-parser) with explicit validation — never a regex-based
 * "looks like XML" heuristic.
 */
export function parseSitemapEntryCount(xml: string): number | null {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) return null;

  const parser = new XMLParser({ ignoreAttributes: false });
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;

  const urlset = root.urlset as Record<string, unknown> | undefined;
  if (urlset) {
    const urls = urlset.url;
    if (urls === undefined) return 0;
    return Array.isArray(urls) ? urls.length : 1;
  }

  const sitemapindex = root.sitemapindex as Record<string, unknown> | undefined;
  if (sitemapindex) {
    const sitemaps = sitemapindex.sitemap;
    if (sitemaps === undefined) return 0;
    return Array.isArray(sitemaps) ? sitemaps.length : 1;
  }

  return 0;
}

function signal(severity: "CRITICAL" | "WARNING", summary: string): SignalDraft {
  return {
    fingerprint: SITEMAP_FINGERPRINT,
    type: "SITEMAP_UNAVAILABLE",
    severity,
    title: "Public sitemap is unavailable or invalid",
    summary,
  };
}

export function evaluateSitemapUnavailable(probe: SitemapProbeOutcome): DetectorResult {
  switch (probe.kind) {
    case "network_error":
      return { samples: [], signals: [signal("CRITICAL", `network error: ${probe.message}`)] };
    case "timeout":
      return {
        samples: [],
        signals: [signal("CRITICAL", `request timed out after ${SITEMAP_TIMEOUT_MS}ms`)],
      };
    case "http_5xx":
      return { samples: [], signals: [signal("CRITICAL", `HTTP ${probe.httpStatus}`)] };
    case "http_other":
      return { samples: [], signals: [signal("WARNING", `unexpected HTTP status ${probe.httpStatus}`)] };
    case "parsed": {
      const count = parseSitemapEntryCount(probe.body);
      if (count === null) return { samples: [], signals: [signal("WARNING", "response is not valid XML")] };
      if (count === 0) return { samples: [], signals: [signal("WARNING", "sitemap contains zero entries")] };
      return { samples: [], signals: [] };
    }
  }
}

export const sitemapUnavailableDetector: Detector<SitemapProbeOutcome> = {
  name: "sitemap_unavailable",
  intervalSec: 300,
  timeoutMs: SITEMAP_TIMEOUT_MS,
  nodes: ["Indexability"],
  probe: probeSitemapUnavailable,
  evaluate: evaluateSitemapUnavailable,
};
