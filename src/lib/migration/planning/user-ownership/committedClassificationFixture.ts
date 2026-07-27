import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ClassificationSets } from "./snapshotEvidence";

const SOURCE_SCOPE = 579;
const CLEAN_SCOPE = 564;

const DOCS_MIGRATION_DIR = new URL("../../../../../docs/migration/", import.meta.url);

function readSourceRecordKeys(fileName: string): readonly string[] {
  const path = fileURLToPath(new URL(fileName, DOCS_MIGRATION_DIR));
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ReadonlyArray<{ sourceRecordKey: string }>;
  return [...parsed.map(entry => entry.sourceRecordKey)].sort();
}

/**
 * Rebuilds the same `ClassificationSets` shape the (now-lost) immutable
 * USERS snapshot's `analysis/users-classification.json` used to provide,
 * sourced instead from the already-committed sanitised Slice 6 planning
 * manifests. These three files ARE the exact classes C/D/H sourceRecordKey
 * lists from that classification — nothing here is fabricated or
 * re-derived, so tests using this fixture still verify real, historical
 * migrated state (see prelaunch-checklist.md Rule 14).
 */
export function loadCommittedClassification(): ClassificationSets {
  return {
    sourceScope: SOURCE_SCOPE,
    cleanScope: CLEAN_SCOPE,
    manualPrivileged: readSourceRecordKeys("manual-user-backlog.json"),
    businessLinked: readSourceRecordKeys("business-ownership-plan.json"),
    contentAuthor: readSourceRecordKeys("content-authorship-plan.json"),
  };
}
