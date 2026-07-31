import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";

import { FrozenUserSourceRepository } from "./usersProductionWiring";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS } from "../knownBlockers";

const KEY = "wordpress-db:user:99";

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRecordKey: KEY, sourceSystem: "wordpress-db", legacyUserId: 99, email: "golden-fixture@example.invalid",
    displayName: "Golden Fixture", firstName: null, lastName: null, phone: null, sourceCreatedAt: "2026-01-01 00:00:00",
    legacyRoles: [], legacyPasswordPresent: false, businessLinked: false, businessEvidence: { exactOwnership: false, placeCount: 0 },
    privilegedCollision: false, profileMediaReferencePresent: false,
    ...overrides,
  };
}

function artifact(records: unknown[] = [record()], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, entity: "users", capturedAt: "2026-01-02T00:00:00.000Z", records, ...overrides };
}

function repository(value: unknown, shaOverride?: string): FrozenUserSourceRepository {
  const root = mkdtempSync(join(tmpdir(), "phoenix-user-loader-"));
  mkdirSync(join(root, "users"));
  const raw = `${JSON.stringify(value)}\n`;
  writeFileSync(join(root, "users", "capture.json"), raw, { mode: 0o600 });
  const sha = shaOverride ?? createHash("sha256").update(raw).digest("hex");
  return new FrozenUserSourceRepository(root, sha);
}

function expectError(action: () => unknown, message: string): void {
  assert.throws(action, (error: unknown) => error instanceof Error && error.message === message);
}

function testRealScopeArtifactIsFiveHundredSixtyNoPii(): void {
  const raw = readFileSync("docs/migration/manifests/phoenix-users-dev-release-scope-2026-07-31.json", "utf8");
  const artifactData = JSON.parse(raw) as { total: number; records: Array<{ sourceRecordKey: string; contentHash: string }> };
  assert.equal(artifactData.total, 560);
  assert.equal(artifactData.records.length, 560);
  assert.equal(new Set(artifactData.records.map((r) => r.sourceRecordKey)).size, 560);
  assert(!/@/.test(raw), "committed Users scope artifact must contain no email addresses");
  for (const key of USERS_UNRESOLVED_SOURCE_RECORD_KEYS) {
    assert(!artifactData.records.some((r) => r.sourceRecordKey === key), `${key} must not be in the executable scope artifact`);
  }
  // wordpress-db:user:43 was reincluded 2026-07-31 (WP_USER_43_REINCLUDED_FOR_CONTENT_OWNERSHIP)
  // and must now be present, not excluded.
  assert(artifactData.records.some((r) => r.sourceRecordKey === "wordpress-db:user:43"), "wordpress-db:user:43 must be in the executable scope artifact after reinclusion");
}

function main(): void {
  testRealScopeArtifactIsFiveHundredSixtyNoPii();

  const valid = repository(artifact());
  const first = valid.loadSourceCandidate(KEY);
  assert.equal(first.email, "golden-fixture@example.invalid");
  assert.equal(first.legacyPasswordPresent, false, "password data is never carried, regardless of what the capture claims");
  assert.deepEqual(first, valid.loadSourceCandidate(KEY), "load result must be deterministic");

  expectError(() => repository(artifact()).loadSourceCandidate("wordpress-db:user:404"), "FAILED:USER_SOURCE_RECORD_MISSING");
  expectError(() => repository(artifact([record(), record()])).loadSourceCandidate(KEY), "FAILED:DUPLICATE_USER_SOURCE_RECORD");
  expectError(() => repository(artifact(), "0".repeat(64)).loadSourceCandidate(KEY), "RELEASE_BLOCKED:USER_ARTIFACT_CHECKSUM_MISMATCH");
  expectError(() => repository(artifact([record()], { schemaVersion: 2 })).loadSourceCandidate(KEY), "FAILED:UNSUPPORTED_USER_ARTIFACT_VERSION");
  expectError(() => repository(artifact([record({ privilegedCollision: true })])).loadSourceCandidate(KEY), "FAILED:PRIVILEGED_USER_RECORD_REJECTED");
  expectError(() => repository(artifact()).loadSourceCandidate(USERS_UNRESOLVED_SOURCE_RECORD_KEYS[0]), "FAILED:USER_SOURCE_RECORD_EXCLUDED");
  console.log("Frozen Users source repository tests: PASS");
}

main();
