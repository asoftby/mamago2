/**
 * One-shot generator for the founder-decision artifact that excludes the
 * unresolved Users sourceRecordKeys from the first Phoenix release. Reads
 * the exclusion list from the single shared source of truth
 * (`knownBlockers.ts`) rather than retyping it — this is the same list
 * already used to filter the businesses phase's executable records.
 *
 * No PII (email/firstName/lastName/displayName/current WP values) is
 * ever written here — only sourceRecordKeys and decision metadata.
 */
import { writeFileSync } from "node:fs";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS } from "../src/lib/migration/release/knownBlockers";

const EXPECTED_COUNT = 4;

if (USERS_UNRESOLVED_SOURCE_RECORD_KEYS.length !== EXPECTED_COUNT) {
  throw new Error(`Expected exactly ${EXPECTED_COUNT} unresolved Users sourceRecordKeys, found ${USERS_UNRESOLVED_SOURCE_RECORD_KEYS.length}.`);
}
if (new Set(USERS_UNRESOLVED_SOURCE_RECORD_KEYS).size !== EXPECTED_COUNT) {
  throw new Error("Duplicate sourceRecordKey in USERS_UNRESOLVED_SOURCE_RECORD_KEYS.");
}
for (const key of USERS_UNRESOLVED_SOURCE_RECORD_KEYS) {
  if (!/^wordpress-db:user:\d+$/.test(key)) throw new Error(`Malformed sourceRecordKey: ${key}`);
}

const artifact = {
  schemaVersion: 1,
  artifactId: "phoenix-users-founder-exclusions-2026-07-31",
  releaseId: "phoenix-approved-2026-07-30",
  decisionType: "EXCLUDE_FROM_FIRST_RELEASE" as const,
  reasonCode: "HISTORICAL_NAME_INPUT_UNRECOVERABLE" as const,
  reasonSummary:
    "560 of 564 Users canonical hashes were reproduced exactly (2026-07-30 bounded read-only WP capture " +
    "reconciled against approved LOCAL MigrationRecord.normalizedPayload ground truth, one uniform rule). " +
    "These 4 did not reproduce; no deterministic common reconstruction rule exists, and no per-user invented " +
    "value is permitted. (A 5th record, wordpress-db:user:43, was originally excluded for the same reason but " +
    "was reincluded 2026-07-31 by explicit founder decision because the available display name satisfies the " +
    "User schema without inventing profile data; see WP_USER_43_REINCLUDED_FOR_CONTENT_OWNERSHIP.)",
  approvedBy: "FOUNDER" as const,
  approvedDate: "2026-07-31",
  scopeEffect:
    "Temporary release exclusion, not a deletion and not a determination that these records are invalid. " +
    "Reduces the first-release executable Users scope from 564 to 560. Excluded records remain migration-" +
    "eligible and must be revisited in a documented post-release backlog.",
  postReleaseBacklogRequirement:
    "Must be tracked as an open post-release backlog item until either a deterministic reconstruction rule " +
    "is found or the original historical snapshot is discovered.",
  excludedSourceRecordKeys: [...USERS_UNRESOLVED_SOURCE_RECORD_KEYS],
  excludedCount: USERS_UNRESOLVED_SOURCE_RECORD_KEYS.length,
};

const outPath = "docs/migration/manifests/phoenix-users-founder-exclusions-2026-07-31.json";
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(outPath, "->", artifact.excludedCount, "excluded sourceRecordKeys");
