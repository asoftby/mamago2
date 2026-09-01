import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { buildPublicationGeoPlan } from "./migratedArticlePublicationGeoRepair";
import {
  createPhase2APlanArtifact,
  recoveriesFromReviewedArtifact,
  requireReviewedPlanForApply,
  validatePhase2APlanArtifact,
} from "./phase2aPlanArtifact";
import type { Phase2ARecoveryEntry } from "./phase2aPriorityRecovery";

const entry: Phase2ARecoveryEntry = {
  position: 14,
  legacySourcePath: "/birthday",
  currentDestination: "/blog/birthday",
  currentSlug: "birthday",
  targetArticleId: "article-reviewed-id",
  entityType: "article",
  gscClicks: 1,
  action: "RESTORE_EXISTING_CONTENT",
  readiness: "READY_AUTOMATED",
  geoScope: "COUNTRY",
  citySlug: null,
  confidence: "HIGH",
  evidence: "audited global",
};

const observed = {
  id: "article-reviewed-id", slug: "birthday", title: "Raw title",
  updatedAt: new Date("2026-09-01T00:00:00.000Z"), publishedAt: new Date("2024-01-01T00:00:00.000Z"),
  noindex: false, seoRobots: null, contentJson: { blocks: [{}, {}] },
  status: "PENDING", geoScope: null, cityId: null, regionId: null,
};

function prismaReturning(article: typeof observed | null): PrismaClient {
  return { article: { findUnique: async () => article } } as unknown as PrismaClient;
}

async function main() {
const artifact = await createPhase2APlanArtifact(
  prismaReturning(observed), [entry], "minsk-id", "2026-09-01T01:00:00.000Z",
);
assert.equal(artifact.rows.length, 1, "PLAN accounts for every expected candidate");
assert.equal(artifact.rows[0]?.articleId, "article-reviewed-id", "PLAN resolves exact audited ID");
assert.equal(artifact.rows[0]?.canonicalPath, "/blog/birthday");
assert.equal(artifact.rows[0]?.action, "apply");
assert.deepEqual(validatePhase2APlanArtifact(artifact), artifact);
assert.throws(() => requireReviewedPlanForApply(true, null), /plan-artifact/);
assert.doesNotThrow(() => requireReviewedPlanForApply(true, "/reviewed/plan.json"));

assert.throws(() => validatePhase2APlanArtifact({ ...artifact, sha256: "0".repeat(64) }), /checksum/);
assert.throws(() => validatePhase2APlanArtifact({ ...artifact, rows: [] }), /incomplete/);

const wrongSlugArtifact = await createPhase2APlanArtifact(
  prismaReturning({ ...observed, slug: "wrong" }), [entry], "minsk-id",
);
assert.equal(wrongSlugArtifact.rows[0]?.action, "conflict", "incorrect ID/slug pairing fails closed");

const missingArtifact = await createPhase2APlanArtifact(prismaReturning(null), [entry], "minsk-id");
assert.equal(missingArtifact.rows[0]?.action, "not_found", "missing expected ID is represented");
assert.equal(missingArtifact.rows.length, missingArtifact.expectedAutomated);

const reviewedRecoveries = recoveriesFromReviewedArtifact(artifact);
const driftedPlan = await buildPublicationGeoPlan(
  prismaReturning({ ...observed, title: "Edited after PLAN" }), reviewedRecoveries, "minsk-id",
);
assert.equal(driftedPlan[0]?.action, "conflict", "APPLY-time read cannot refresh reviewed fingerprint");

console.log("phase2aPlanArtifact.test.ts: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
