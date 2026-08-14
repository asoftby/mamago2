import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireResolvedArtifact, resolvePhoenixArtifactRoot } from "./phoenix-artifact-paths";

const OUT_DIR = resolve("docs/migration/manifests");
const SOURCE_ROOT_ENV = "PHOENIX_SOURCE_SNAPSHOT_ROOT";
const EXPECTED_CAPTURES = ["users/capture.json", "places/capture.json"] as const;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function recordHash(record: unknown): string {
  return `capture-content-v1:${createHash("sha256").update(stableJson(record)).digest("hex")}`;
}

function main(): void {
  const sourceRoot = resolvePhoenixArtifactRoot(SOURCE_ROOT_ENV, EXPECTED_CAPTURES);
  const summary: Record<string, unknown>[] = [];

  // Users: committed artifact must contain zero PII (no email/name) —
  // only sourceRecordKey + a content hash proving the private capture is
  // reproducible/unaltered.
  {
    const privatePath = requireResolvedArtifact(sourceRoot, "users/capture.json");
    const raw = readFileSync(privatePath, "utf8");
    const privateChecksum = createHash("sha256").update(raw).digest("hex");
    const capture = JSON.parse(raw) as { capturedAt: string; records: Array<Record<string, unknown> & { sourceRecordKey: string }> };
    const artifact = {
      schemaVersion: 1,
      artifactId: "phoenix-users-dev-release-scope-2026-07-31",
      entity: "users",
      sourceCaptureTimestamp: capture.capturedAt,
      canonicalization: "capture-content-v1 (per-record hash of captured raw fields; NOT the historical A/C/D/H canonicalCandidateHash)",
      total: capture.records.length,
      records: capture.records
        .map((r) => ({ sourceRecordKey: r.sourceRecordKey, contentHash: recordHash(r) }))
        .sort((a, b) => a.sourceRecordKey.localeCompare(b.sourceRecordKey)),
      privateArtifact: {
        path: "users/capture.json",
        sha256: privateChecksum,
        transferRequirement: "Never committed; contains real names/emails. Raw content lives only at this immutable local path (mode 0600). Any transfer to another machine/session must use an out-of-band secure channel and must not be pasted into chat or logs.",
      },
    };
    const outPath = resolve(OUT_DIR, `${artifact.artifactId}.json`);
    writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
    summary.push({ entity: "users", total: artifact.total, outPath, committedChecksum: createHash("sha256").update(readFileSync(outPath)).digest("hex") });
  }

  // Places: same shape as Offers/Routes/Events/Articles (sourceHash already present per record).
  {
    const privatePath = requireResolvedArtifact(sourceRoot, "places/capture.json");
    const raw = readFileSync(privatePath, "utf8");
    const privateChecksum = createHash("sha256").update(raw).digest("hex");
    const capture = JSON.parse(raw) as { capturedAt: string; records: Array<{ sourceRecordKey: string; sourceHash?: string; sourceUpdatedAt?: string }> };
    const artifact = {
      schemaVersion: 1,
      artifactId: "phoenix-places-dev-release-scope-2026-07-31",
      entity: "places",
      sourceCaptureTimestamp: capture.capturedAt,
      canonicalization: "wordpress-db-domain-v2 (src/lib/migration/adapters/wordpress-db/canonicalSourceHash.ts)",
      total: capture.records.length,
      records: capture.records
        .map((r) => ({ sourceRecordKey: r.sourceRecordKey, sourceHash: r.sourceHash ?? null, sourceUpdatedAt: r.sourceUpdatedAt ?? null }))
        .sort((a, b) => a.sourceRecordKey.localeCompare(b.sourceRecordKey)),
      privateArtifact: {
        path: "places/capture.json",
        sha256: privateChecksum,
        transferRequirement: "Never committed; raw content lives only at this immutable local path (mode 0600). Any transfer to another machine/session must use an out-of-band secure channel and must not be pasted into chat or logs.",
      },
    };
    const outPath = resolve(OUT_DIR, `${artifact.artifactId}.json`);
    writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
    summary.push({ entity: "places", total: artifact.total, outPath, committedChecksum: createHash("sha256").update(readFileSync(outPath)).digest("hex") });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(JSON.stringify(summary, null, 2));
}

main();
