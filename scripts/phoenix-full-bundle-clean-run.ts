import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import {
  JsonLinesPhoenixReportStore,
  loadPhoenixReleaseManifest,
  runPhoenixRelease,
  verifyArtifactHashes,
  type PhoenixEnvironmentContext,
  type PhoenixPhaseReport,
  type PhoenixReleaseManifest,
} from "../src/lib/migration/release";
import { buildPhoenixAdapterRegistry, EXECUTABLE_PHASES } from "../src/lib/migration/release/adapters/registry";
import { resolvePhoenixArtifactFile, resolvePhoenixArtifactRoot } from "./phoenix-artifact-paths";

/**
 * One combined disposable-schema proof across all seven Phoenix
 * vertical slices (Users, Places, Offers, Routes, Events, Articles), run
 * together through the real `buildPhoenixAdapterRegistry` +
 * `runPhoenixRelease` — not each entity's own isolated golden proof, and
 * not a hand-rolled reimplementation of the pipeline.
 *
 * phases together in their real dependency order, including Businesses.
 *
 * Two narrow, clearly-scoped deviations from the committed manifest,
 * neither of which touches the checked-in file:
 *  1. The committed `users` phase declares `wordpress-db:user:38` as
 *     `SKIP_UNCHANGED` because that user already exists on the real DEV
 *     target. On a truly empty disposable schema it does not exist yet,
 *     so this script overrides just that one record's expected action to
 *     `CREATE` for the first (apply) pass.
 *  2. `runPhoenixRelease`'s `SequentialEntityPhaseAdapter.apply`/`.rerun`
 *     both compare the live planner's result against the manifest's own
 *     declared `record.action` (an a-priori expectation, not a live
 *     dry-run) — by design, matching how `scripts/generate-phoenix-
 *     release-manifest.ts` bakes real target-state into the committed
 *     manifest. A genuine rerun pass therefore needs a manifest whose
 *     declared actions reflect the state *after* the first apply; this
 *     script builds that second-pass manifest by setting every record's
 *     action to `SKIP_UNCHANGED`, exactly what a live regenerate-from-
 *     target-state pass would produce once every record already exists.
 */

const SCHEMA = "phoenix_full_bundle_clean_run_20260731";
const MANIFEST_PATH = "docs/migration/releases/phoenix-approved-2026-07-30.json";
const RELEASE_ROOT_ENV = "PHOENIX_RELEASE_ARTIFACT_ROOT";
const EXPECTED_RELEASE_CAPTURES = [
  "users/capture.json",
  "places/capture.json",
  "offers/capture.json",
  "routes/capture.json",
  "events/capture.json",
  "articles/capture.json",
] as const;

function schemaUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", SCHEMA);
  return url.toString();
}

function codeSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function buildBundleManifest(manifest: PhoenixReleaseManifest): PhoenixReleaseManifest {
  const phases = manifest.phases.map((phase) => {
    if (phase.name !== "users") return phase;
    return {
      ...phase,
      records: phase.records.map((record) =>
        record.sourceRecordKey === "wordpress-db:user:38" ? { ...record, action: "CREATE" as const } : record,
      ),
    };
  });
  return { ...manifest, phaseOrder: [...EXECUTABLE_PHASES], phases };
}

function buildRerunManifest(bundleManifest: PhoenixReleaseManifest): PhoenixReleaseManifest {
  const phases = bundleManifest.phases.map((phase) => {
    if (!EXECUTABLE_PHASES.includes(phase.name)) return phase;
    return { ...phase, records: phase.records.map((record) => ({ ...record, action: "SKIP_UNCHANGED" as const })) };
  });
  return { ...bundleManifest, phases };
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [user, place, offer, route, activity, article, business, lineage, media] = await Promise.all([
    prisma.user.count(),
    prisma.place.count(),
    prisma.offer.count(),
    prisma.route.count(),
    prisma.activity.count(),
    prisma.article.count(),
    prisma.business.count(),
    prisma.migrationLineage.count({ where: { isActive: true } }),
    prisma.mediaAsset.count(),
  ]);
  return { User: user, Place: place, Offer: offer, Route: route, Activity: activity, Article: article, Business: business, MigrationLineage: lineage, MediaAsset: media };
}

function summarizeReports(reports: readonly PhoenixPhaseReport[]) {
  return reports.map((r) => ({
    phase: r.phase,
    attempted: r.attempted,
    created: r.created,
    updated: r.updated,
    skipped: r.skipped,
    protectedConflicts: r.protectedConflicts,
    failed: r.failed,
  }));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const { root: artifactRoot } = resolvePhoenixArtifactRoot(RELEASE_ROOT_ENV, EXPECTED_RELEASE_CAPTURES);
  resolvePhoenixArtifactFile("PHOENIX_MANUAL_PRIVILEGED_CAPTURE");
  const reportDir = mkdtempSync(join(tmpdir(), "phoenix-full-bundle-clean-run-"));
  const reportPath = join(reportDir, "apply.jsonl");

  const { manifest, manifestHash } = loadPhoenixReleaseManifest(MANIFEST_PATH);
  verifyArtifactHashes(MANIFEST_PATH, manifest);
  const bundleManifest = buildBundleManifest(manifest);
  const rerunManifest = buildRerunManifest(bundleManifest);

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
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: isolatedUrl },
      stdio: "pipe",
    });
    const prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
    try {
      const environment: PhoenixEnvironmentContext = {
        environment: "LOCAL",
        database: { environment: "LOCAL", host: "disposable", port: "5432", database: SCHEMA, schema: SCHEMA, currentDatabase: SCHEMA },
        storage: { environment: "LOCAL", provider: "disposable-proof", locationHash: "n/a" },
      };
      const platformOwnerEmail = "phoenix-founder-proof@mamago.invalid";
      process.env.PHOENIX_PLATFORM_OWNER_EMAIL = platformOwnerEmail;
      await prisma.user.create({ data: { email: platformOwnerEmail, role: "ADMIN", status: "ACTIVE", passwordHash: "unchanged-proof-hash", displayName: "Platform founder" } });
      const country = await prisma.country.create({ data: { name: "Беларусь", slug: "belarus", isoCode: "BY", isActive: true } });
      const minsk = await prisma.city.create({ data: { countryId: country.id, name: "Минск", slug: "minsk", isActive: true } });
      await prisma.city.createMany({ data: [
        { countryId: country.id, name: "Копище", slug: "kopishche", isActive: true },
        { countryId: country.id, name: "Мир", slug: "mir", isActive: true },
        { countryId: country.id, name: "Ратомка", slug: "ratomka", isActive: true },
      ] });
      const platformOwner = await prisma.user.findUniqueOrThrow({ where: { email: platformOwnerEmail } });
      const platformOwnerBefore = { ...platformOwner };
      const protectedPlace = await prisma.place.create({ data: {
        title: "Атмосфера", slug: "atmosfera", shortDesc: "Protected pre-existing Place fixture", status: "PENDING",
        locationSource: "MANUAL", createdByUserId: platformOwner.id, cityId: minsk.id,
      } });
      const sha = codeSha();
      const before = await counts(prisma);

      const applyAdapters = await buildPhoenixAdapterRegistry({ prisma, artifactRoot, manifest: bundleManifest });
      const applyStore = new JsonLinesPhoenixReportStore(reportPath);
      const applyReports = await runPhoenixRelease({
        manifest: bundleManifest,
        manifestPath: MANIFEST_PATH,
        manifestHash,
        environment,
        mode: "APPLY",
        codeSha: sha,
        adapters: applyAdapters,
        reportStore: applyStore,
      });
      const afterApply = await counts(prisma);

      const platformOwnerAfter = await prisma.user.findUniqueOrThrow({ where: { id: platformOwner.id } });
      if (JSON.stringify(platformOwnerAfter) !== JSON.stringify(platformOwnerBefore)) throw new Error("Platform owner changed during lineage adoption.");
      const ownerLineages = await prisma.migrationLineage.findMany({ where: { sourceRecordKey: { in: ["wordpress-db:user:1", "wordpress-db:user:43", "wordpress-db:user:129"] }, targetType: "USER", isActive: true }, select: { sourceRecordKey: true, targetId: true } });
      if (ownerLineages.length !== 3 || new Set(ownerLineages.map((row) => row.sourceRecordKey)).size !== 3) throw new Error("Owner prerequisite lineage is missing or duplicated.");
      const affectedOwnerIds = ownerLineages.map((row) => row.targetId).filter((id): id is string => Boolean(id));
      const affectedPlaces = await prisma.place.count({ where: { createdByUserId: { in: affectedOwnerIds }, id: { not: protectedPlace.id } } });
      const affectedOffers = await prisma.offer.count({ where: { placeId: { not: protectedPlace.id }, place: { createdByUserId: { in: affectedOwnerIds } } } });
      if (affectedPlaces !== 15) throw new Error(`Expected 15/15 affected Places, found ${affectedPlaces}.`);
      if (affectedOffers !== 20) throw new Error(`Expected 20/20 affected Offers, found ${affectedOffers}.`);

      const expectedCreated: Record<string, number> = { users: 563, businesses: 38, places: 78, offers: 63, routes: 14, events: 8, articles: 26 };
      for (const report of applyReports) {
        if (report.failed !== 0) throw new Error(`Apply pass had failures in phase ${report.phase}: ${report.firstFailure}`);
        if (report.created !== expectedCreated[report.phase]) {
          throw new Error(`Phase ${report.phase}: expected ${expectedCreated[report.phase]} created, got ${report.created}`);
        }
      }

      // Second pass: fresh registry instance (new MigrationSource upserts
      // are idempotent no-ops the second time), fresh report store — this
      // is a genuine second `runPhoenixRelease` invocation, not a
      // replay of the first pass's in-memory results.
      const rerunAdapters = await buildPhoenixAdapterRegistry({ prisma, artifactRoot, manifest: rerunManifest });
      const rerunReportPath = join(reportDir, "rerun.jsonl");
      const rerunStore = new JsonLinesPhoenixReportStore(rerunReportPath);
      const rerunReports = await runPhoenixRelease({
        manifest: rerunManifest,
        manifestPath: MANIFEST_PATH,
        manifestHash,
        environment,
        mode: "RERUN",
        codeSha: sha,
        adapters: rerunAdapters,
        reportStore: rerunStore,
      });
      const afterRerun = await counts(prisma);

      for (const report of rerunReports) {
        if (report.failed !== 0) throw new Error(`Rerun pass had failures in phase ${report.phase}: ${report.firstFailure}`);
        if (report.created !== 0 || report.updated !== 0) {
          throw new Error(`Rerun phase ${report.phase} must be a pure no-op: created=${report.created} updated=${report.updated}`);
        }
      }

      const stableAcrossRerun = Object.keys(afterApply).every((key) => afterApply[key] === afterRerun[key]);
      if (!stableAcrossRerun) throw new Error(`Target counts changed between apply and rerun: ${JSON.stringify({ afterApply, afterRerun })}`);
      if (afterApply.Business - before.Business !== 38) throw new Error("Businesses phase must create exactly 38 approved owner Businesses.");

      const report = {
        schema: SCHEMA,
        manifestHash,
        codeSha: sha,
        before,
        afterApply,
        afterRerun,
        ownerDependencyProof: { affectedPlaces, affectedOffers, ownerLineages: ownerLineages.length, platformAdminUnchanged: true },
        applyPhaseSummary: summarizeReports(applyReports),
        rerunPhaseSummary: summarizeReports(rerunReports),
      };
      console.log(JSON.stringify(report, null, 2));
    } finally {
      await prisma.$disconnect();
      rmSync(reportDir, { recursive: true, force: true });
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
