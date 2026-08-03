import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";

import { assertPhoenixPlaceCityPrerequisites, PHOENIX_RELEASE_SOURCE_NAMESPACE } from "./continuation";
import { exactExecutableKeys, sha256Bytes } from "./manifest";
import type { PhoenixEnvironmentContext, PhoenixPhaseName, PhoenixPhaseReport, PhoenixReleaseManifest } from "./types";

const CHECKPOINT_TYPE = "PHOENIX_LIVE_STATE_CHECKPOINT" as const;
const CHECKPOINT_SCHEMA_VERSION = 1 as const;
const PROTECTED_SOURCE_KEY = "wordpress-db:places:43023";
const PROTECTED_HASH = "protected-adoption:places-preview-2026-07-30";
const FIRST_OFFER_KEY = "wordpress-db:hb-programs:18932";
const COMPLETED_PHASES = ["users", "businesses", "places"] as const;
const EXPECTED_COUNTS = { users: 563, businesses: 38, places: 78 } as const;
export interface LiveCheckpointEvidencePins {
  anchorReportSha256: string; anchorReportCodeSha: string;
  partialReportSha256: string; partialReportCodeSha: string;
  protectedManifestSha256: string;
}
const RECOVERY_EVIDENCE_PINS: LiveCheckpointEvidencePins = {
  anchorReportSha256: "257671d8dd039d803d5571cdcd0d00a8ddbdeaf4fba55c1a21b4f35850a9cfcc",
  anchorReportCodeSha: "2dc00b6026651c0d1b1008598a19a6833930820f",
  partialReportSha256: "c5c6b0f069f0b8f08d4a3b972539f2952e2a5fc1d6fd4c77f63c75c05ef449f8",
  partialReportCodeSha: "4ff230dfad060c6e0a1f914ab22bee6f658414ac",
  protectedManifestSha256: "d303caa1e0c2e9ed5bd08023618aa412cf52e6f90540d32c94cbc1b7899a8821",
};

function blocked(code: string): Error {
  return new Error(`RELEASE_BLOCKED:LIVE_CHECKPOINT_${code}`);
}

function digest(values: readonly string[]): string {
  return createHash("sha256").update([...values].sort().join("\n")).digest("hex");
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export interface LiveCheckpointEvidenceRequest {
  anchorReportPath: string;
  anchorReportSha256: string;
  anchorReportCodeSha: string;
  partialReportPath: string;
  partialReportSha256: string;
  partialReportCodeSha: string;
  protectedManifestPath: string;
  protectedManifestSha256: string;
}

export interface LiveCheckpointExpected {
  releaseId: string;
  manifestHash: string;
  codeSha: string;
  environment: PhoenixEnvironmentContext;
  manifest: PhoenixReleaseManifest;
}

type ReadDelegate = Pick<PrismaClient["migrationLineage"], "findMany" | "count">;
export interface PhoenixLiveCheckpointReadClient {
  migrationSource: { findUnique: PrismaClient["migrationSource"]["findUnique"] };
  migrationLineage: ReadDelegate;
  place: { findMany: PrismaClient["place"]["findMany"]; count: PrismaClient["place"]["count"] };
  city: { findMany: PrismaClient["city"]["findMany"]; count: PrismaClient["city"]["count"] };
  business: { findUnique: PrismaClient["business"]["findUnique"]; count: PrismaClient["business"]["count"] };
  user: { count: PrismaClient["user"]["count"] };
  offer: { count: PrismaClient["offer"]["count"] };
  route: { count: PrismaClient["route"]["count"] };
  routeStop: { count: PrismaClient["routeStop"]["count"] };
  activity: { count: PrismaClient["activity"]["count"] };
  article: { count: PrismaClient["article"]["count"] };
  migrationRecord: { count: PrismaClient["migrationRecord"]["count"] };
  migrationRun: { count: PrismaClient["migrationRun"]["count"] };
  migrationMediaAsset: { count: PrismaClient["migrationMediaAsset"]["count"] };
  mediaAsset: { count: PrismaClient["mediaAsset"]["count"] };
  session: { count: PrismaClient["session"]["count"] };
  userActionToken: { count: PrismaClient["userActionToken"]["count"] };
}

interface EvidenceIdentity {
  path: string;
  sha256: string;
  codeSha: string;
}

export interface PhoenixLiveStateCheckpoint {
  type: typeof CHECKPOINT_TYPE;
  schemaVersion: typeof CHECKPOINT_SCHEMA_VERSION;
  releaseId: string;
  manifestHash: string;
  environmentFingerprint: PhoenixEnvironmentContext;
  generatingCodeSha: string;
  createdAt: string;
  evidence: {
    anchorReport: EvidenceIdentity;
    partialReport: EvidenceIdentity;
    protectedManifest: { path: string; sha256: string };
  };
  completedSourceKeyDigests: Record<(typeof COMPLETED_PHASES)[number], string>;
  completedCounts: Record<(typeof COMPLETED_PHASES)[number], number>;
  protectedAdoption: {
    sourceRecordKey: typeof PROTECTED_SOURCE_KEY;
    action: "LINK_EXISTING";
    naturalKey: "slug:atmosfera";
    targetId: string;
    targetSlug: "atmosfera";
    normalizedTitle: "атмосфера";
    citySlug: "minsk";
    ownerBusinessId: string;
    ownerUserId: string;
  };
  nextPhase: "offers";
  firstExecutableSourceKey: typeof FIRST_OFFER_KEY;
  liveLineageDigest: string;
  protectedTargetStateDigest: string;
  auditCounts: Record<string, number>;
  laterPhasesUntouched: true;
  databaseWriterRan: false;
}

function parseReports(path: string, expectedSha: string, expectedCodeSha: string): PhoenixPhaseReport[] {
  let raw: string;
  try { raw = readFileSync(path, "utf8"); } catch { throw blocked("EVIDENCE_REPORT_UNREADABLE"); }
  if (sha256Bytes(raw) !== expectedSha.trim().toLowerCase()) throw blocked("EVIDENCE_REPORT_HASH_MISMATCH");
  let reports: PhoenixPhaseReport[];
  try { reports = raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as PhoenixPhaseReport); }
  catch { throw blocked("EVIDENCE_REPORT_MALFORMED"); }
  if (!reports.length || reports.some((report) => report.codeSha !== expectedCodeSha)) throw blocked("EVIDENCE_REPORT_CODE_SHA_MISMATCH");
  return reports;
}

function validateEvidence(request: LiveCheckpointEvidenceRequest, expected: LiveCheckpointExpected, pins: LiveCheckpointEvidencePins): void {
  if (request.anchorReportSha256 !== pins.anchorReportSha256 || request.anchorReportCodeSha !== pins.anchorReportCodeSha ||
      request.partialReportSha256 !== pins.partialReportSha256 || request.partialReportCodeSha !== pins.partialReportCodeSha ||
      request.protectedManifestSha256 !== pins.protectedManifestSha256) throw blocked("EVIDENCE_IDENTITY_NOT_AUTHORIZED");
  const codePattern = /^[0-9a-f]{40}$/;
  if (!codePattern.test(request.anchorReportCodeSha) || !codePattern.test(request.partialReportCodeSha)) throw blocked("EVIDENCE_CODE_SHA_INVALID");
  const anchor = parseReports(request.anchorReportPath, request.anchorReportSha256, request.anchorReportCodeSha);
  const partial = parseReports(request.partialReportPath, request.partialReportSha256, request.partialReportCodeSha);
  const validateIdentity = (report: PhoenixPhaseReport) => {
    if (report.releaseId !== expected.releaseId) throw blocked("RELEASE_ID_MISMATCH");
    if (report.manifestHash !== expected.manifestHash) throw blocked("MANIFEST_HASH_MISMATCH");
    if (JSON.stringify(report.environmentFingerprint) !== JSON.stringify(expected.environment)) throw blocked("ENVIRONMENT_MISMATCH");
    if (report.forbiddenTableAudit !== "PASS" || report.mediaStorageDelta !== 0 || report.duplicateLineage !== 0 || report.duplicateTargets !== 0) {
      throw blocked("EVIDENCE_AUDIT_MISMATCH");
    }
  };
  [...anchor, ...partial].forEach(validateIdentity);
  const anchorTerminal = anchor.at(-1)!;
  if (anchorTerminal.phase !== "places" || anchorTerminal.failed !== 1 || !anchorTerminal.firstFailure?.startsWith("wordpress-db:places:5528:")) {
    throw blocked("ANCHOR_REPORT_CONTRACT_MISMATCH");
  }
  if (partial.length !== 2 || partial[0].phase !== "users" || partial[1].phase !== "businesses" || partial.some((r) => r.failed !== 0)) {
    throw blocked("PARTIAL_REPORT_CONTRACT_MISMATCH");
  }
  let supplementalRaw: string;
  try { supplementalRaw = readFileSync(request.protectedManifestPath, "utf8"); } catch { throw blocked("PROTECTED_MANIFEST_UNREADABLE"); }
  if (sha256Bytes(supplementalRaw) !== request.protectedManifestSha256.trim().toLowerCase()) throw blocked("PROTECTED_MANIFEST_HASH_MISMATCH");
  let supplemental: {
    releaseId?: string;
    sourceKey?: string;
    normalizedIdentity?: { normalizedTitle?: string; slug?: string };
    sourceProvenance?: { sourceCodeSha?: string };
    files?: { rawCapture?: { path?: string; size?: number; sha256?: string }; canonicalTarget?: { path?: string; size?: number; sha256?: string } };
  };
  try { supplemental = JSON.parse(supplementalRaw) as typeof supplemental; } catch { throw blocked("PROTECTED_MANIFEST_MALFORMED"); }
  if (supplemental.releaseId !== expected.releaseId || supplemental.sourceKey !== PROTECTED_SOURCE_KEY ||
      supplemental.normalizedIdentity?.normalizedTitle !== "атмосфера" || supplemental.normalizedIdentity?.slug !== "atmosfera" ||
      supplemental.sourceProvenance?.sourceCodeSha !== request.partialReportCodeSha) {
    throw blocked("PROTECTED_MANIFEST_IDENTITY_MISMATCH");
  }
  for (const entry of [supplemental.files?.rawCapture, supplemental.files?.canonicalTarget]) {
    if (!entry?.path || typeof entry.size !== "number" || !entry.sha256) throw blocked("PROTECTED_MANIFEST_FILE_IDENTITY_MISSING");
    let bytes: Buffer;
    try { bytes = readFileSync(resolve(dirname(request.protectedManifestPath), entry.path)); } catch { throw blocked("PROTECTED_SNAPSHOT_FILE_UNREADABLE"); }
    if (bytes.byteLength !== entry.size || sha256Bytes(bytes) !== entry.sha256) throw blocked("PROTECTED_SNAPSHOT_FILE_HASH_MISMATCH");
  }
}

interface LiveProof {
  keys: Record<(typeof COMPLETED_PHASES)[number], string[]>;
  protectedAdoption: PhoenixLiveStateCheckpoint["protectedAdoption"];
  liveLineageDigest: string;
  protectedTargetStateDigest: string;
  auditCounts: Record<string, number>;
}

async function proveLiveState(prisma: PhoenixLiveCheckpointReadClient, expected: LiveCheckpointExpected): Promise<LiveProof> {
  const source = await prisma.migrationSource.findUnique({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: PHOENIX_RELEASE_SOURCE_NAMESPACE } },
    select: { id: true },
  });
  if (!source) throw blocked("SOURCE_MISSING");
  const allLineages = await prisma.migrationLineage.findMany({
    where: { sourceId: source.id },
    select: { sourceRecordKey: true, targetType: true, targetId: true, targetRole: true, targetNaturalKey: true, lastSourceHash: true, lastPlanAction: true, isActive: true },
  }) as Array<{ sourceRecordKey: string; targetType: string; targetId: string | null; targetRole: string; targetNaturalKey: string | null; lastSourceHash: string | null; lastPlanAction: string | null; isActive: boolean }>;
  const lineages = allLineages.filter((row) => row.isActive);

  const phaseType: Record<(typeof COMPLETED_PHASES)[number], string> = { users: "USER", businesses: "BUSINESS", places: "PLACE" };
  const keys = {} as LiveProof["keys"];
  for (const phaseName of COMPLETED_PHASES) {
    const phase = expected.manifest.phases.find((item) => item.name === phaseName);
    if (!phase) throw blocked(`PHASE_MISSING_${phaseName.toUpperCase()}`);
    const approved = [...exactExecutableKeys(phase)].sort();
    if (approved.length !== EXPECTED_COUNTS[phaseName]) throw blocked(`APPROVED_COUNT_MISMATCH_${phaseName.toUpperCase()}`);
    const live = lineages.filter((row) => row.targetType === phaseType[phaseName] && row.sourceRecordKey !== PROTECTED_SOURCE_KEY).map((row) => row.sourceRecordKey).sort();
    if (new Set(live).size !== live.length) throw blocked("DUPLICATE_LINEAGE_KEY");
    if (JSON.stringify(live) !== JSON.stringify(approved)) throw blocked(`COMPLETED_SOURCE_SET_MISMATCH_${phaseName.toUpperCase()}`);
    keys[phaseName] = live;
  }
  const laterTypes = new Set(["OFFER", "ROUTE", "ACTIVITY", "ARTICLE"]);
  if (lineages.some((row) => laterTypes.has(row.targetType))) throw blocked("LATER_PHASE_STARTED");
  const allowedTypes = new Set(["USER", "BUSINESS", "PLACE", ...laterTypes]);
  if (lineages.some((row) => !allowedTypes.has(row.targetType))) throw blocked("UNEXPECTED_SCOPE");

  const natural = lineages.filter((row) => row.targetNaturalKey).map((row) => `${row.targetType}:${row.targetNaturalKey}`);
  if (new Set(natural).size !== natural.length) throw blocked("DUPLICATE_NATURAL_KEY");
  const targets = lineages.filter((row) => row.targetId).map((row) => `${row.targetType}:${row.targetId}`);
  if (new Set(targets).size !== targets.length) throw blocked("DUPLICATE_TARGET_ID");

  const protectedLines = allLineages.filter((row) => row.sourceRecordKey === PROTECTED_SOURCE_KEY && row.targetType === "PLACE");
  if (protectedLines.length !== 1 || !protectedLines[0].isActive) throw blocked("PROTECTED_LINEAGE_COUNT_MISMATCH");
  const protectedLine = protectedLines[0];
  if (protectedLine.targetRole !== "primary" || protectedLine.targetNaturalKey !== "slug:atmosfera" ||
      protectedLine.lastSourceHash !== PROTECTED_HASH || protectedLine.lastPlanAction !== "LINK_EXISTING" || !protectedLine.targetId) {
    throw blocked("PROTECTED_LINEAGE_MISMATCH");
  }
  const places = await prisma.place.findMany({
    where: { OR: [{ id: protectedLine.targetId }, { slug: "atmosfera" }, { title: { equals: "Атмосфера", mode: "insensitive" } }] },
    select: { id: true, title: true, slug: true, status: true, city: { select: { slug: true, isActive: true } }, createdByUserId: true, ownerBusinessId: true },
  }) as Array<{ id: string; title: string; slug: string | null; status: string; city: { slug: string | null; isActive: boolean } | null; createdByUserId: string; ownerBusinessId: string | null }>;
  if (places.length !== 1 || places[0].id !== protectedLine.targetId) throw blocked("PROTECTED_TARGET_AMBIGUOUS");
  const place = places[0];
  if (place.slug !== "atmosfera" || place.title.trim().toLocaleLowerCase("ru") !== "атмосфера" || place.status !== "PUBLISHED" ||
      place.city?.slug !== "minsk" || !place.city.isActive || !place.ownerBusinessId) throw blocked("PROTECTED_TARGET_MISMATCH");
  const ownerLine = lineages.filter((row) => row.sourceRecordKey === "wordpress-db:user:525" && row.targetType === "USER" && row.targetRole === "primary");
  if (ownerLine.length !== 1 || ownerLine[0].targetId !== place.createdByUserId) throw blocked("PROTECTED_OWNER_LINEAGE_MISMATCH");
  const business = await prisma.business.findUnique({ where: { id: place.ownerBusinessId }, select: { id: true, ownerUserId: true } });
  if (!business || business.ownerUserId !== place.createdByUserId) throw blocked("PROTECTED_BUSINESS_MISMATCH");
  await assertPhoenixPlaceCityPrerequisites(prisma);

  const offersPhase = expected.manifest.phases.find((phase) => phase.name === "offers");
  if (!offersPhase || exactExecutableKeys(offersPhase)[0] !== FIRST_OFFER_KEY) throw blocked("FIRST_OFFER_MISMATCH");

  const auditCounts = {
    user: await prisma.user.count(), business: await prisma.business.count(), place: await prisma.place.count(), city: await prisma.city.count(),
    offer: await prisma.offer.count(), route: await prisma.route.count(), routeStop: await prisma.routeStop.count(), activity: await prisma.activity.count(), article: await prisma.article.count(),
    migrationLineage: await prisma.migrationLineage.count(), migrationRecord: await prisma.migrationRecord.count(), migrationRun: await prisma.migrationRun.count(),
    migrationMediaAsset: await prisma.migrationMediaAsset.count(), mediaAsset: await prisma.mediaAsset.count(), session: await prisma.session.count(), userActionToken: await prisma.userActionToken.count(),
  };
  const protectedAdoption: LiveProof["protectedAdoption"] = {
    sourceRecordKey: PROTECTED_SOURCE_KEY, action: "LINK_EXISTING", naturalKey: "slug:atmosfera", targetId: place.id,
    targetSlug: "atmosfera", normalizedTitle: "атмосфера", citySlug: "minsk", ownerBusinessId: business.id, ownerUserId: place.createdByUserId,
  };
  return {
    keys,
    protectedAdoption,
    liveLineageDigest: digest(lineages.map((row) => [row.sourceRecordKey, row.targetType, row.targetId ?? "", row.targetRole, row.targetNaturalKey ?? "", row.lastSourceHash ?? "", row.lastPlanAction ?? ""].join("|"))),
    protectedTargetStateDigest: digest([JSON.stringify(protectedAdoption)]),
    auditCounts,
  };
}

export async function createLiveStateCheckpoint(input: {
  prisma: PhoenixLiveCheckpointReadClient;
  request: LiveCheckpointEvidenceRequest;
  expected: LiveCheckpointExpected;
  outputPath: string;
  now?: () => Date;
  evidencePins?: LiveCheckpointEvidencePins;
}): Promise<PhoenixLiveStateCheckpoint> {
  if (existsSync(input.outputPath)) throw blocked("OUTPUT_EXISTS");
  validateEvidence(input.request, input.expected, input.evidencePins ?? RECOVERY_EVIDENCE_PINS);
  const proof = await proveLiveState(input.prisma, input.expected);
  const checkpoint: PhoenixLiveStateCheckpoint = {
    type: CHECKPOINT_TYPE, schemaVersion: CHECKPOINT_SCHEMA_VERSION, releaseId: input.expected.releaseId,
    manifestHash: input.expected.manifestHash, environmentFingerprint: input.expected.environment,
    generatingCodeSha: input.expected.codeSha, createdAt: (input.now ?? (() => new Date()))().toISOString(),
    evidence: {
      anchorReport: { path: input.request.anchorReportPath, sha256: input.request.anchorReportSha256, codeSha: input.request.anchorReportCodeSha },
      partialReport: { path: input.request.partialReportPath, sha256: input.request.partialReportSha256, codeSha: input.request.partialReportCodeSha },
      protectedManifest: { path: input.request.protectedManifestPath, sha256: input.request.protectedManifestSha256 },
    },
    completedSourceKeyDigests: { users: digest(proof.keys.users), businesses: digest(proof.keys.businesses), places: digest(proof.keys.places) },
    completedCounts: { users: proof.keys.users.length, businesses: proof.keys.businesses.length, places: proof.keys.places.length },
    protectedAdoption: proof.protectedAdoption, nextPhase: "offers", firstExecutableSourceKey: FIRST_OFFER_KEY,
    liveLineageDigest: proof.liveLineageDigest, protectedTargetStateDigest: proof.protectedTargetStateDigest,
    auditCounts: proof.auditCounts, laterPhasesUntouched: true, databaseWriterRan: false,
  };
  const tempPath = `${input.outputPath}.tmp-${process.pid}`;
  let fd: number | undefined;
  try {
    fd = openSync(tempPath, "wx", 0o600);
    writeFileSync(fd, stableJson(checkpoint), "utf8");
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    if (existsSync(input.outputPath)) throw blocked("OUTPUT_EXISTS");
    renameSync(tempPath, input.outputPath);
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(tempPath); } catch { /* no temp file */ }
    throw error;
  }
  return checkpoint;
}

export interface LiveCheckpointContinuation {
  checkpoint: PhoenixLiveStateCheckpoint;
  phaseSkipSets: ReadonlyMap<PhoenixPhaseName, ReadonlySet<string>>;
  startPhase: "offers";
}

export async function loadAndValidateLiveStateCheckpoint(input: {
  prisma: PhoenixLiveCheckpointReadClient;
  checkpointPath: string;
  checkpointSha256: string;
  checkpointCodeSha: string;
  expected: LiveCheckpointExpected;
}): Promise<LiveCheckpointContinuation> {
  let raw: string;
  try { raw = readFileSync(input.checkpointPath, "utf8"); } catch { throw blocked("UNREADABLE"); }
  if (sha256Bytes(raw) !== input.checkpointSha256.trim().toLowerCase()) throw blocked("HASH_MISMATCH");
  let checkpoint: PhoenixLiveStateCheckpoint;
  try { checkpoint = JSON.parse(raw) as PhoenixLiveStateCheckpoint; } catch { throw blocked("MALFORMED"); }
  if (checkpoint.type !== CHECKPOINT_TYPE || checkpoint.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) throw blocked("TYPE_MISMATCH");
  if (input.checkpointCodeSha !== input.expected.codeSha || checkpoint.generatingCodeSha !== input.expected.codeSha) throw blocked("CODE_SHA_MISMATCH");
  if (checkpoint.releaseId !== input.expected.releaseId || checkpoint.manifestHash !== input.expected.manifestHash) throw blocked("RELEASE_IDENTITY_MISMATCH");
  if (JSON.stringify(checkpoint.environmentFingerprint) !== JSON.stringify(input.expected.environment)) throw blocked("ENVIRONMENT_MISMATCH");
  if (checkpoint.nextPhase !== "offers" || checkpoint.firstExecutableSourceKey !== FIRST_OFFER_KEY || !checkpoint.laterPhasesUntouched || checkpoint.databaseWriterRan) throw blocked("BOUNDARY_MISMATCH");
  const proof = await proveLiveState(input.prisma, input.expected);
  for (const phase of COMPLETED_PHASES) {
    if (checkpoint.completedCounts[phase] !== proof.keys[phase].length || checkpoint.completedSourceKeyDigests[phase] !== digest(proof.keys[phase])) throw blocked(`LIVE_SET_DRIFT_${phase.toUpperCase()}`);
  }
  if (checkpoint.liveLineageDigest !== proof.liveLineageDigest || checkpoint.protectedTargetStateDigest !== proof.protectedTargetStateDigest ||
      JSON.stringify(checkpoint.protectedAdoption) !== JSON.stringify(proof.protectedAdoption) || JSON.stringify(checkpoint.auditCounts) !== JSON.stringify(proof.auditCounts)) {
    throw blocked("LIVE_STATE_DRIFT");
  }
  return {
    checkpoint,
    phaseSkipSets: new Map<PhoenixPhaseName, ReadonlySet<string>>([
      ["users", new Set(proof.keys.users)], ["businesses", new Set(proof.keys.businesses)], ["places", new Set(proof.keys.places)],
    ]),
    startPhase: "offers",
  };
}
