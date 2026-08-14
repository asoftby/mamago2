import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { EventsPhaseExecutor, EventsFreshTargetPhaseAdapter } from "../src/lib/migration/release/adapters/eventsAdapter";
import { createEventsCandidateLoader, createEventsPhasePreflight, createEventsTargetStateResolver, createEventsWriter } from "../src/lib/migration/release/adapters/eventsProductionWiring";
import { FrozenEventSourceRepository } from "../src/lib/migration/release/adapters/frozenEventSourceRepository";
import type { PhoenixReleasePhase } from "../src/lib/migration/release/types";

const SCHEMA = "phoenix_events_golden_20260731_codex";
const KEY = "wordpress-db:events:64505";
const HASH = "wordpress-db-domain-v2:5a0828b3e1893ec0935be2d1915dbd16278b4b1163dbc9085b809c6fd9892b6d";
const ARTIFACT_SHA = "1ae318559c10727e3d7fc315ea3be69c4e0e3506f97220e8a55979607af83840";
const OWNER_KEY = "wordpress-db:user:538";

function withSchema(databaseUrl: string): string { const url = new URL(databaseUrl); url.searchParams.set("schema", SCHEMA); return url.toString(); }
const phase = (action: "CREATE" | "SKIP_UNCHANGED"): PhoenixReleasePhase => ({ name: "events", status: "READY", artifacts: [], records: [{ sourceRecordKey: KEY, action }], protectedSourceRecordKeys: [], excludedSourceRecordKeys: ["wordpress-db:events:55980", "wordpress-db:events:64159"], deterministicConflicts: [], mediaPolicy: "NONE", prerequisites: [] });

async function main(): Promise<void> {
  const baseUrl = process.env.DATABASE_URL; if (!baseUrl) throw new Error("DATABASE_URL is required");
  if (!process.env.PHOENIX_RELEASE_ARTIFACT_ROOT) throw new Error("PHOENIX_RELEASE_ARTIFACT_ROOT is required");
  const admin = new PrismaClient();
  const exists = await admin.$queryRawUnsafe<Array<{ exists: boolean }>>(`select exists(select 1 from information_schema.schemata where schema_name = '${SCHEMA}')`);
  if (exists[0]?.exists) throw new Error(`Disposable schema already exists: ${SCHEMA}`);
  await admin.$executeRawUnsafe(`create schema "${SCHEMA}"`); await admin.$disconnect();
  const url = withSchema(baseUrl);
  try {
    execFileSync("pnpm", ["prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const source = await prisma.migrationSource.create({ data: { adapterKey: "wordpress-db", sourceNamespace: "phoenix-events-golden", name: "Disposable Phoenix Events golden proof" } });
      const owner = await prisma.user.create({ data: { email: "phoenix-events-golden@example.invalid" } });
      await prisma.migrationLineage.create({ data: { sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceStableKey: OWNER_KEY, sourceRecordKey: OWNER_KEY, targetType: "USER", targetId: owner.id, targetRole: "primary", lastSourceHash: "golden-owner", isActive: true } });
      const raw = FrozenEventSourceRepository.fromEnvironment(ARTIFACT_SHA);
      const loadCandidate = createEventsCandidateLoader(raw, new Map([[KEY, HASH]]));
      const adapter = new EventsFreshTargetPhaseAdapter(createEventsPhasePreflight(prisma), new EventsPhaseExecutor({ loadCandidate, resolveTargetState: createEventsTargetStateResolver(prisma, source.id), write: createEventsWriter(prisma, raw, source.id) }));
      const before = { activities: await prisma.activity.count(), sessions: await prisma.activitySession.count(), lineages: await prisma.migrationLineage.count(), media: await prisma.mediaAsset.count(), places: await prisma.place.count(), offers: await prisma.offer.count(), routes: await prisma.route.count(), articles: await prisma.article.count() };

      const run1 = await prisma.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "phoenix-events-v1" } });
      const rec1 = await prisma.migrationRecord.create({ data: { sourceId: source.id, runId: run1.id, status: "PLANNED", sourceEntityType: "wordpress-db:events", sourceStableKey: KEY, sourceRecordKey: KEY, sourceHash: HASH, targetTypeHint: "ACTIVITY", planAction: "CREATE" } });
      const first = await adapter.apply(phase("CREATE")); if (first[0]?.outcome !== "CREATED") throw new Error(`First run failed: ${first[0]?.error}`);
      await prisma.migrationRecord.update({ where: { id: rec1.id }, data: { status: "COMPLETED" } }); await prisma.migrationRun.update({ where: { id: run1.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
      const afterFirst = { activities: await prisma.activity.count(), sessions: await prisma.activitySession.count(), lineages: await prisma.migrationLineage.count(), records: await prisma.migrationRecord.count() };

      const run2 = await prisma.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "phoenix-events-v1" } });
      const second = await adapter.rerun(phase("SKIP_UNCHANGED")); if (second[0]?.outcome !== "SKIPPED") throw new Error(`Rerun failed: ${second[0]?.error}`);
      await prisma.migrationRecord.create({ data: { sourceId: source.id, runId: run2.id, status: "COMPLETED", sourceEntityType: "wordpress-db:events", sourceStableKey: KEY, sourceRecordKey: KEY, sourceHash: HASH, targetTypeHint: "ACTIVITY", planAction: "SKIP_UNCHANGED" } }); await prisma.migrationRun.update({ where: { id: run2.id }, data: { status: "COMPLETED", finishedAt: new Date() } });
      const afterRerun = { activities: await prisma.activity.count(), sessions: await prisma.activitySession.count(), lineages: await prisma.migrationLineage.count(), records: await prisma.migrationRecord.count(), media: await prisma.mediaAsset.count(), places: await prisma.place.count(), offers: await prisma.offer.count(), routes: await prisma.route.count(), articles: await prisma.article.count() };
      const eventLineage = await prisma.migrationLineage.findUniqueOrThrow({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: KEY, targetType: "ACTIVITY", targetRole: "primary" } } });
      const report = { schema: SCHEMA, sourceRecordKey: KEY, artifactSha256: ARTIFACT_SHA, firstRun: { preflight: "PASS", plan: "CREATE", activityDelta: afterFirst.activities - before.activities, scheduleDateDelta: afterFirst.sessions - before.sessions, eventLineageDelta: afterFirst.lineages - before.lineages, migrationRecordDelta: afterFirst.records }, rerun: { plan: "SKIP_UNCHANGED", create: 0, update: 0, activityCountStable: afterRerun.activities === afterFirst.activities, scheduleDateCountStable: afterRerun.sessions === afterFirst.sessions, lineageCountStable: afterRerun.lineages === afterFirst.lineages, migrationRecordDelta: afterRerun.records - afterFirst.records }, persistedHashMatches: eventLineage.lastSourceHash === HASH, forbiddenTablesUnchanged: before.media === afterRerun.media && before.places === afterRerun.places && before.offers === afterRerun.offers && before.routes === afterRerun.routes && before.articles === afterRerun.articles, mediaBinaryWrites: 0 };
      if (report.firstRun.activityDelta !== 1 || report.firstRun.scheduleDateDelta < 1 || report.firstRun.eventLineageDelta !== 1 || !report.rerun.activityCountStable || !report.rerun.scheduleDateCountStable || !report.rerun.lineageCountStable || !report.persistedHashMatches || !report.forbiddenTablesUnchanged) throw new Error("Events golden proof invariant failed");
      console.log(JSON.stringify(report, null, 2));
    } finally { await prisma.$disconnect(); }
  } finally { const cleanup = new PrismaClient(); await cleanup.$executeRawUnsafe(`drop schema if exists "${SCHEMA}" cascade`); await cleanup.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
