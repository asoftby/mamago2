import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { createOffersLoadCandidate } from "../src/lib/migration/release/adapters/offersProductionWiring";
import { FrozenOfferSourceRepository } from "../src/lib/migration/release/adapters/frozenOfferSourceRepository";

const ARTIFACT_SHA256 = "398e86f0a989e226330b70e838ddaf901276681cd7ae7976a24546eb2b177b16";

async function main(): Promise<void> {
  const artifactRoot = process.env.PHOENIX_RELEASE_ARTIFACT_ROOT;
  if (!artifactRoot) throw new Error("PHOENIX_RELEASE_ARTIFACT_ROOT is required");

  const scope = JSON.parse(readFileSync("docs/migration/manifests/phoenix-offers-dev-release-scope-2026-07-31.json", "utf8")) as { records: Array<{ sourceRecordKey: string }> };
  if (scope.records.length !== 63) throw new Error(`Expected 63 scope records, found ${scope.records.length}`);

  // Read-only against the real LOCAL database: Users/Businesses/Places
  // phases are already genuinely complete there (not the DEV target), so
  // Place dependency resolution reflects real prerequisite-phase output —
  // no writes happen at any point in this script.
  const prisma = new PrismaClient();
  const rawSource = FrozenOfferSourceRepository.fromEnvironment(ARTIFACT_SHA256);
  const source = await prisma.migrationSource.findFirst({ where: { adapterKey: "wordpress-db" }, orderBy: { createdAt: "asc" } });
  if (!source) throw new Error("No wordpress-db MigrationSource found in LOCAL — cannot resolve real Place dependencies read-only.");
  const loadCandidate = createOffersLoadCandidate(rawSource, prisma, source.id);

  const results: Array<{ sourceRecordKey: string; ok: boolean; domainHashV2?: string; error?: string }> = [];
  for (const { sourceRecordKey } of scope.records) {
    try {
      const candidate = await loadCandidate(sourceRecordKey);
      if (candidate.sourceRecordKey !== sourceRecordKey) throw new Error("SOURCE_KEY_MISMATCH");
      results.push({ sourceRecordKey, ok: true, domainHashV2: candidate.domainHashV2 });
    } catch (error) {
      results.push({ sourceRecordKey, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await prisma.$disconnect();

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const uniqueHashes = new Set(succeeded.map((r) => r.domainHashV2));
  console.log(JSON.stringify({
    total: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    failedDetails: failed,
    uniqueDomainHashCount: uniqueHashes.size,
  }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

void main();
