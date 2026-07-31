import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS } from "../src/lib/migration/release/knownBlockers";

const output = "docs/migration/releases/phoenix-approved-2026-07-30.json";
const placesPath = "docs/migration/manifests/places-preview-2026-07-30.json";
const offersPath = "docs/migration/manifests/offers-local-manifest-2026-07-30.json";
const usersPath = "docs/migration/users-production-activation-manifest.json";
const privilegedUsersPath = "docs/migration/users-manual-privileged-14-manifest.json";
const usersCleanManifestPath = "docs/migration/users-slice5-clean-manifest.json";
const businessOwnershipBasePath = "docs/migration/manifests/phoenix-business-ownership-base-2026-07-30.json";
const businessOwnershipOverridesPath = "docs/migration/manifests/phoenix-business-ownership-overrides-2026-07-30.json";
const redirectsPath = "scripts/data/wp-redirect-map.json";

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const places = JSON.parse(readFileSync(placesPath, "utf8")) as {
  candidates: Array<{ sourceRecordKey: string; action: "SKIP_UNCHANGED" | "UPDATE_CONFLICT" }>;
};
const offers = JSON.parse(readFileSync(offersPath, "utf8")) as Array<{
  lineage: { sourceRecordKey: string };
}>;

const placeConflicts = places.candidates
  .filter((record) => record.action === "UPDATE_CONFLICT")
  .map((record) => record.sourceRecordKey);

const businessBase = JSON.parse(readFileSync(businessOwnershipBasePath, "utf8")) as {
  entries: Array<{ sourceRecordKey: string }>;
  entangledWithUnresolvedUsers: string[];
};
const businessOverrides = JSON.parse(readFileSync(businessOwnershipOverridesPath, "utf8")) as {
  entries: Array<{ sourceRecordKey: string }>;
};

// wordpress-db:user:43 (and any other base candidate the artifact flags as
// entangled) can never resolve its User dependency — excluding it from the
// phase's executable records (not from the artifact itself, which still
// faithfully records the full 36-candidate rule) keeps a future sequential
// apply from halting on it forever instead of processing the rest.
const entangledSet = new Set(businessBase.entangledWithUnresolvedUsers);
if (![...entangledSet].every((key) => (USERS_UNRESOLVED_SOURCE_RECORD_KEYS as readonly string[]).includes(key))) {
  throw new Error("Business base artifact flags an entangled key that is not in the current Users unresolved list.");
}
const businessRecords = [
  ...businessBase.entries
    .filter((e) => !entangledSet.has(e.sourceRecordKey))
    .map((e) => ({ sourceRecordKey: e.sourceRecordKey, action: "CREATE" as const })),
  ...businessOverrides.entries.map((e) => ({ sourceRecordKey: e.sourceRecordKey, action: "CREATE" as const })),
];

const manifest = {
  schemaVersion: 1,
  releaseId: "phoenix-approved-2026-07-30",
  phaseOrder: ["users", "businesses", "places", "offers", "routes", "events", "articles", "redirects"],
  phases: [
    {
      name: "users",
      status: "BLOCKED",
      artifacts: [
        {
          path: usersCleanManifestPath,
          sha256: sha256(usersCleanManifestPath),
          executable: false,
          description:
            "Frozen 564-user clean-batch classification with canonicalCandidateHash per record. " +
            "559/564 reproduced 2026-07-30 via a bounded read-only WP capture reconciled against " +
            "approved LOCAL MigrationRecord.normalizedPayload ground truth; 5 remain unresolved (see blocker).",
        },
        {
          path: usersPath,
          sha256: sha256(usersPath),
          executable: false,
          description: "Activation eligibility evidence; activation delivery is outside this release.",
        },
        {
          path: privilegedUsersPath,
          sha256: sha256(privilegedUsersPath),
          executable: false,
          description: "Manual privileged-user evidence.",
        },
      ],
      records: [],
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: ["Frozen executable user migration scope with sourceRecordKeys and expected actions."],
      blockerCode: "USERS_HISTORICAL_NAME_INPUT_UNRECOVERABLE",
      blocker:
        `Semantic reconciliation against approved LOCAL evidence reproduced 559/564 canonicalCandidateHash ` +
        `entries via one uniform rule (2026-07-30). ${USERS_UNRESOLVED_SOURCE_RECORD_KEYS.length} ` +
        `sourceRecordKeys remain unresolved: ${USERS_UNRESOLVED_SOURCE_RECORD_KEYS.join(", ")}. Historical ` +
        `first_name/last_name input for these records is unrecoverable (never persisted as raw payload; no ` +
        `other committed evidence records it) and no per-user override is permitted. Requires either a ` +
        `founder-approved accepted-exception decision or discovery of the original historical snapshot.`,
    },
    {
      name: "businesses",
      status: "BLOCKED",
      artifacts: [
        {
          path: businessOwnershipBasePath,
          sha256: sha256(businessOwnershipBasePath),
          executable: true,
          description: "Generic 36 EXACT_LINK_CANDIDATE business-ownership + BUSINESS_OWNER elevation scope.",
        },
        {
          path: businessOwnershipOverridesPath,
          sha256: sha256(businessOwnershipOverridesPath),
          executable: true,
          description:
            "Manual override scope for the 2 partial-coverage users (wordpress-db:user:89 -> 19 approved " +
            "Places, wordpress-db:user:130 -> 1 approved Place), copied verbatim from committed Slice 12/13 " +
            "script constants.",
        },
      ],
      records: businessRecords,
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [...entangledSet],
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: [`users phase executable for all ${businessRecords.length} dependent sourceRecordKeys`],
      blockerCode: "BLOCKED_BY_DEPENDENCY",
      blocker:
        `Ownership/role-elevation artifacts are structurally ready (${businessRecords.length} executable ` +
        `records, both artifacts hash-bound), but every dependent User must exist first — the users phase ` +
        `remains BLOCKED (USERS_HISTORICAL_NAME_INPUT_UNRECOVERABLE), so this phase cannot execute until ` +
        `that is resolved. ${entangledSet.size} additional generic-rule candidate(s) ` +
        `(${[...entangledSet].join(", ")}) are permanently excluded from this phase: they are also among the ` +
        `5 Users records with no per-user override permitted, so their User dependency can never resolve.`,
    },
    {
      name: "places",
      status: "READY",
      artifacts: [
        {
          path: placesPath,
          sha256: sha256(placesPath),
          executable: true,
          description: "Frozen live WordPress Place preview.",
        },
      ],
      records: places.candidates
        .filter((record) => record.action === "SKIP_UNCHANGED")
        .map((record) => ({ sourceRecordKey: record.sourceRecordKey, action: record.action })),
      protectedSourceRecordKeys: placeConflicts,
      excludedSourceRecordKeys: [],
      deterministicConflicts: placeConflicts,
      mediaPolicy: "METADATA",
      prerequisites: ["technicalMigrationCreator logical identity"],
    },
    {
      name: "offers",
      status: "BLOCKED",
      artifacts: [
        {
          path: offersPath,
          sha256: sha256(offersPath),
          executable: false,
          description: "Frozen reviewed local target state with lineage.",
        },
      ],
      records: offers.map((record) => ({
        sourceRecordKey: record.lineage.sourceRecordKey,
        action: "CREATE",
      })),
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: ["Per-record stable Place, owner, business and city logical dependency map."],
      blocker: "The frozen Offer artifact contains LOCAL target IDs and is not a live-source executable context artifact.",
    },
    {
      name: "routes",
      status: "BLOCKED",
      artifacts: [],
      records: [],
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "METADATA",
      prerequisites: ["Frozen executable Route sourceRecordKey manifest and expected actions."],
      blocker: "Route review/apply artifacts are historical review evidence, not a release execution scope.",
    },
    {
      name: "events",
      status: "BLOCKED",
      artifacts: [],
      records: [],
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "METADATA",
      prerequisites: ["Frozen executable Event sourceRecordKey manifest and ownership identities."],
      blocker: "No committed executable approved Event scope artifact exists.",
    },
    {
      name: "articles",
      status: "BLOCKED",
      artifacts: [],
      records: [],
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: ["Committed two-record Article manifest with sourceRecordKeys and hash."],
      blocker: "The approved Article keys/hash exist only in narrative/proof files, not one executable frozen artifact.",
    },
    {
      name: "redirects",
      status: "VALIDATION_ONLY",
      artifacts: [
        {
          path: redirectsPath,
          sha256: sha256(redirectsPath),
          executable: true,
          description: "Frozen redirect validation input.",
        },
      ],
      records: [],
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "NOT_APPLICABLE",
      prerequisites: [],
    },
  ],
};

writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(output);
