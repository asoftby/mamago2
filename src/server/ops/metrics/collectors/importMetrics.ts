/**
 * queue.import.review_size / import.failed_sources — every 5 min
 * (§21 Step 5, Phase H).
 *
 * This is the CURRENT Import module (ImportSource/ImportRun/
 * ImportedRecord) — not Project Phoenix's migration tables, which happen
 * to share import/migration vocabulary but are a different system.
 *
 * queue.import.review_size: real review-queue semantics from
 * ImportedRecord.reviewStatus — 'PENDING' is exactly the status the
 * existing admin review page (src/app/admin/import/review/page.tsx) uses
 * for its own "pending" tile. No invented status.
 *
 * import.failed_sources: the exact same current-state semantics as Step
 * 4's import_source_failed detector, via the shared
 * getLatestImportSourceOutcomes() query — identical by construction, not
 * "failed runs in last 24h".
 */
import { getLatestImportSourceOutcomes } from "../../importSourceOutcomes";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectImportMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const [reviewSize, outcomes] = await Promise.all([
    ctx.prisma.importedRecord.count({ where: { reviewStatus: "PENDING" } }),
    getLatestImportSourceOutcomes(ctx.prisma),
  ]);

  const failedSources = outcomes.filter((outcome) => outcome.status === "FAILED").length;

  return [
    { metric: "queue.import.review_size", value: reviewSize },
    { metric: "import.failed_sources", value: failedSources },
  ];
}

export const importMetricsCollector: MetricCollector = {
  name: "import_metrics",
  intervalSec: 300,
  timeoutMs: 10_000,
  collect: collectImportMetrics,
};
