import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createLiveStateCheckpoint,
  isPrivacyMaskedUserNaturalKey,
  loadAndValidateLiveStateCheckpoint,
  type LiveCheckpointEvidencePins,
  type LiveCheckpointExpected,
} from "./liveCheckpoint";
import { sha256Bytes } from "./manifest";
import { runPhoenixRelease } from "./coordinator";
import type { PhoenixEnvironmentContext, PhoenixPhaseAdapter, PhoenixPhaseName, PhoenixPhaseReport, PhoenixReleaseManifest } from "./types";

const ANCHOR_SHA = "2dc00b6026651c0d1b1008598a19a6833930820f";
const PARTIAL_SHA = "4ff230dfad060c6e0a1f914ab22bee6f658414ac";
const CURRENT_SHA = "a".repeat(40);
const RELEASE = "phoenix-approved-2026-07-30";
const MANIFEST_HASH = "b".repeat(64);
const FIRST_OFFER = "wordpress-db:hb-programs:18932";
const environment: PhoenixEnvironmentContext = {
  environment: "DEV",
  database: { environment: "DEV", host: "db", port: "5432", database: "devmamago", schema: "public", currentDatabase: "devmamago" },
  storage: { environment: "DEV", provider: "none", locationHash: "c".repeat(64) },
};

const keys = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `wordpress-db:${prefix}:${i + 1}`);
const userKeys = keys("user", 563);
const businessKeys = keys("business", 38);
const placeKeys = keys("places", 78);

function phase(name: PhoenixPhaseName, sourceKeys: string[]) {
  return { name, status: "READY" as const, artifacts: [], records: sourceKeys.map((sourceRecordKey) => ({ sourceRecordKey, action: "CREATE" as const })),
    protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [], mediaPolicy: "NONE" as const, prerequisites: [] };
}
const manifest: PhoenixReleaseManifest = {
  schemaVersion: 1, releaseId: RELEASE,
  phaseOrder: ["users", "businesses", "places", "offers", "routes", "events", "articles", "redirects"],
  phases: [phase("users", userKeys), phase("businesses", businessKeys), phase("places", placeKeys), phase("offers", [FIRST_OFFER]),
    phase("routes", ["wordpress-db:routes:1"]), phase("events", ["wordpress-db:events:1"]), phase("articles", ["wordpress-db:articles:1"]),
    { ...phase("redirects", []), status: "VALIDATION_ONLY" }],
};
const expected: LiveCheckpointExpected = { releaseId: RELEASE, manifestHash: MANIFEST_HASH, codeSha: CURRENT_SHA, environment, manifest };

function report(overrides: Partial<PhoenixPhaseReport>): PhoenixPhaseReport {
  return { releaseId: RELEASE, environment: "DEV", codeSha: ANCHOR_SHA, manifestPath: "manifest.json", manifestHash: MANIFEST_HASH,
    phase: "users", attempted: 1, created: 1, updated: 0, skipped: 0, protectedConflicts: 0, failed: 0, targetCountDelta: 0,
    migrationRecordDelta: 0, migrationLineageDelta: 0, duplicateLineage: 0, duplicateTargets: 0, mediaStorageDelta: 0,
    forbiddenTableAudit: "PASS", firstFailure: null, completedPrefix: ["users"], environmentFingerprint: environment, resolvedIdentities: {}, ...overrides };
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "phoenix-checkpoint-test-"));
  const anchorPath = join(dir, "anchor.jsonl");
  const partialPath = join(dir, "partial.jsonl");
  const protectedPath = join(dir, "protected.json");
  const rawPath = join(dir, "raw.json"); const canonicalPath = join(dir, "canonical.json");
  const anchorRaw = [
    report({ phase: "users", codeSha: ANCHOR_SHA }),
    report({ phase: "businesses", codeSha: ANCHOR_SHA, completedPrefix: ["users", "businesses"] }),
    report({ phase: "places", codeSha: ANCHOR_SHA, failed: 1, firstFailure: "wordpress-db:places:5528:FAILED", completedPrefix: ["users", "businesses"], forbiddenTableAudit: "NOT_RUN" }),
  ].map((value) => JSON.stringify(value)).join("\n") + "\n";
  const partialRaw = [
    report({ phase: "users", codeSha: PARTIAL_SHA }),
    report({ phase: "businesses", codeSha: PARTIAL_SHA, completedPrefix: ["users", "businesses"] }),
  ].map((value) => JSON.stringify(value)).join("\n") + "\n";
  const rawSnapshot = "raw"; const canonicalSnapshot = "canonical";
  const protectedRaw = JSON.stringify({ releaseId: RELEASE, sourceKey: "wordpress-db:places:43023",
    normalizedIdentity: { normalizedTitle: "атмосфера", slug: "atmosfera" }, sourceProvenance: { sourceCodeSha: PARTIAL_SHA },
    files: { rawCapture: { path: "raw.json", size: rawSnapshot.length, sha256: sha256Bytes(rawSnapshot) },
      canonicalTarget: { path: "canonical.json", size: canonicalSnapshot.length, sha256: sha256Bytes(canonicalSnapshot) } } });
  writeFileSync(anchorPath, anchorRaw); writeFileSync(partialPath, partialRaw); writeFileSync(protectedPath, protectedRaw);
  writeFileSync(rawPath, rawSnapshot); writeFileSync(canonicalPath, canonicalSnapshot);
  const request = { anchorReportPath: anchorPath, anchorReportSha256: sha256Bytes(anchorRaw), anchorReportCodeSha: ANCHOR_SHA,
    partialReportPath: partialPath, partialReportSha256: sha256Bytes(partialRaw), partialReportCodeSha: PARTIAL_SHA,
    protectedManifestPath: protectedPath, protectedManifestSha256: sha256Bytes(protectedRaw) };
  const evidencePins: LiveCheckpointEvidencePins = { anchorReportSha256: request.anchorReportSha256, anchorReportCodeSha: ANCHOR_SHA,
    partialReportSha256: request.partialReportSha256, partialReportCodeSha: PARTIAL_SHA, protectedManifestSha256: request.protectedManifestSha256 };
  return { dir, request, evidencePins };
}

type Lineage = { sourceRecordKey: string; targetType: string; targetId: string; targetRole: string; targetNaturalKey: string; lastSourceHash: string; lastPlanAction: string; isActive: boolean };
type LineageOverride = Partial<Pick<Lineage, "targetId" | "targetRole" | "targetNaturalKey" | "lastPlanAction" | "isActive">>;
type OverrideFn = (sourceRecordKey: string, index: number) => LineageOverride | undefined;

function fakePrisma(options: {
  missingPlace?: boolean; offerStarted?: boolean; targetMismatch?: boolean; lineageMismatch?: boolean; ambiguousTarget?: boolean;
  userOverrides?: OverrideFn; businessOverrides?: OverrideFn; placeOverrides?: OverrideFn;
} = {}) {
  const make = (sourceRecordKey: string, targetType: string, override?: LineageOverride): Lineage => ({ sourceRecordKey, targetType, targetId: `${targetType}-${sourceRecordKey}`,
    targetRole: "primary", targetNaturalKey: `${targetType.toLowerCase()}:${sourceRecordKey}`, lastSourceHash: "hash", lastPlanAction: "CREATE", isActive: true, ...override });
  const lineages: Lineage[] = [
    ...userKeys.map((key, i) => make(key, "USER", options.userOverrides?.(key, i))),
    ...businessKeys.map((key, i) => make(key, "BUSINESS", options.businessOverrides?.(key, i))),
    ...placeKeys.filter((_, index) => !(options.missingPlace && index === 0)).map((key, i) => make(key, "PLACE", options.placeOverrides?.(key, i))),
    { sourceRecordKey: "wordpress-db:places:43023", targetType: "PLACE", targetId: "atmosfera-id", targetRole: "primary",
      targetNaturalKey: options.lineageMismatch ? "slug:wrong" : "slug:atmosfera", lastSourceHash: "protected-adoption:places-preview-2026-07-30", lastPlanAction: "LINK_EXISTING", isActive: true },
  ];
  if (options.offerStarted) lineages.push(make(FIRST_OFFER, "OFFER"));
  const protectedPlace = { id: "atmosfera-id", title: options.targetMismatch ? "Wrong" : "Атмосфера", slug: "atmosfera", status: "PUBLISHED",
    city: { slug: "minsk", isActive: true }, createdByUserId: "USER-wordpress-db:user:525", ownerBusinessId: "business-id" };
  const prisma = {
    migrationSource: { findUnique: async () => ({ id: "source-id" }) },
    migrationLineage: { findMany: async () => lineages, count: async () => 681 },
    place: { findMany: async () => options.ambiguousTarget ? [protectedPlace, { ...protectedPlace, id: "other" }] : [protectedPlace], count: async () => 80 },
    city: { findMany: async () => [{ id: "city-1", name: "Копище" }, { id: "city-2", name: "Мир" }], count: async () => 4 },
    business: { findUnique: async () => ({ id: "business-id", ownerUserId: "USER-wordpress-db:user:525" }), count: async () => 38 },
    user: { count: async () => 563 }, offer: { count: async () => 0 }, route: { count: async () => 0 }, routeStop: { count: async () => 0 },
    activity: { count: async () => 0 }, article: { count: async () => 0 }, migrationRecord: { count: async () => 564 },
    migrationRun: { count: async () => 564 }, migrationMediaAsset: { count: async () => 0 }, mediaAsset: { count: async () => 1 },
    session: { count: async () => 4 }, userActionToken: { count: async () => 0 },
  };
  return prisma as never;
}

async function create(options: Parameters<typeof fakePrisma>[0] = {}) {
  const f = fixture(); const outputPath = join(f.dir, "checkpoint.json");
  const checkpoint = await createLiveStateCheckpoint({ prisma: fakePrisma(options), request: f.request, expected, outputPath, evidencePins: f.evidencePins, now: () => new Date("2026-08-03T20:00:00.000Z") });
  return { ...f, outputPath, checkpoint };
}

function testMaskGuardPredicate() {
  const row = (overrides: Partial<Parameters<typeof isPrivacyMaskedUserNaturalKey>[0]>) =>
    ({ targetType: "USER", targetRole: "primary", lastPlanAction: "CREATE", targetNaturalKey: "a***@gmail.com", ...overrides });

  // Exact-shape PASS cases: exactly one non-@/whitespace char, then `***@`, then a non-empty domain.
  for (const key of ["a***@example.com", "Я***@example.by", "1***@domain.test"]) {
    assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetNaturalKey: key })), true, `${key} is the exact maskEmail shape and is exempt`);
  }

  // FAIL cases: anything off the exact maskEmail shape stays identity-bearing.
  for (const key of [
    "***@example.com", // empty local part — real maskEmail(email) never empty-slices on a valid email
    "ab***@example.com", // two leading chars
    " ***@example.com", // leading char is whitespace (a single space), not a real local-part character
    "пробел***@example.com", // multi-char leading run (not exactly one character)
    "@***@example.com", // leading char is itself "@"
    "a***@", // empty domain
    "a***@example @com", // domain contains whitespace and an embedded "@"
    "platform-owner-runtime-identity", // not mask-shaped at all
  ]) {
    assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetNaturalKey: key })), false, `${JSON.stringify(key)} must not be exempt`);
  }

  assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetType: "BUSINESS" })), false, "non-USER rows are never exempt");
  assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetType: "PLACE" })), false, "non-USER rows are never exempt");
  assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetRole: "secondary" })), false, "wrong role is not exempt even with a valid mask");
  assert.equal(isPrivacyMaskedUserNaturalKey(row({ lastPlanAction: "LINK_EXISTING" })), false, "wrong plan action is not exempt even with a valid mask");
  assert.equal(isPrivacyMaskedUserNaturalKey(row({ lastPlanAction: "UPDATE" })), false, "wrong plan action is not exempt even with a valid mask");
  assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetNaturalKey: "a**@gmail.com" })), false, "malformed mask-like key (wrong asterisk count) is not exempt");
  assert.equal(isPrivacyMaskedUserNaturalKey(row({ targetNaturalKey: null })), false, "null natural key is never exempt");
  console.log("isPrivacyMaskedUserNaturalKey unit checks: OK");
}

// Mirrors the independently-audited DEV shape (75 duplicate masked-natural-key
// groups covering 462 of the 563 USER rows) confirmed via the read-only
// live-lineage audit against devmamago on 2026-08-03.
const DEV_SHAPE_GROUP_SIZES = [
  ...Array(21).fill(2), ...Array(13).fill(3), ...Array(7).fill(4), ...Array(7).fill(5), ...Array(4).fill(6),
  ...Array(2).fill(7), ...Array(2).fill(8), ...Array(1).fill(9), ...Array(4).fill(10), ...Array(1).fill(11),
  ...Array(2).fill(12), ...Array(3).fill(13), ...Array(2).fill(14), ...Array(2).fill(15), ...Array(1).fill(18),
  ...Array(1).fill(21), ...Array(2).fill(22),
];
assert.equal(DEV_SHAPE_GROUP_SIZES.length, 75, "DEV-shaped fixture must model exactly 75 groups");
assert.equal(DEV_SHAPE_GROUP_SIZES.reduce((a, b) => a + b, 0), 462, "DEV-shaped fixture must model exactly 462 rows");

function devShapedUserOverrides(): OverrideFn {
  const maskByIndex = new Map<number, string>();
  let cursor = 0;
  DEV_SHAPE_GROUP_SIZES.forEach((size, groupIndex) => {
    const mask = `u***@g${groupIndex}.test`;
    for (let i = 0; i < size; i += 1) { maskByIndex.set(cursor, mask); cursor += 1; }
  });
  return (_key, index) => (maskByIndex.has(index) ? { targetNaturalKey: maskByIndex.get(index) } : undefined);
}

async function main() {
  testMaskGuardPredicate();

  const first = await create();
  assert.equal(first.checkpoint.type, "PHOENIX_LIVE_STATE_CHECKPOINT");
  assert.deepEqual(first.checkpoint.completedCounts, { users: 563, businesses: 38, places: 78 });
  assert.equal(first.checkpoint.firstExecutableSourceKey, FIRST_OFFER);
  assert.equal(first.checkpoint.nextPhase, "offers");
  assert.equal(first.checkpoint.laterPhasesUntouched, true);
  assert.equal(first.checkpoint.databaseWriterRan, false);
  assert.equal((fakePrisma() as Record<string, unknown>).migrationRun !== undefined, true, "read client exposes count only, no mutation delegate is used");
  for (const model of Object.values(fakePrisma() as Record<string, Record<string, unknown>>)) {
    for (const mutation of ["create", "update", "delete", "upsert", "createMany", "updateMany", "deleteMany"]) {
      assert.equal(mutation in model, false, `read client must not expose ${mutation}`);
    }
  }

  // Different USER targetIds sharing one valid maskEmail-format key pass.
  const maskedDistinct = await create({ userOverrides: (_key, i) => (i < 3 ? { targetNaturalKey: "a***@gmail.com" } : undefined) });
  assert.deepEqual(maskedDistinct.checkpoint.completedCounts, { users: 563, businesses: 38, places: 78 });

  // Duplicate USER targetId is still blocked, unaffected by the masked-key exemption.
  await assert.rejects(
    () => create({ userOverrides: (_key, i) => (i < 2 ? { targetId: "SHARED-USER-TARGET" } : undefined) }),
    /DUPLICATE_TARGET_ID/,
  );

  // platform-owner-runtime-identity duplicated across two USER rows stays identity-bearing and blocks,
  // even when both rows otherwise look like a fresh CREATE.
  await assert.rejects(
    () => create({ userOverrides: (_key, i) => (i < 2 ? { targetNaturalKey: "platform-owner-runtime-identity" } : undefined) }),
    /DUPLICATE_NATURAL_KEY/,
  );

  // A malformed mask-like USER key (extra leading char) is not exempt and still blocks on duplication.
  await assert.rejects(
    () => create({ userOverrides: (_key, i) => (i < 2 ? { targetNaturalKey: "ab***@gmail.com" } : undefined) }),
    /DUPLICATE_NATURAL_KEY/,
  );

  // A valid mask format with the wrong targetRole is not exempt.
  await assert.rejects(
    () => create({ userOverrides: (_key, i) => (i < 2 ? { targetNaturalKey: "a***@gmail.com", targetRole: "secondary" } : undefined) }),
    /DUPLICATE_NATURAL_KEY/,
  );

  // A valid mask format with the wrong lastPlanAction (e.g. a LINK_EXISTING reactivation) is not exempt.
  await assert.rejects(
    () => create({ userOverrides: (_key, i) => (i < 2 ? { targetNaturalKey: "a***@gmail.com", lastPlanAction: "LINK_EXISTING" } : undefined) }),
    /DUPLICATE_NATURAL_KEY/,
  );

  // BUSINESS natural-key duplicates keep failing closed — the exemption is USER-only.
  await assert.rejects(
    () => create({ businessOverrides: (_key, i) => (i < 2 ? { targetNaturalKey: "shared-business-slug" } : undefined) }),
    /DUPLICATE_NATURAL_KEY/,
  );

  // PLACE natural-key duplicates keep failing closed — the exemption is USER-only.
  await assert.rejects(
    () => create({ placeOverrides: (_key, i) => (i < 2 ? { targetNaturalKey: "shared-place-slug" } : undefined) }),
    /DUPLICATE_NATURAL_KEY/,
  );

  // The independently-audited DEV shape (75 masked-key groups / 462 rows) passes end to end,
  // and completed counts (563 Users, 38 Businesses, 78 ordinary Places + 1 protected adoption) are unchanged.
  const devShaped = await create({ userOverrides: devShapedUserOverrides() });
  assert.deepEqual(devShaped.checkpoint.completedCounts, { users: 563, businesses: 38, places: 78 });
  assert.equal(devShaped.checkpoint.protectedAdoption.sourceRecordKey, "wordpress-db:places:43023");
  assert.equal(devShaped.checkpoint.nextPhase, "offers");
  assert.equal(devShaped.checkpoint.firstExecutableSourceKey, FIRST_OFFER);
  assert.equal(devShaped.checkpoint.laterPhasesUntouched, true);
  await assert.rejects(() => createLiveStateCheckpoint({ prisma: fakePrisma(), request: first.request, expected, outputPath: first.outputPath, evidencePins: first.evidencePins }), /OUTPUT_EXISTS/);

  const secondPath = join(first.dir, "checkpoint-2.json");
  await createLiveStateCheckpoint({ prisma: fakePrisma(), request: first.request, expected, outputPath: secondPath, evidencePins: first.evidencePins, now: () => new Date("2026-08-03T20:00:00.000Z") });
  assert.equal(readFileSync(first.outputPath, "utf8"), readFileSync(secondPath, "utf8"), "fixed timestamp and evidence produce deterministic bytes");
  const raw = readFileSync(first.outputPath, "utf8");
  const valid = await loadAndValidateLiveStateCheckpoint({ prisma: fakePrisma(), checkpointPath: first.outputPath, checkpointSha256: sha256Bytes(raw), checkpointCodeSha: CURRENT_SHA, expected });
  assert.equal(valid.startPhase, "offers"); assert.equal(valid.phaseSkipSets.get("places")?.size, 78);
  await assert.rejects(() => loadAndValidateLiveStateCheckpoint({ prisma: fakePrisma(), checkpointPath: first.outputPath, checkpointSha256: "0".repeat(64), checkpointCodeSha: CURRENT_SHA, expected }), /HASH_MISMATCH/);
  await assert.rejects(() => loadAndValidateLiveStateCheckpoint({ prisma: fakePrisma(), checkpointPath: first.outputPath, checkpointSha256: sha256Bytes(raw), checkpointCodeSha: "d".repeat(40), expected }), /CODE_SHA_MISMATCH/);
  await assert.rejects(() => create({ missingPlace: true }), /COMPLETED_SOURCE_SET_MISMATCH_PLACES/);
  await assert.rejects(() => create({ offerStarted: true }), /LATER_PHASE_STARTED/);
  await assert.rejects(() => create({ targetMismatch: true }), /PROTECTED_TARGET_MISMATCH/);
  await assert.rejects(() => create({ lineageMismatch: true }), /PROTECTED_LINEAGE_MISMATCH/);
  await assert.rejects(() => create({ ambiguousTarget: true }), /PROTECTED_TARGET_AMBIGUOUS/);

  const invoked: string[] = [];
  const adapter = (name: string): PhoenixPhaseAdapter => ({ plan: async () => [], apply: async () => { invoked.push(name); return []; }, rerun: async () => [], reconcile: async () => ({}) });
  const adapters = Object.fromEntries(["users", "businesses", "places", "offers", "routes", "events", "articles"].map((name) => [name, adapter(name)]));
  await runPhoenixRelease({ manifest, manifestPath: "manifest.json", manifestHash: MANIFEST_HASH, environment, mode: "APPLY", codeSha: CURRENT_SHA,
    adapters, reportStore: { append: async () => {} }, liveCheckpointStartPhase: "offers" });
  assert.equal(invoked[0], "offers"); assert.equal(invoked.includes("places"), false); assert.equal(invoked.includes("users"), false);
}

main().then(() => console.log("liveCheckpoint tests: OK"));
