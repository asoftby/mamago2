import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

import { planLineageOnlyCreateAction } from "../src/lib/migration/release/adapters/lineageOnlyPlanner";
import { createArticlesTargetStateResolver, createArticlesWriter } from "../src/lib/migration/release/adapters/articlesProductionWiring";
import { FrozenArticleSourceRepository } from "../src/lib/migration/release/adapters/frozenArticleSourceRepository";

const GOLDEN_KEY = "wordpress-db:post:24695";
const DOMAIN_HASH = "wordpress-db-domain-v2:63e4b2f0172c6870885f0929aa0f59478f702b4bf3e24d24973cf8661b5abce0";
const ARTIFACT_SHA256 = "def08a4a6a31b91583c6dd502a2322b1a8e9577abacf3160a430e226c5866529";
const SCHEMA = "phoenix_articles_golden_20260731_codex";

function schemaUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", SCHEMA);
  return url.toString();
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [article, lineage, record, media, user, business, place, offer, route, activity] = await Promise.all([
    prisma.article.count(), prisma.migrationLineage.count(), prisma.migrationRecord.count(), prisma.mediaAsset.count(),
    prisma.user.count(), prisma.business.count(), prisma.place.count(), prisma.offer.count(), prisma.route.count(), prisma.activity.count(),
  ]);
  return { Article: article, MigrationLineage: lineage, MigrationRecord: record, MediaAsset: media, User: user, Business: business, Place: place, Offer: offer, Route: route, Activity: activity };
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
      const source = await prisma.migrationSource.create({ data: { adapterKey: "wordpress-db", sourceNamespace: "phoenix-articles-golden", name: "Disposable Phoenix Articles golden proof" } });
      const rawSource = FrozenArticleSourceRepository.fromEnvironment(ARTIFACT_SHA256);
      const candidate = { sourceRecordKey: GOLDEN_KEY, domainHash: DOMAIN_HASH };
      const resolveTargetState = createArticlesTargetStateResolver(prisma, source.id);
      const write = createArticlesWriter(prisma, rawSource, source.id);
      const before = await counts(prisma);

      const firstRun = await prisma.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "phoenix-articles-v1" } });
      const firstRecord = await prisma.migrationRecord.create({ data: {
        sourceId: source.id, runId: firstRun.id, status: "PLANNED", sourceEntityType: "wordpress-db:post", sourceStableKey: GOLDEN_KEY,
        sourceRecordKey: GOLDEN_KEY, sourceHash: DOMAIN_HASH, targetTypeHint: "ARTICLE", planAction: "CREATE",
      } });
      const firstPlan = planLineageOnlyCreateAction(DOMAIN_HASH, await resolveTargetState(candidate));
      if (firstPlan.action !== "CREATE") throw new Error(`Expected CREATE, got ${firstPlan.action}`);
      const written = await write(candidate);
      await prisma.migrationRecord.update({ where: { id: firstRecord.id }, data: { status: "COMPLETED" } });
      await prisma.migrationRun.update({ where: { id: firstRun.id }, data: { status: "COMPLETED", finishedAt: new Date() } });

      const afterFirst = await counts(prisma);
      const lineage = await prisma.migrationLineage.findUniqueOrThrow({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: GOLDEN_KEY, targetType: "ARTICLE", targetRole: "primary" } } });
      if (lineage.targetId !== written.targetId || lineage.lastSourceHash !== DOMAIN_HASH) throw new Error("Persisted lineage/hash mismatch");

      const secondRun = await prisma.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "phoenix-articles-v1" } });
      const secondPlan = planLineageOnlyCreateAction(DOMAIN_HASH, await resolveTargetState(candidate));
      if (secondPlan.action !== "SKIP_UNCHANGED") throw new Error(`Expected SKIP_UNCHANGED, got ${secondPlan.action}`);
      await prisma.migrationRecord.create({ data: {
        sourceId: source.id, runId: secondRun.id, status: "COMPLETED", sourceEntityType: "wordpress-db:post", sourceStableKey: GOLDEN_KEY,
        sourceRecordKey: GOLDEN_KEY, sourceHash: DOMAIN_HASH, targetTypeHint: "ARTICLE", planAction: "SKIP_UNCHANGED",
      } });
      await prisma.migrationRun.update({ where: { id: secondRun.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
      const afterRerun = await counts(prisma);

      const forbidden = ["MediaAsset", "User", "Business", "Place", "Offer", "Route", "Activity"];
      const forbiddenUnchanged = forbidden.every((table) => before[table] === afterRerun[table]);
      const report = {
        schema: SCHEMA, artifactSha256: ARTIFACT_SHA256, sourceRecordKey: GOLDEN_KEY, domainHash: DOMAIN_HASH,
        firstRun: { plan: firstPlan.action, articleDelta: afterFirst.Article - before.Article, lineageDelta: afterFirst.MigrationLineage - before.MigrationLineage, migrationRecordDelta: afterFirst.MigrationRecord - before.MigrationRecord },
        rerun: { plan: secondPlan.action, create: 0, articleCountStable: afterRerun.Article === afterFirst.Article, lineageCountStable: afterRerun.MigrationLineage === afterFirst.MigrationLineage, migrationRecordDelta: afterRerun.MigrationRecord - afterFirst.MigrationRecord, update: 0 },
        persisted: { targetIdMatches: lineage.targetId === written.targetId, domainHashMatches: lineage.lastSourceHash === DOMAIN_HASH },
        forbiddenTablesUnchanged: forbiddenUnchanged, mediaBinaryWrites: 0,
      };
      if (!forbiddenUnchanged || !report.rerun.articleCountStable || !report.rerun.lineageCountStable) throw new Error("Golden proof invariants failed");
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
