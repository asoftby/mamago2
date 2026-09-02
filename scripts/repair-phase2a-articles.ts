/**
 * P0 SEO Phase 2A article recovery.
 * PLAN: npx tsx scripts/repair-phase2a-articles.ts
 * APPLY: npx tsx scripts/repair-phase2a-articles.ts --apply --plan-artifact <reviewed.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COUNTRY_ISO } from "../src/server/geo/geoConstants";
import { prismaBase, searchIndexer } from "../src/lib/prisma";
import { MINSK_CITY_SLUG } from "../src/lib/seo/migratedArticlePublicationGeoRecovery";
import { applyPublicationGeoPlan, buildPublicationGeoPlan, resolveMinskCity, summarizePublicationGeoPlan } from "../src/lib/seo/migratedArticlePublicationGeoRepair";
import { assertArtifactMatchesConfiguration, createPhase2APlanArtifact, recoveriesFromReviewedArtifact, requireReviewedPlanForApply, validatePhase2APlanArtifact } from "../src/lib/seo/phase2aPlanArtifact";
import { PHASE_2A_PRIORITY_RECOVERIES, summarizePhase2A, validatePhase2AIntegrity } from "../src/lib/seo/phase2aPriorityRecovery";

const apply = process.argv.includes("--apply");

function artifactArgument(): string | null {
  const equals = process.argv.find((arg) => arg.startsWith("--plan-artifact="));
  if (equals) return equals.slice("--plan-artifact=".length);
  const index = process.argv.indexOf("--plan-artifact");
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main() {
  const errors = validatePhase2AIntegrity();
  if (errors.length) throw new Error(`Phase 2A integrity errors: ${errors.join("; ")}`);
  const artifactArg = artifactArgument();
  requireReviewedPlanForApply(apply, artifactArg);

  console.log("=== PHASE 2A PRIORITY DATA SUMMARY ===");
  console.log(JSON.stringify(summarizePhase2A(), null, 2));
  const blocked = PHASE_2A_PRIORITY_RECOVERIES.filter((entry) => entry.readiness === "BLOCKED_OWNER_REVIEW");
  console.log(`\n=== OWNER-REVIEW BLOCKED (${blocked.length} rows) ===`);
  for (const entry of blocked) console.log(`${entry.position}. ${entry.legacySourcePath} [${entry.ownerReviewBatch}]`);

  const ready = PHASE_2A_PRIORITY_RECOVERIES.filter((entry) =>
    entry.entityType === "article" && entry.action === "RESTORE_EXISTING_CONTENT" &&
    entry.readiness === "READY_AUTOMATED" && entry.geoScope !== null,
  );
  if (!ready.every((entry) => entry.targetArticleId)) throw new Error("READY_AUTOMATED row lacks audited targetArticleId");
  const minsk = await resolveMinskCity(prismaBase);
  if (!minsk) throw new Error(`City not found: ${MINSK_CITY_SLUG}/${DEFAULT_COUNTRY_ISO}`);

  let artifact;
  let artifactPath: string;
  if (apply) {
    artifactPath = resolve(artifactArg!);
    artifact = validatePhase2APlanArtifact(JSON.parse(readFileSync(artifactPath, "utf8")));
    if (artifact.minskCityId !== minsk.id) throw new Error("APPLY refused: PLAN city ID drift");
    assertArtifactMatchesConfiguration(artifact, ready, minsk.id);
  } else {
    artifact = await createPhase2APlanArtifact(prismaBase, ready, minsk.id);
    const directory = resolve("scripts/tmp/prod-verify");
    mkdirSync(directory, { recursive: true });
    artifactPath = resolve(directory, `phase2a-plan-${artifact.generatedAt.replace(/[:.]/g, "-")}.json`);
    writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
  }

  console.log(`\nPLAN_ARTIFACT_PATH=${artifactPath}`);
  console.log(`PLAN_ARTIFACT_SHA256=${artifact.sha256}`);
  const plan = await buildPublicationGeoPlan(prismaBase, recoveriesFromReviewedArtifact(artifact), minsk.id);
  for (const row of plan) console.log(JSON.stringify(row));
  const summary = summarizePublicationGeoPlan(plan, apply ? "apply" : "plan");
  console.log("\n=== PLAN SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  if (summary.conflict || summary.not_found) throw new Error(`Batch refused: conflict=${summary.conflict} not_found=${summary.not_found}`);
  if (!apply) {
    console.log("\n=== READ-ONLY PLAN COMPLETE ===\nPROD_WRITES=0\nAPPLY_EXECUTED=NO");
    return;
  }
  const result = await applyPublicationGeoPlan(prismaBase, plan, searchIndexer);
  console.log(`[repair-phase2a-articles] Applied ${result.applied}; reindexed ${result.reindexed}.`);
}

main().catch((error) => {
  console.error("[repair-phase2a-articles]", error);
  process.exitCode = 1;
}).finally(async () => prismaBase.$disconnect());
