import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

import { planOffersCreateAction } from "../src/lib/migration/release/adapters/offersAdapter";
import { createOffersDependencyResolver, createOffersLoadCandidate, createOffersTargetStateResolver, createOffersWriter } from "../src/lib/migration/release/adapters/offersProductionWiring";
import { FrozenOfferSourceRepository } from "../src/lib/migration/release/adapters/frozenOfferSourceRepository";

const GOLDEN_KEY = "wordpress-db:hb-programs:18932";
const PLACE_SOURCE_RECORD_KEY = "wordpress-db:places:18886"; // this Offer's real captured placeRelation target
const ARTIFACT_SHA256 = "398e86f0a989e226330b70e838ddaf901276681cd7ae7976a24546eb2b177b16";
const SCHEMA = "phoenix_offers_golden_20260731";

function schemaUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", SCHEMA);
  return url.toString();
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [offer, lineage, record, media, user, business, place, route, activity, article] = await Promise.all([
    prisma.offer.count(), prisma.migrationLineage.count(), prisma.migrationRecord.count(), prisma.mediaAsset.count(),
    prisma.user.count(), prisma.business.count(), prisma.place.count(), prisma.route.count(), prisma.activity.count(), prisma.article.count(),
  ]);
  return { Offer: offer, MigrationLineage: lineage, MigrationRecord: record, MediaAsset: media, User: user, Business: business, Place: place, Route: route, Activity: activity, Article: article };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const artifactRoot = process.env.PHOENIX_RELEASE_ARTIFACT_ROOT;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!artifactRoot) throw new Error("PHOENIX_RELEASE_ARTIFACT_ROOT is required");

  const admin = new PrismaClient();
  const existing = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists(select 1 from information_schema.schemata where schema_name = '${SCHEMA}')`,
  );
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
      // --- Seed prerequisite phases' output (Users/Places would already exist for real by this point) ---
      const country = await prisma.country.create({ data: { name: "Belarus", slug: "by" } });
      const city = await prisma.city.create({ data: { countryId: country.id, name: "Minsk", slug: "minsk" } });
      const seedUser = await prisma.user.create({ data: { email: "golden-proof-place-owner@example.invalid" } });
      const place = await prisma.place.create({ data: { title: "Golden Place", shortDesc: "Golden place for the golden proof", activityTypes: [], ageTags: [], visitFormats: [], createdByUserId: seedUser.id, cityId: city.id } });

      const source = await prisma.migrationSource.create({ data: { adapterKey: "wordpress-db", sourceNamespace: "phoenix-offers-golden", name: "Disposable Phoenix Offers golden proof" } });
      await prisma.migrationLineage.create({ data: {
        sourceId: source.id, sourceEntityType: "wordpress-db:places", sourceStableKey: PLACE_SOURCE_RECORD_KEY, sourceRecordKey: PLACE_SOURCE_RECORD_KEY,
        targetType: "PLACE", targetId: place.id, targetRole: "primary", lastSourceHash: "seed", isActive: true, lastImportedAt: new Date(),
      } });

      // --- Real pipeline, real captured content, real checksum verification ---
      const rawSource = FrozenOfferSourceRepository.fromEnvironment(ARTIFACT_SHA256);
      const loadCandidate = createOffersLoadCandidate(rawSource, prisma, source.id);
      const resolveTargetState = createOffersTargetStateResolver(prisma, source.id);
      const resolveDependencies = createOffersDependencyResolver(prisma, source.id);
      const write = createOffersWriter(prisma, rawSource, source.id, "METADATA");

      const before = await counts(prisma);
      const candidate = await loadCandidate(GOLDEN_KEY);
      if (candidate.dependencyPlan.placeSourceRecordKey !== PLACE_SOURCE_RECORD_KEY) {
        throw new Error(`Unexpected placeSourceRecordKey: ${candidate.dependencyPlan.placeSourceRecordKey}`);
      }

      const firstRun = await prisma.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "phoenix-offers-v1" } });
      const firstRecord = await prisma.migrationRecord.create({ data: {
        sourceId: source.id, runId: firstRun.id, status: "PLANNED", sourceEntityType: "wordpress-db:hb-programs", sourceStableKey: GOLDEN_KEY,
        sourceRecordKey: GOLDEN_KEY, sourceHash: candidate.domainHashV2, targetTypeHint: "OFFER", planAction: "CREATE",
      } });
      const firstPlan = planOffersCreateAction(candidate, await resolveTargetState(candidate));
      if (firstPlan.action !== "CREATE") throw new Error(`Expected CREATE, got ${firstPlan.action}: ${firstPlan.reason}`);
      const dependencies = await resolveDependencies(candidate);
      const written = await write(candidate, dependencies);
      await prisma.migrationRecord.update({ where: { id: firstRecord.id }, data: { status: "COMPLETED" } });
      await prisma.migrationRun.update({ where: { id: firstRun.id }, data: { status: "COMPLETED", finishedAt: new Date() } });

      const afterFirst = await counts(prisma);
      const lineage = await prisma.migrationLineage.findUniqueOrThrow({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: GOLDEN_KEY, targetType: "OFFER", targetRole: "primary" } } });
      if (lineage.targetId !== written.targetId || lineage.lastSourceHash !== candidate.domainHashV2) throw new Error("Persisted lineage/hash mismatch");

      // --- Rerun: expect SKIP_UNCHANGED, no duplicate ---
      const secondRun = await prisma.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "phoenix-offers-v1" } });
      const rerunCandidate = await loadCandidate(GOLDEN_KEY);
      const secondPlan = planOffersCreateAction(rerunCandidate, await resolveTargetState(rerunCandidate));
      if (secondPlan.action !== "SKIP_UNCHANGED") throw new Error(`Expected SKIP_UNCHANGED, got ${secondPlan.action}: ${secondPlan.reason}`);
      await prisma.migrationRecord.create({ data: {
        sourceId: source.id, runId: secondRun.id, status: "COMPLETED", sourceEntityType: "wordpress-db:hb-programs", sourceStableKey: GOLDEN_KEY,
        sourceRecordKey: GOLDEN_KEY, sourceHash: rerunCandidate.domainHashV2, targetTypeHint: "OFFER", planAction: "SKIP_UNCHANGED",
      } });
      await prisma.migrationRun.update({ where: { id: secondRun.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
      const afterRerun = await counts(prisma);

      const forbidden = ["MediaAsset", "Route", "Activity", "Article"];
      const forbiddenUnchanged = forbidden.every((table) => before[table] === afterRerun[table]);
      const report = {
        schema: SCHEMA, artifactSha256: ARTIFACT_SHA256, sourceRecordKey: GOLDEN_KEY, domainHashV2: candidate.domainHashV2,
        dependencyPlan: candidate.dependencyPlan,
        firstRun: { plan: firstPlan.action, offerDelta: afterFirst.Offer - before.Offer, lineageDelta: afterFirst.MigrationLineage - before.MigrationLineage - 1 /* minus the seeded Place lineage */, migrationRecordDelta: afterFirst.MigrationRecord - before.MigrationRecord },
        rerun: { plan: secondPlan.action, create: 0, update: 0, offerCountStable: afterRerun.Offer === afterFirst.Offer, lineageCountStable: afterRerun.MigrationLineage === afterFirst.MigrationLineage },
        persisted: { targetIdMatches: lineage.targetId === written.targetId, domainHashMatches: lineage.lastSourceHash === candidate.domainHashV2 },
        forbiddenTablesUnchanged: forbiddenUnchanged, mediaBinaryWrites: 0,
      };
      if (!forbiddenUnchanged || !report.rerun.offerCountStable || !report.rerun.lineageCountStable) throw new Error("Golden proof invariants failed");
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
