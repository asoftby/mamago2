import type { PrismaClient } from "@prisma/client";
import { deriveGscSeo } from "@/lib/admin/gscSeoViewModel";
import { gscPropertyKey, validProperty } from "@/server/ops/metrics/collectors/googleSearchConsole";

/** One complete collector batch for the configured property. Never mix collection instants. */
export async function getGscAnalytics(prisma: PrismaClient, env: Record<string, string | undefined> = process.env) {
  const property = env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() ?? "";
  if (env.GOOGLE_SEARCH_CONSOLE_ENABLED?.trim().toLowerCase() !== "true") return null;
  if (!validProperty(property)) return null;
  const marker = await prisma.metricSample.findFirst({
    where: { metric: "gsc.property", dimKey: gscPropertyKey(property) }, orderBy: { collectedAt: "desc" },
  });
  if (!marker) return { property, collectedAt: null, dataThrough: null, stale: true, metrics: null };
  const rows = await prisma.metricSample.findMany({
    where: { collectedAt: marker.collectedAt, metric: { startsWith: "gsc." } },
  });
  const kpis: Record<string, unknown> = Object.fromEntries(rows.filter((r) => !r.dimKey).map((r) => [r.metric, r.value]));
  kpis["gsc.page_movers"] = Object.fromEntries(["rising", "falling"].map((direction) => [direction,
    rows.filter((r) => r.metric.startsWith(`gsc.page.${direction === "rising" ? "rise" : "fall"}.`) && r.dimKey)
      .map((r) => ({ page: r.dimKey, deltaClicks: r.value })),
  ]));
  return { property, collectedAt: marker.collectedAt.toISOString(),
    dataThrough: rows.find((r) => r.metric === "gsc.data_through")?.dimKey ?? null,
    stale: Date.now() - marker.collectedAt.getTime() > 12 * 3600_000, metrics: deriveGscSeo(kpis) };
}
