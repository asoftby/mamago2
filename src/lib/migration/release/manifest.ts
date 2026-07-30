import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import type {
  PhoenixArtifactReference,
  PhoenixReleaseManifest,
  PhoenixReleasePhase,
} from "./types";

export function sha256Bytes(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
}

export function parsePhoenixReleaseManifest(raw: string, sourcePath: string): PhoenixReleaseManifest {
  const value = JSON.parse(raw) as Partial<PhoenixReleaseManifest>;
  if (value.schemaVersion !== 1) throw new Error(`${sourcePath}: unsupported schemaVersion.`);
  assertString(value.releaseId, "releaseId");
  if (!Array.isArray(value.phaseOrder) || !Array.isArray(value.phases)) {
    throw new Error(`${sourcePath}: phaseOrder and phases must be arrays.`);
  }
  const names = value.phases.map((phase) => phase.name);
  if (new Set(names).size !== names.length) throw new Error(`${sourcePath}: duplicate phase name.`);
  if (value.phaseOrder.some((name) => !names.includes(name))) {
    throw new Error(`${sourcePath}: phaseOrder references an unknown phase.`);
  }
  for (const phase of value.phases) validatePhase(phase, sourcePath);
  return value as PhoenixReleaseManifest;
}

function validatePhase(phase: PhoenixReleasePhase, sourcePath: string): void {
  assertString(phase.name, `${sourcePath}: phase.name`);
  if (!["READY", "BLOCKED", "VALIDATION_ONLY"].includes(phase.status)) {
    throw new Error(`${sourcePath}: invalid status for ${phase.name}.`);
  }
  for (const key of [
    "artifacts",
    "records",
    "protectedSourceRecordKeys",
    "excludedSourceRecordKeys",
    "deterministicConflicts",
    "prerequisites",
  ] as const) {
    if (!Array.isArray(phase[key])) throw new Error(`${sourcePath}: ${phase.name}.${key} must be an array.`);
  }
  const recordKeys = phase.records.map((record) => record.sourceRecordKey);
  if (new Set(recordKeys).size !== recordKeys.length) throw new Error(`${sourcePath}: duplicate record in ${phase.name}.`);
  const forbidden = new Set([...phase.protectedSourceRecordKeys, ...phase.excludedSourceRecordKeys]);
  const plannedForbidden = recordKeys.find((key) => forbidden.has(key));
  if (plannedForbidden) throw new Error(`${sourcePath}: protected/excluded record ${plannedForbidden} is executable.`);
  if (phase.status === "BLOCKED" && !phase.blocker) throw new Error(`${sourcePath}: blocked phase ${phase.name} needs blocker.`);
  if (phase.blockerCode && !phase.blocker) throw new Error(`${sourcePath}: ${phase.name}.blockerCode requires a human-readable blocker string.`);
  if (phase.status !== "BLOCKED" && (phase.blocker || phase.blockerCode)) {
    throw new Error(`${sourcePath}: ${phase.name} is ${phase.status} but still carries a stale blocker/blockerCode.`);
  }
}

export function loadPhoenixReleaseManifest(path: string): {
  manifest: PhoenixReleaseManifest;
  manifestHash: string;
} {
  const raw = readFileSync(path, "utf8");
  return { manifest: parsePhoenixReleaseManifest(raw, path), manifestHash: sha256Bytes(raw) };
}

export function resolveArtifactPath(manifestPath: string, artifact: PhoenixArtifactReference): string {
  if (isAbsolute(artifact.path)) return artifact.path;
  // Committed manifests live below docs/migration/releases; repository paths
  // deliberately resolve from cwd while adjacent paths resolve from the file.
  return artifact.path.startsWith("./")
    ? resolve(dirname(manifestPath), artifact.path)
    : resolve(process.cwd(), artifact.path);
}

export function verifyArtifactHashes(manifestPath: string, manifest: PhoenixReleaseManifest): void {
  for (const phase of manifest.phases) {
    for (const artifact of phase.artifacts) {
      const path = resolveArtifactPath(manifestPath, artifact);
      const actual = sha256Bytes(readFileSync(path));
      if (actual !== artifact.sha256) {
        throw new Error(`ARTIFACT_HASH_MISMATCH: ${artifact.path}: expected ${artifact.sha256}, got ${actual}.`);
      }
    }
  }
}

export function exactExecutableKeys(phase: PhoenixReleasePhase): string[] {
  const forbidden = new Set([...phase.protectedSourceRecordKeys, ...phase.excludedSourceRecordKeys]);
  return phase.records.map((record) => record.sourceRecordKey).filter((key) => !forbidden.has(key));
}
