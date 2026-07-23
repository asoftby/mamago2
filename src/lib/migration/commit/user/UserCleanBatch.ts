import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { PrismaClient } from "@prisma/client";

import {
  USER_SNAPSHOT_SHA256,
  buildUserCanonicalHash,
  buildUserDraft,
  loadUserSourceCandidate,
  normalizeUserCandidate,
  planUserMigration,
  writeUserMigration,
  type UserClassification,
  type UserMigrationAction,
  type UserSourceRecordKey,
} from "./UserMigrationVerticalSlice";

export const CLEAN_USER_COUNT = 564;
export const CLEAN_USER_BATCH_SIZE = 50;
export const CLEAN_USER_BATCH_COUNT = 12;
export const CLEAN_USER_CLASSES = ["A", "C", "D"] as const;

export interface CleanUserManifestEntry {
  sourceRecordKey: UserSourceRecordKey;
  classification: Exclude<UserClassification, "PRIVILEGED_COLLISION">;
  canonicalCandidateHash: string;
  expectedFirstAction: "CREATE" | "SKIP_UNCHANGED";
  expectedRerunAction: "SKIP_UNCHANGED";
}

export interface CleanUserManifest {
  version: 1;
  sourceSnapshotSha256: string;
  manifestHash: string;
  candidateCount: number;
  excludedCount: number;
  batchSize: number;
  entries: readonly CleanUserManifestEntry[];
}

export interface ManifestValidationSummary {
  entries: number;
  duplicates: number;
  missingCandidates: number;
  unknownCandidates: number;
  privilegedCandidates: number;
  expectedCreate: number;
  expectedSkip: number;
  manifestHash: string;
}

export interface CleanBatchResult {
  sourceRecordKey: UserSourceRecordKey;
  classification: CleanUserManifestEntry["classification"];
  action: UserMigrationAction;
  reason: string | null;
  warningsCount: number;
  targetId: string | null;
}

export interface CleanBatchSummary {
  total: number;
  create: number;
  skipUnchanged: number;
  blocked: number;
  error: number;
  completedBatches: number;
  results: readonly CleanBatchResult[];
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sortEntries(entries: readonly CleanUserManifestEntry[]): CleanUserManifestEntry[] {
  return [...entries].sort((a, b) => a.sourceRecordKey.localeCompare(b.sourceRecordKey, "en", { numeric: true }));
}

export function calculateCleanUserManifestHash(input: Pick<CleanUserManifest, "version" | "sourceSnapshotSha256" | "candidateCount" | "excludedCount" | "batchSize" | "entries">): string {
  return hash(JSON.stringify({
    version: input.version,
    sourceSnapshotSha256: input.sourceSnapshotSha256,
    candidateCount: input.candidateCount,
    excludedCount: input.excludedCount,
    batchSize: input.batchSize,
    entries: sortEntries(input.entries),
  }));
}

type InventoryArtifact = { users: Array<{ sourceRecordKey: string; primaryClass: string }> };

export function buildCleanUserManifest(snapshotRoot: string): CleanUserManifest {
  const inventory = JSON.parse(readFileSync(`${snapshotRoot}/analysis/users-inventory.json`, "utf8")) as InventoryArtifact;
  const approved = inventory.users.filter(user => (CLEAN_USER_CLASSES as readonly string[]).includes(user.primaryClass));
  const entries = sortEntries(approved.map(user => {
    const candidate = normalizeUserCandidate(loadUserSourceCandidate(snapshotRoot, user.sourceRecordKey));
    const classification = candidate.classification as CleanUserManifestEntry["classification"];
    return {
      sourceRecordKey: candidate.sourceRecordKey,
      classification,
      canonicalCandidateHash: buildUserCanonicalHash(candidate, buildUserDraft(candidate)),
      expectedFirstAction: candidate.sourceRecordKey === "wordpress-db:user:7" || candidate.sourceRecordKey === "wordpress-db:user:38" ? "SKIP_UNCHANGED" as const : "CREATE" as const,
      expectedRerunAction: "SKIP_UNCHANGED" as const,
    };
  }));
  const base = { version: 1 as const, sourceSnapshotSha256: USER_SNAPSHOT_SHA256, candidateCount: entries.length, excludedCount: inventory.users.length - entries.length, batchSize: CLEAN_USER_BATCH_SIZE, entries };
  return { ...base, manifestHash: calculateCleanUserManifestHash(base) };
}

export function readCleanUserManifest(path: string): CleanUserManifest {
  return JSON.parse(readFileSync(path, "utf8")) as CleanUserManifest;
}

export function validateCleanUserManifest(manifest: CleanUserManifest, snapshotRoot: string): ManifestValidationSummary {
  if (manifest.sourceSnapshotSha256 !== USER_SNAPSHOT_SHA256) throw new Error("CLEAN_MANIFEST_SNAPSHOT_HASH_MISMATCH");
  if (manifest.candidateCount !== CLEAN_USER_COUNT || manifest.entries.length !== CLEAN_USER_COUNT) throw new Error("CLEAN_MANIFEST_CANDIDATE_COUNT_MISMATCH");
  if (manifest.excludedCount !== 15 || manifest.batchSize !== CLEAN_USER_BATCH_SIZE) throw new Error("CLEAN_MANIFEST_POLICY_MISMATCH");
  const calculatedHash = calculateCleanUserManifestHash(manifest);
  if (manifest.manifestHash !== calculatedHash) throw new Error("CLEAN_MANIFEST_HASH_MISMATCH");
  const generated = buildCleanUserManifest(snapshotRoot);
  const expectedByKey = new Map(generated.entries.map(entry => [entry.sourceRecordKey, entry]));
  const seen = new Set<string>();
  let duplicates = 0;
  let unknownCandidates = 0;
  let privilegedCandidates = 0;
  for (const entry of manifest.entries) {
    if (seen.has(entry.sourceRecordKey)) duplicates += 1;
    seen.add(entry.sourceRecordKey);
    if (entry.sourceRecordKey === "wordpress-db:user:1" || entry.classification === ("PRIVILEGED_COLLISION" as UserClassification)) privilegedCandidates += 1;
    const expected = expectedByKey.get(entry.sourceRecordKey);
    if (!expected) { unknownCandidates += 1; continue; }
    if (entry.classification !== expected.classification || entry.canonicalCandidateHash !== expected.canonicalCandidateHash) throw new Error(`CLEAN_MANIFEST_CANDIDATE_MISMATCH:${entry.sourceRecordKey}`);
    if (entry.expectedFirstAction !== expected.expectedFirstAction || entry.expectedRerunAction !== "SKIP_UNCHANGED") throw new Error(`CLEAN_MANIFEST_ACTION_MISMATCH:${entry.sourceRecordKey}`);
  }
  const missingCandidates = [...expectedByKey.keys()].filter(key => !seen.has(key)).length;
  if (duplicates || missingCandidates || unknownCandidates || privilegedCandidates) throw new Error("CLEAN_MANIFEST_MEMBERSHIP_MISMATCH");
  if (!seen.has("wordpress-db:user:7") || !seen.has("wordpress-db:user:38") || seen.has("wordpress-db:user:1")) throw new Error("CLEAN_MANIFEST_GOLDEN_POLICY_MISMATCH");
  const expectedCreate = manifest.entries.filter(entry => entry.expectedFirstAction === "CREATE").length;
  const expectedSkip = manifest.entries.filter(entry => entry.expectedFirstAction === "SKIP_UNCHANGED").length;
  if (expectedCreate !== 562 || expectedSkip !== 2) throw new Error("CLEAN_MANIFEST_ACTION_TOTAL_MISMATCH");
  return { entries: manifest.entries.length, duplicates, missingCandidates, unknownCandidates, privilegedCandidates, expectedCreate, expectedSkip, manifestHash: calculatedHash };
}

export async function previewCleanUserManifest(prisma: PrismaClient, manifest: CleanUserManifest, snapshotRoot: string, phase: "FIRST_RUN" | "RERUN"): Promise<CleanBatchSummary> {
  const results: CleanBatchResult[] = [];
  for (const entry of manifest.entries) {
    const candidate = normalizeUserCandidate(loadUserSourceCandidate(snapshotRoot, entry.sourceRecordKey));
    const plan = await planUserMigration(prisma, candidate);
    const expected = phase === "FIRST_RUN" ? entry.expectedFirstAction : entry.expectedRerunAction;
    if (plan.action !== expected) throw new Error(`CLEAN_PREVIEW_MISMATCH:${entry.sourceRecordKey}:${expected}:${plan.action}:${plan.reason ?? "NONE"}`);
    results.push({ sourceRecordKey: entry.sourceRecordKey, classification: entry.classification, action: plan.action, reason: plan.reason, warningsCount: plan.warnings.length, targetId: plan.targetId });
  }
  return summarize(results, Math.ceil(results.length / manifest.batchSize));
}

export async function executeCleanUserBatch(input: {
  prisma: PrismaClient;
  manifest: CleanUserManifest;
  snapshotRoot: string;
  phase: "FIRST_RUN" | "RERUN";
  afterBatch: (state: { batchNumber: number; processed: number; results: readonly CleanBatchResult[] }) => Promise<void>;
  dependencies?: {
    loadCandidate: typeof loadUserSourceCandidate;
    plan: typeof planUserMigration;
    write: typeof writeUserMigration;
  };
}): Promise<CleanBatchSummary> {
  const dependencies = input.dependencies ?? { loadCandidate: loadUserSourceCandidate, plan: planUserMigration, write: writeUserMigration };
  const results: CleanBatchResult[] = [];
  let completedBatches = 0;
  for (let offset = 0; offset < input.manifest.entries.length; offset += input.manifest.batchSize) {
    const batch = input.manifest.entries.slice(offset, offset + input.manifest.batchSize);
    for (const entry of batch) {
      const candidate = normalizeUserCandidate(dependencies.loadCandidate(input.snapshotRoot, entry.sourceRecordKey));
      const plan = await dependencies.plan(input.prisma, candidate);
      const expected = input.phase === "FIRST_RUN" ? entry.expectedFirstAction : entry.expectedRerunAction;
      if (plan.action !== expected) throw new Error(`CLEAN_BATCH_STOP:${entry.sourceRecordKey}:${expected}:${plan.action}:${plan.reason ?? "NONE"}`);
      const written = await dependencies.write(input.prisma, plan);
      results.push({ sourceRecordKey: entry.sourceRecordKey, classification: entry.classification, action: written.action, reason: plan.reason, warningsCount: plan.warnings.length, targetId: written.targetId });
    }
    await input.afterBatch({ batchNumber: completedBatches + 1, processed: results.length, results });
    completedBatches += 1;
  }
  return summarize(results, completedBatches);
}

function summarize(results: readonly CleanBatchResult[], completedBatches: number): CleanBatchSummary {
  return {
    total: results.length,
    create: results.filter(result => result.action === "CREATE").length,
    skipUnchanged: results.filter(result => result.action === "SKIP_UNCHANGED").length,
    blocked: results.filter(result => result.action === "BLOCKED").length,
    error: 0,
    completedBatches,
    results,
  };
}
