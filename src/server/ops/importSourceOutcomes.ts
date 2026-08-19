/**
 * Shared "latest outcome-bearing ImportRun per active ImportSource" query
 * (§21 Step 4 Phase D / Step 5 Phase H). Extracted so Step 4's
 * import_source_failed detector and Step 5's import metrics collector use
 * the EXACT same current-state semantics by construction, not by
 * convention: only the latest COMPLETED/FAILED outcome per active source
 * matters — PENDING/RUNNING/CANCELLED never erase a previous FAILED
 * result. A single DISTINCT ON query avoids N+1 across sources.
 */
import type { PrismaClient } from "@prisma/client";

export interface LatestImportSourceOutcome {
  sourceId: string;
  sourceName: string;
  status: "COMPLETED" | "FAILED";
  finishedAt: Date;
  errorMessage: string | null;
}

export async function getLatestImportSourceOutcomes(
  prisma: PrismaClient,
): Promise<LatestImportSourceOutcome[]> {
  return prisma.$queryRaw<LatestImportSourceOutcome[]>`
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
}
