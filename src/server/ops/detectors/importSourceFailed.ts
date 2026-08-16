/**
 * Detector #5: import_source_failed (§21 Step 4, Phase D).
 *
 * Intentionally has NO NodeRegistry node in v1 (Import stays off the top
 * strip; `import_source_silent` — which would need it — doesn't exist
 * yet). Its OPEN signals still appear in the shared operational signal
 * list, and detector_stale monitors it automatically because that
 * iterates DetectorRegistry, not NodeRegistry.
 *
 * One active ImportSource = one fingerprint = one incident. Only the
 * latest COMPLETED/FAILED outcome (PENDING/RUNNING/CANCELLED never erase
 * a previous FAILED result) determines current state — a single
 * DISTINCT ON query avoids N+1 across sources, using the existing
 * (sourceId, status) index.
 */
import type { PrismaClient } from "@prisma/client";

import type { Detector, DetectorContext, DetectorResult, SignalDraft } from "../types";

export function importSourceFailedFingerprint(sourceId: string): string {
  return `import.source_failed:${sourceId}`;
}

interface LatestOutcomeRow {
  sourceId: string;
  sourceName: string;
  status: "COMPLETED" | "FAILED";
  finishedAt: Date;
  errorMessage: string | null;
}

export interface ImportSourceFailedProbe {
  outcomes: LatestOutcomeRow[];
}

export async function probeImportSourceFailed(ctx: DetectorContext): Promise<ImportSourceFailedProbe> {
  const outcomes = await ctx.prisma.$queryRaw<LatestOutcomeRow[]>`
    SELECT DISTINCT ON (ir."sourceId")
      ir."sourceId"      AS "sourceId",
      s.name             AS "sourceName",
      ir.status          AS "status",
      COALESCE(ir."finishedAt", ir."createdAt") AS "finishedAt",
      ir."errorMessage"  AS "errorMessage"
    FROM "ImportRun" ir
    JOIN "ImportSource" s ON s.id = ir."sourceId"
    WHERE s."isActive" = true
      AND ir.status IN ('COMPLETED', 'FAILED')
      AND ir."isArchived" = false
    ORDER BY ir."sourceId", COALESCE(ir."finishedAt", ir."createdAt") DESC
  `;
  return { outcomes };
}

export function evaluateImportSourceFailed(probe: ImportSourceFailedProbe): DetectorResult {
  const signals: SignalDraft[] = [];

  for (const outcome of probe.outcomes) {
    if (outcome.status !== "FAILED") continue;

    signals.push({
      fingerprint: importSourceFailedFingerprint(outcome.sourceId),
      type: "IMPORT_SOURCE_FAILED",
      severity: "WARNING",
      title: `Import source "${outcome.sourceName}" is failing`,
      summary: outcome.errorMessage
        ? `Latest run (${outcome.finishedAt.toISOString()}) failed: ${outcome.errorMessage}`
        : `Latest run (${outcome.finishedAt.toISOString()}) failed`,
      entityType: "import_source",
      entityId: outcome.sourceId,
      detailsUrl: `/admin/import/sources/${outcome.sourceId}`,
    });
  }

  return { samples: [], signals };
}

export const importSourceFailedDetector: Detector<ImportSourceFailedProbe> = {
  name: "import_source_failed",
  intervalSec: 300,
  timeoutMs: 10_000,
  nodes: [],
  probe: probeImportSourceFailed,
  evaluate: evaluateImportSourceFailed,
};

// Re-exported for tests that need to construct a probe purely (no DB).
export type { LatestOutcomeRow as ImportSourceLatestOutcomeRow };
export type ImportSourcePrisma = PrismaClient;
