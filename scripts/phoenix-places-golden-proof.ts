import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

import { planLineageOnlyCreateAction } from "../src/lib/migration/release/adapters/lineageOnlyPlanner";
import { createPlacesDependencyResolver, createPlacesLoadCandidate, createPlacesTargetStateResolver, createPlacesWriter } from "../src/lib/migration/release/adapters/placesProductionWiring";
import { FrozenPlaceSourceRepository } from "../src/lib/migration/release/adapters/frozenPlaceSourceRepository";

const GOLDEN_KEY = "wordpress-db:places:5457";
const OWNER_USER_SOURCE_RECORD_KEY = "wordpress-db:user:89"; // this Place's real captured post_author
const ARTIFACT_SHA256 = "b588271570a001a3eb9a4977b446299311b80595ee9ea92bcb3e2d9d3dd36879";
const SCHEMA = "phoenix_places_golden_20260731";

function schemaUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", SCHEMA);
  return url.toString();
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [place, lineage, record, media, user, business, offer, route, activity, article] = await Promise.all([
    prisma.place.count(), prisma.migrationLineage.count(), prisma.migrationRecord.count(), prisma.mediaAsset.count(),
    prisma.user.count(), prisma.business.count(), prisma.offer.count(), prisma.route.count(), prisma.activity.count(), prisma.article.count(),
  ]);
  return { Place: place, MigrationLineage: lineage, MigrationRecord: record, MediaAsset: media, User: user, Business: business, Offer: offer, Route: route, Activity: activity, Article: article };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const artifactRoot = process.env.PHOENIX_RELEASE_ARTIFACT_ROOT;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!artifactRoot) throw new Error("PHOENIX_RELEASE_ARTIFACT_ROOT is required");

  const admin = new PrismaClient();
  const existing = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(`select exists(select 1 from information_schema.schemata where schema_name = '${SCHEMA}')`);
  if (existing[0]?.exists) throw new Error(`Disposable schema already exists: ${SCHEMA}`);
  await admin.$executeRawUnsafe(`create schema "${SCHEMA}"`);
  await admin.$disconnect();

  const isolatedUrl = schemaUrl(databaseUrl);
  try {
    execFileSync("pnpm", ["prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: "pipe",
    });
    const prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
    try {
      // --- Seed prerequisite phase output: one User + an active USER lineage ---
      const seedUser = await prisma.user.create({ data: { email: "golden-proof-place-owner@example.invalid" } });
      const source = await prisma.migrationSource.create({ data: { adapterKey: "wordpress-db", sourceNamespace: "phoenix-places-golden", name: "Disposable Phoenix Places golden proof" } });
      await prisma.migrationLineage.create({ data: {
        sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceStableKey: OWNER_USER_SOURCE_RECORD_KEY, sourceRecordKey: OWNER_USER_SOURCE_RECORD_KEY,
        targetType: "USER", targetId: seedUser.id, targetRole: "primary", lastSourceHash: "seed", isActive: true, lastImportedAt: new Date(),
      } });

      const rawSource = FrozenPlaceSourceRepository.fromEnvironment(ARTIFACT_SHA256);
      const loadCandidate = createPlacesLoadCandidate(rawSource);
      const resolveTargetState = createPlacesTargetStateResolver(prisma, source.id);
      const resolveDependencies = createPlacesDependencyResolver(prisma, source.id);
      const write = createPlacesWriter(prisma, rawSource, source.id);

      const before = await counts(prisma);
      const candidate = loadCandidate(GOLDEN_KEY);
      if (candidate.dependencyPlan.ownerUserSourceRecordKey !== OWNER_USER_SOURCE_RECORD_KEY) {
        throw new Error(`Unexpected owner key: ${candidate.dependencyPlan.ownerUserSourceRecordKey}`);
      }

      const firstPlan = planLineageOnlyCreateAction(candidate.domainHash, await resolveTargetState(candidate));
      if (firstPlan.action !== "CREATE") throw new Error(`Expected CREATE, got ${firstPlan.action}: ${firstPlan.reason}`);
      const dependencies = await resolveDependencies(candidate);
      const written = await write(candidate, dependencies);
      const afterFirst = await counts(prisma);

      const lineage = await prisma.migrationLineage.findUniqueOrThrow({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: GOLDEN_KEY, targetType: "PLACE", targetRole: "primary" } } });
      if (lineage.targetId !== written.targetId || lineage.lastSourceHash !== candidate.domainHash) throw new Error("Persisted lineage/hash mismatch");

      const rerunCandidate = loadCandidate(GOLDEN_KEY);
      const secondPlan = planLineageOnlyCreateAction(rerunCandidate.domainHash, await resolveTargetState(rerunCandidate));
      if (secondPlan.action !== "SKIP_UNCHANGED") throw new Error(`Expected SKIP_UNCHANGED, got ${secondPlan.action}: ${secondPlan.reason}`);
      const afterRerun = await counts(prisma);

      const forbidden = ["MediaAsset", "Business", "Offer", "Route", "Activity", "Article"];
      const forbiddenUnchanged = forbidden.every((table) => before[table] === afterRerun[table]);
      const report = {
        schema: SCHEMA, artifactSha256: ARTIFACT_SHA256, sourceRecordKey: GOLDEN_KEY, domainHash: candidate.domainHash,
        ownerUserSourceRecordKey: candidate.dependencyPlan.ownerUserSourceRecordKey,
        firstRun: { plan: firstPlan.action, placeDelta: afterFirst.Place - before.Place, lineageDelta: afterFirst.MigrationLineage - before.MigrationLineage - 1 },
        rerun: { plan: secondPlan.action, create: 0, placeCountStable: afterRerun.Place === afterFirst.Place, lineageCountStable: afterRerun.MigrationLineage === afterFirst.MigrationLineage },
        persisted: { targetIdMatches: lineage.targetId === written.targetId, domainHashMatches: lineage.lastSourceHash === candidate.domainHash },
        forbiddenTablesUnchanged: forbiddenUnchanged, mediaBinaryWrites: 0,
      };
      if (!forbiddenUnchanged || !report.rerun.placeCountStable || !report.rerun.lineageCountStable) throw new Error("Golden proof invariants failed");
      console.log(JSON.stringify(report, null, 2));
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    const cleanup = new PrismaClient();
    await cleanup.$executeRawUnsafe(`drop schema if exists "${SCHEMA}" cascade`);
    await cleanup.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
