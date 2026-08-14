import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { requireResolvedArtifact, resolvePhoenixArtifactRoot } from "./phoenix-artifact-paths";

const OUT_DIR = resolve("docs/migration/manifests");
const SOURCE_ROOT_ENV = "PHOENIX_SOURCE_SNAPSHOT_ROOT";
const ENTITIES = ["offers", "routes", "events", "articles"] as const;
const EXPECTED_CAPTURES = ENTITIES.map((entity) => `${entity}/capture.json`);

interface Envelope {
  sourceRecordKey: string;
  sourceHash?: string;
  sourceUpdatedAt?: string;
}
interface Capture {
  schemaVersion: number;
  entity: string;
  capturedAt: string;
  records: Envelope[];
}

function main(): void {
  const sourceRoot = resolvePhoenixArtifactRoot(SOURCE_ROOT_ENV, EXPECTED_CAPTURES);
  mkdirSync(OUT_DIR, { recursive: true });
  const summary: Record<string, unknown>[] = [];
  for (const entity of ENTITIES) {
    const privatePath = requireResolvedArtifact(sourceRoot, `${entity}/capture.json`);
    const raw = readFileSync(privatePath, "utf8");
    const privateChecksum = createHash("sha256").update(raw).digest("hex");
    const capture = JSON.parse(raw) as Capture;
    const keys = capture.records.map((r) => r.sourceRecordKey);
    if (new Set(keys).size !== keys.length) throw new Error(`DUPLICATE_KEY_IN_CAPTURE:${entity}`);

    const artifact = {
      schemaVersion: 1,
      artifactId: `phoenix-${entity}-dev-release-scope-2026-07-31`,
      entity,
      sourceCaptureTimestamp: capture.capturedAt,
      canonicalization: "wordpress-db-domain-v2 (src/lib/migration/adapters/wordpress-db/canonicalSourceHash.ts)",
      total: capture.records.length,
      records: capture.records
        .map((r) => ({ sourceRecordKey: r.sourceRecordKey, sourceHash: r.sourceHash ?? null, sourceUpdatedAt: r.sourceUpdatedAt ?? null }))
        .sort((a, b) => a.sourceRecordKey.localeCompare(b.sourceRecordKey)),
      privateArtifact: {
        path: `${entity}/capture.json`,
        sha256: privateChecksum,
        transferRequirement: "Never committed; raw content lives only at this immutable local path (mode 0600). Any transfer to another machine/session must use an out-of-band secure channel and must not be pasted into chat or logs.",
      },
    };
    const outPath = resolve(OUT_DIR, `${artifact.artifactId}.json`);
    writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
    summary.push({ entity, total: artifact.total, outPath, privateChecksum });
  }
  console.log(JSON.stringify(summary, null, 2));
}

main();
