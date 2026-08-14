/**
 * 20260804-phoenix-ratomka-place-43635.ts
 *
 * One-time, versioned data repair for a single Phoenix migration Place
 * whose `cityId` was left NULL because its WordPress taxonomy city
 * ("Ратомка" / slug `ratomka`) had no corresponding `City` row yet.
 *
 * Scope (fail-closed — refuses to touch anything else):
 *   - MigrationSource: adapterKey "wordpress-db", sourceNamespace
 *     "phoenix-release-bundle" (docs/migration/prelaunch-checklist.md:1722)
 *     — hardcoded, never accepted from the CLI.
 *   - Place source key: wordpress-db:places:43635
 *   - Blocked Offer this unblocks: wordpress-db:hb-programs:43659
 *   - City to create if absent: name "Ратомка", slug "ratomka", Belarus
 *
 * Never a schema change — see scripts/data-migrations/README.md
 * ("Schema changes → prisma migrate; Data backfill → scripts in this
 * directory"). This is a data backfill: it creates at most one City row
 * and updates at most one Place.cityId.
 *
 * Modes:
 *   --plan   (default) read-only. `runPreflight` is typed against
 *            `RatomkaRepairReadOnlyPrismaClient`, which has no
 *            create/update/updateMany members at all — a write call from
 *            inside preflight is a compile error, not just an unwritten
 *            one.
 *   --apply  runs the single Prisma transaction described below, but only
 *            after every precondition in --plan passes again inside the
 *            transaction.
 *
 * Remote-execution evidence guardrails (required CLI args, no defaults —
 * see `parseRemoteExecutionArgs`): --environment, --database,
 * --report-path, --report-sha256, --checkpoint-path, --checkpoint-sha256.
 * All are checked byte-for-byte against the expected constants below
 * *and* independently re-hashed from the actual files on disk — a
 * caller-supplied hash is never trusted as proof a file exists or is
 * intact. `--source-namespace` is deliberately not a flag: source scope
 * is a hardcoded constant (`SOURCE_NAMESPACE` below), not operator input.
 *
 * Run:
 *   tsx scripts/data-migrations/20260804-phoenix-ratomka-place-43635.ts --plan \
 *     --environment DEV --database devmamago \
 *     --report-path <path> --report-sha256 <sha> \
 *     --checkpoint-path <path> --checkpoint-sha256 <sha>
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { MigrationTargetType, PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Fixed scope constants — never accept these as CLI input, never widen them.
// ---------------------------------------------------------------------------

export const RELEASE_ID = "phoenix-approved-2026-07-30";
export const ADAPTER_KEY = "wordpress-db";
export const SOURCE_NAMESPACE = "phoenix-release-bundle";
export const PLACE_SOURCE_RECORD_KEY = "wordpress-db:places:43635";
export const EXPECTED_BLOCKED_OFFER_SOURCE_RECORD_KEY = "wordpress-db:hb-programs:43659";
export const CITY_NAME = "Ратомка";
export const CITY_SLUG = "ratomka";
export const COUNTRY_SLUG = "belarus";
export const EXPECTED_EXISTING_OFFER_LINEAGE_COUNT = 52;

export const EXPECTED_ENVIRONMENT = "DEV";
export const EXPECTED_DATABASE = "devmamago";
export const EXPECTED_REPORT_PATH =
  "/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/continuation-reports/1ae2658108fd/dev-continuation-1ae2658108fd.jsonl";
export const EXPECTED_REPORT_SHA256 = "5490cc2503b8f028c08b6e99181429090ee4fe332343f293ae7f41b0702d78bb";
export const EXPECTED_CHECKPOINT_PATH =
  "/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/checkpoints/live-after-places-1ae2658108fd.json";
export const EXPECTED_CHECKPOINT_SHA256 = "1eb43f7f635af6aa750b44ce17503a90c8952287b2ae92c6f998cf6e340f7508";

const PLACE_TARGET_TYPE: MigrationTargetType = "PLACE";
const OFFER_TARGET_TYPE: MigrationTargetType = "OFFER";
const NOT_YET_STARTED_TARGET_TYPES: MigrationTargetType[] = ["ROUTE", "ACTIVITY", "ARTICLE"];

// ---------------------------------------------------------------------------
// Narrow Prisma surfaces. Read-only is a strict subset of the full client:
// `runPreflight` takes only the former, so a write call inside preflight
// fails to compile — not merely "doesn't happen today by convention".
// ---------------------------------------------------------------------------

export type RatomkaRepairReadOnlyPrismaClient = {
  migrationSource: Pick<PrismaClient["migrationSource"], "findUnique">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findMany">;
  place: Pick<PrismaClient["place"], "findUnique">;
  city: Pick<PrismaClient["city"], "findFirst" | "findMany">;
  country: Pick<PrismaClient["country"], "findUnique">;
  offer: Pick<PrismaClient["offer"], "findUnique">;
};

export type RatomkaRepairPrismaClient = RatomkaRepairReadOnlyPrismaClient &
  Pick<PrismaClient, "$transaction"> & {
    place: RatomkaRepairReadOnlyPrismaClient["place"] & Pick<PrismaClient["place"], "updateMany">;
    city: RatomkaRepairReadOnlyPrismaClient["city"] & Pick<PrismaClient["city"], "create">;
  };

interface CityRow {
  id: string;
  name: string;
  slug: string;
  countryId: string;
  regionId: string | null;
  isActive: boolean;
  isVisibleInCityFilter: boolean;
  isLegacyNonCity: boolean;
  hasMetro: boolean;
  googlePlaceId: string | null;
  lat: number | null;
  lng: number | null;
}

interface PlaceRow {
  id: string;
  title: string;
  cityId: string | null;
}

// ---------------------------------------------------------------------------
// Remote-execution identity + evidence guardrails
// ---------------------------------------------------------------------------

export interface RemoteExecutionArgs {
  environment: string;
  database: string;
  reportPath: string;
  reportSha256: string;
  checkpointPath: string;
  checkpointSha256: string;
}

export type RemoteGuardFailure =
  | "WRONG_ENVIRONMENT"
  | "WRONG_DATABASE"
  | "REPORT_PATH_MISMATCH"
  | "REPORT_UNREADABLE"
  | "REPORT_SHA_MISMATCH"
  | "CHECKPOINT_PATH_MISMATCH"
  | "CHECKPOINT_UNREADABLE"
  | "CHECKPOINT_SHA_MISMATCH";

export interface RemoteGuardOk {
  ok: true;
}

export interface RemoteGuardErr {
  ok: false;
  reason: RemoteGuardFailure;
  detail: string;
}

export type RemoteGuardResult = RemoteGuardOk | RemoteGuardErr;

export interface RemoteGuardExpectations {
  environment: string;
  database: string;
  reportPath: string;
  reportSha256: string;
  checkpointPath: string;
  checkpointSha256: string;
}

const REAL_REMOTE_GUARD_EXPECTATIONS: RemoteGuardExpectations = {
  environment: EXPECTED_ENVIRONMENT,
  database: EXPECTED_DATABASE,
  reportPath: EXPECTED_REPORT_PATH,
  reportSha256: EXPECTED_REPORT_SHA256,
  checkpointPath: EXPECTED_CHECKPOINT_PATH,
  checkpointSha256: EXPECTED_CHECKPOINT_SHA256,
};

async function verifyFileHash(
  path: string,
  expectedSha256: string,
  readFileFn: (path: string) => Promise<Buffer>,
  unreadableReason: RemoteGuardFailure,
  mismatchReason: RemoteGuardFailure,
): Promise<RemoteGuardResult> {
  let bytes: Buffer;
  try {
    bytes = await readFileFn(path);
  } catch (error) {
    return { ok: false, reason: unreadableReason, detail: String(error) };
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    return { ok: false, reason: mismatchReason, detail: `file on disk hashes to ${actualSha256}, expected ${expectedSha256}` };
  }
  return { ok: true };
}

/**
 * Validates environment/database identity, then independently reads AND
 * re-hashes both the continuation report and the checkpoint file — a
 * caller-supplied hash is evidence of nothing by itself. `expected`
 * defaults to the real fixed constants for production use; tests inject
 * their own so the happy (`ok: true`) path is provable without needing a
 * preimage of the real files' sha256.
 */
export async function checkRemoteExecutionGuards(
  args: RemoteExecutionArgs,
  readReportFile: (path: string) => Promise<Buffer>,
  readCheckpointFile: (path: string) => Promise<Buffer>,
  expected: RemoteGuardExpectations = REAL_REMOTE_GUARD_EXPECTATIONS,
): Promise<RemoteGuardResult> {
  if (args.environment !== expected.environment) {
    return { ok: false, reason: "WRONG_ENVIRONMENT", detail: `expected ${expected.environment}, got ${args.environment}` };
  }
  if (args.database !== expected.database) {
    return { ok: false, reason: "WRONG_DATABASE", detail: `expected ${expected.database}, got ${args.database}` };
  }
  if (args.reportPath !== expected.reportPath) {
    return { ok: false, reason: "REPORT_PATH_MISMATCH", detail: `expected ${expected.reportPath}, got ${args.reportPath}` };
  }
  if (args.reportSha256 !== expected.reportSha256) {
    return { ok: false, reason: "REPORT_SHA_MISMATCH", detail: `expected ${expected.reportSha256}, got ${args.reportSha256}` };
  }
  if (args.checkpointPath !== expected.checkpointPath) {
    return { ok: false, reason: "CHECKPOINT_PATH_MISMATCH", detail: `expected ${expected.checkpointPath}, got ${args.checkpointPath}` };
  }
  if (args.checkpointSha256 !== expected.checkpointSha256) {
    return {
      ok: false,
      reason: "CHECKPOINT_SHA_MISMATCH",
      detail: `expected ${expected.checkpointSha256}, got ${args.checkpointSha256}`,
    };
  }

  const reportCheck = await verifyFileHash(args.reportPath, expected.reportSha256, readReportFile, "REPORT_UNREADABLE", "REPORT_SHA_MISMATCH");
  if (!reportCheck.ok) return reportCheck;

  const checkpointCheck = await verifyFileHash(
    args.checkpointPath,
    expected.checkpointSha256,
    readCheckpointFile,
    "CHECKPOINT_UNREADABLE",
    "CHECKPOINT_SHA_MISMATCH",
  );
  if (!checkpointCheck.ok) return checkpointCheck;

  return { ok: true };
}

export async function realReadFile(path: string): Promise<Buffer> {
  return readFile(path);
}

// ---------------------------------------------------------------------------
// Fail-closed preflight (shared by --plan and --apply). Read-only by type.
// ---------------------------------------------------------------------------

export type PreflightStatus =
  | "READY_TO_CREATE_CITY_AND_LINK_PLACE"
  | "NOOP_READY"
  | "MIGRATION_SOURCE_NOT_FOUND"
  | "PLACE_LINEAGE_MISSING"
  | "PLACE_LINEAGE_AMBIGUOUS"
  | "PLACE_TARGET_MISSING"
  | "PLACE_ALREADY_LINKED_TO_OTHER_CITY"
  | "CONFLICTING_CITY"
  | "CONFLICTING_CITY_NAME"
  | "OFFER_LINEAGE_COUNT_MISMATCH"
  | "OFFER_LINEAGE_TARGET_MISSING"
  | "BLOCKED_OFFER_ALREADY_MIGRATED"
  | "BLOCKED_OFFER_TARGET_ALREADY_EXISTS"
  | "LATER_PHASE_ALREADY_STARTED";

export interface PreflightResult {
  status: PreflightStatus;
  detail: string;
  placeId?: string;
  existingCityId?: string;
}

export async function runPreflight(prisma: RatomkaRepairReadOnlyPrismaClient): Promise<PreflightResult> {
  const source = await prisma.migrationSource.findUnique({
    where: { adapterKey_sourceNamespace: { adapterKey: ADAPTER_KEY, sourceNamespace: SOURCE_NAMESPACE } },
  });
  if (!source) {
    return { status: "MIGRATION_SOURCE_NOT_FOUND", detail: `no MigrationSource for adapterKey=${ADAPTER_KEY} sourceNamespace=${SOURCE_NAMESPACE}` };
  }
  const sourceId = source.id;

  const placeLineages = await prisma.migrationLineage.findMany({
    where: { sourceId, sourceRecordKey: PLACE_SOURCE_RECORD_KEY, targetType: PLACE_TARGET_TYPE, isActive: true },
  });
  if (placeLineages.length === 0) {
    return { status: "PLACE_LINEAGE_MISSING", detail: `no active MigrationLineage for ${PLACE_SOURCE_RECORD_KEY}` };
  }
  if (placeLineages.length > 1) {
    return { status: "PLACE_LINEAGE_AMBIGUOUS", detail: `${placeLineages.length} active lineage rows for ${PLACE_SOURCE_RECORD_KEY}` };
  }
  const placeId = placeLineages[0].targetId;
  if (!placeId) {
    return { status: "PLACE_TARGET_MISSING", detail: "lineage row has no targetId" };
  }

  const place = (await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, title: true, cityId: true },
  })) as PlaceRow | null;
  if (!place) {
    return { status: "PLACE_TARGET_MISSING", detail: `Place ${placeId} not found`, placeId };
  }

  const blockedOfferTarget = await prisma.offer.findUnique({ where: { createRequestId: EXPECTED_BLOCKED_OFFER_SOURCE_RECORD_KEY } });
  if (blockedOfferTarget) {
    return {
      status: "BLOCKED_OFFER_TARGET_ALREADY_EXISTS",
      detail: `an Offer with createRequestId=${EXPECTED_BLOCKED_OFFER_SOURCE_RECORD_KEY} already exists — this script's premise no longer holds`,
      placeId,
    };
  }

  const laterPhaseLineages = await prisma.migrationLineage.findMany({
    where: { sourceId, targetType: { in: NOT_YET_STARTED_TARGET_TYPES }, isActive: true },
  });
  if (laterPhaseLineages.length > 0) {
    return {
      status: "LATER_PHASE_ALREADY_STARTED",
      detail: `expected Routes/Activities/Articles untouched, found ${laterPhaseLineages.length} active lineage row(s) among ${NOT_YET_STARTED_TARGET_TYPES.join("/")}`,
      placeId,
    };
  }

  const offerLineages = await prisma.migrationLineage.findMany({
    where: { sourceId, targetType: OFFER_TARGET_TYPE, isActive: true },
  });
  const blockedOfferLineage = offerLineages.find((l) => l.sourceRecordKey === EXPECTED_BLOCKED_OFFER_SOURCE_RECORD_KEY);
  if (blockedOfferLineage) {
    return {
      status: "BLOCKED_OFFER_ALREADY_MIGRATED",
      detail: `${EXPECTED_BLOCKED_OFFER_SOURCE_RECORD_KEY} already has an active lineage row — this script's premise (still-blocked Offer) no longer holds`,
      placeId,
    };
  }
  if (offerLineages.length !== EXPECTED_EXISTING_OFFER_LINEAGE_COUNT) {
    return {
      status: "OFFER_LINEAGE_COUNT_MISMATCH",
      detail: `expected ${EXPECTED_EXISTING_OFFER_LINEAGE_COUNT} active Offer lineage rows scoped to this source, found ${offerLineages.length}`,
      placeId,
    };
  }
  if (offerLineages.some((l) => !l.targetId)) {
    return {
      status: "OFFER_LINEAGE_TARGET_MISSING",
      detail: "at least one of the scoped active Offer lineage rows has no targetId",
      placeId,
    };
  }

  // Country.slug is @unique (prisma/schema.prisma) — findUnique can only
  // ever return 0 or 1 rows, so "resolves unambiguously" is guaranteed by
  // the DB constraint itself; no separate ambiguity check is meaningful.
  const country = await prisma.country.findUnique({ where: { slug: COUNTRY_SLUG } });
  if (!country) {
    return { status: "PLACE_TARGET_MISSING", detail: `Country ${COUNTRY_SLUG} not found`, placeId };
  }

  const sameNameCities = (await prisma.city.findMany({ where: { countryId: country.id, name: CITY_NAME } })) as CityRow[];
  const incompatibleByName = sameNameCities.find((c) => c.slug !== CITY_SLUG);
  if (incompatibleByName) {
    return {
      status: "CONFLICTING_CITY_NAME",
      detail: `City named "${CITY_NAME}" already exists with a different slug "${incompatibleByName.slug}" (id=${incompatibleByName.id})`,
      placeId,
    };
  }

  const existingCity = (await prisma.city.findFirst({
    where: { countryId: country.id, slug: CITY_SLUG },
  })) as CityRow | null;

  if (existingCity) {
    const contractOk =
      existingCity.name === CITY_NAME &&
      existingCity.slug === CITY_SLUG &&
      existingCity.countryId === country.id &&
      existingCity.regionId === null &&
      existingCity.isActive === true &&
      existingCity.isVisibleInCityFilter === true &&
      existingCity.isLegacyNonCity === false &&
      existingCity.hasMetro === false &&
      !existingCity.googlePlaceId &&
      existingCity.lat === null &&
      existingCity.lng === null;

    if (!contractOk) {
      return {
        status: "CONFLICTING_CITY",
        detail: `City ${CITY_SLUG} exists (id=${existingCity.id}) but does not match the expected contract`,
        placeId,
        existingCityId: existingCity.id,
      };
    }

    if (place.cityId === existingCity.id) {
      return { status: "NOOP_READY", detail: "Place already linked to the canonical Ratomka City", placeId, existingCityId: existingCity.id };
    }
    if (place.cityId !== null) {
      return {
        status: "PLACE_ALREADY_LINKED_TO_OTHER_CITY",
        detail: `Place.cityId=${place.cityId}, not NULL and not the canonical Ratomka City`,
        placeId,
        existingCityId: existingCity.id,
      };
    }
    return {
      status: "READY_TO_CREATE_CITY_AND_LINK_PLACE",
      detail: "canonical City already exists, Place.cityId is NULL — apply will link only",
      placeId,
      existingCityId: existingCity.id,
    };
  }

  if (place.cityId !== null) {
    return {
      status: "PLACE_ALREADY_LINKED_TO_OTHER_CITY",
      detail: `Place.cityId=${place.cityId}, not NULL, and no canonical Ratomka City exists to compare against`,
      placeId,
    };
  }

  return { status: "READY_TO_CREATE_CITY_AND_LINK_PLACE", detail: "no conflicting City, Place.cityId is NULL", placeId };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyResult {
  status: "APPLIED" | "NOOP_READY" | "PLACE_CAS_UPDATE_FAILED" | PreflightStatus;
  detail: string;
  cityId?: string;
  placeId?: string;
  cityCreated: boolean;
  placeUpdated: boolean;
}

export async function runApply(prisma: RatomkaRepairPrismaClient): Promise<ApplyResult> {
  const preflight = await runPreflight(prisma);

  if (preflight.status === "NOOP_READY") {
    return { status: "NOOP_READY", detail: preflight.detail, cityId: preflight.existingCityId, placeId: preflight.placeId, cityCreated: false, placeUpdated: false };
  }
  if (preflight.status !== "READY_TO_CREATE_CITY_AND_LINK_PLACE") {
    return { status: preflight.status, detail: preflight.detail, placeId: preflight.placeId, cityCreated: false, placeUpdated: false };
  }

  const placeId = preflight.placeId!;

  return prisma.$transaction(async (tx) => {
    let cityId = preflight.existingCityId;
    let cityCreated = false;

    if (!cityId) {
      const country = await tx.country.findUnique({ where: { slug: COUNTRY_SLUG } });
      if (!country) {
        throw new Error(`Country ${COUNTRY_SLUG} not found inside transaction`);
      }
      const created = await tx.city.create({
        data: {
          countryId: country.id,
          regionId: null,
          name: CITY_NAME,
          slug: CITY_SLUG,
          isActive: true,
          isVisibleInCityFilter: true,
          isLegacyNonCity: false,
          hasMetro: false,
          lat: null,
          lng: null,
          googlePlaceId: null,
        },
      });
      cityId = created.id;
      cityCreated = true;
    }

    // CAS: the WHERE clause (id AND cityId IS NULL) is evaluated atomically
    // by the single UPDATE statement — a concurrent writer that already set
    // Place.cityId between our preflight read and this statement causes
    // count to be 0, which we treat as a hard failure and roll back the
    // whole transaction (including the just-created City), rather than a
    // manual find-then-update that a concurrent transaction could race.
    const updateResult = await tx.place.updateMany({
      where: { id: placeId, cityId: null },
      data: { cityId },
    });
    if (updateResult.count !== 1) {
      throw new Error(`PLACE_CAS_UPDATE_FAILED: expected updateMany count 1, got ${updateResult.count}`);
    }

    return {
      status: "APPLIED" as const,
      detail: `City ${CITY_NAME} (${cityId}) ${cityCreated ? "created" : "reused"}; Place ${placeId}.cityId set`,
      cityId,
      placeId,
      cityCreated,
      placeUpdated: true,
    };
  });
}

// ---------------------------------------------------------------------------
// CLI entrypoint (guarded so importing this file for tests never runs it)
// ---------------------------------------------------------------------------

function parseArgv(argv: string[]): { mode: "plan" | "apply"; remote: Partial<RemoteExecutionArgs> } {
  const mode = argv.includes("--apply") ? "apply" : "plan";
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  return {
    mode,
    remote: {
      environment: get("--environment"),
      database: get("--database"),
      reportPath: get("--report-path"),
      reportSha256: get("--report-sha256"),
      checkpointPath: get("--checkpoint-path"),
      checkpointSha256: get("--checkpoint-sha256"),
    },
  };
}

async function main(): Promise<void> {
  const { mode, remote } = parseArgv(process.argv.slice(2));

  const missing = (["environment", "database", "reportPath", "reportSha256", "checkpointPath", "checkpointSha256"] as const).filter(
    (k) => !remote[k],
  );
  if (missing.length > 0) {
    console.error(`Missing required remote-execution args: ${missing.map((k) => `--${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const guard = await checkRemoteExecutionGuards(remote as RemoteExecutionArgs, realReadFile, realReadFile);
  if (!guard.ok) {
    console.error(`REMOTE_GUARD_FAILED: ${guard.reason} — ${guard.detail}`);
    process.exitCode = 1;
    return;
  }

  const { prisma } = await import("../../src/lib/prisma");
  const client = prisma as unknown as RatomkaRepairPrismaClient;

  if (mode === "plan") {
    const result = await runPreflight(client);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "READY_TO_CREATE_CITY_AND_LINK_PLACE" || result.status === "NOOP_READY" ? 0 : 1;
    return;
  }

  const result = await runApply(client);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "APPLIED" || result.status === "NOOP_READY" ? 0 : 1;
}

const isDirectRun = process.argv[1]?.endsWith("20260804-phoenix-ratomka-place-43635.ts") ?? false;
if (isDirectRun) {
  void main().finally(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.$disconnect();
  });
}
