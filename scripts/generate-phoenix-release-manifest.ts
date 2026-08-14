import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS, assertExactExclusionSet } from "../src/lib/migration/release/knownBlockers";

const output = "docs/migration/releases/phoenix-approved-2026-07-30.json";
const placesPath = "docs/migration/manifests/places-preview-2026-07-30.json";
const offersPath = "docs/migration/manifests/offers-local-manifest-2026-07-30.json";
const usersPath = "docs/migration/users-production-activation-manifest.json";
const privilegedUsersPath = "docs/migration/users-manual-privileged-14-manifest.json";
const usersCleanManifestPath = "docs/migration/users-slice5-clean-manifest.json";
const usersFounderExclusionsPath = "docs/migration/manifests/phoenix-users-founder-exclusions-2026-07-31.json";
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

const usersClean = JSON.parse(readFileSync(usersCleanManifestPath, "utf8")) as {
  candidateCount: number;
  entries: Array<{ sourceRecordKey: string; expectedFirstAction: "CREATE" | "SKIP_UNCHANGED" }>;
};
if (usersClean.candidateCount !== 564 || usersClean.entries.length !== 564) {
  throw new Error(`Expected exactly 564 Users clean-manifest entries, found ${usersClean.entries.length}.`);
}

const usersFounderExclusions = JSON.parse(readFileSync(usersFounderExclusionsPath, "utf8")) as {
  decisionType: string;
  excludedSourceRecordKeys: string[];
  excludedCount: number;
};

// Fail-closed: the founder decision must exclude exactly the current
// Users-unresolved set — no more, no fewer, no substitutions. Any drift
// here (a 6th exclusion snuck in, one of the 5 missing, a typo) throws
// before the manifest is generated, rather than silently producing a
// wrong executable scope.
if (usersFounderExclusions.decisionType !== "EXCLUDE_FROM_FIRST_RELEASE") {
  throw new Error(`Unexpected founder decision type: ${usersFounderExclusions.decisionType}.`);
}
if (usersFounderExclusions.excludedCount !== usersFounderExclusions.excludedSourceRecordKeys.length) {
  throw new Error("Founder exclusion artifact's excludedCount does not match its own excludedSourceRecordKeys length.");
}
assertExactExclusionSet(usersFounderExclusions.excludedSourceRecordKeys, USERS_UNRESOLVED_SOURCE_RECORD_KEYS);
const founderExcludedSet = new Set(usersFounderExclusions.excludedSourceRecordKeys);

const usersExecutableRecords = usersClean.entries
  .filter((entry) => !founderExcludedSet.has(entry.sourceRecordKey))
  .map((entry) => ({ sourceRecordKey: entry.sourceRecordKey, action: entry.expectedFirstAction }));
if (usersExecutableRecords.length !== 560) {
  throw new Error(`Expected exactly 560 executable Users records, computed ${usersExecutableRecords.length}.`);
}
// Founder ownership dispositions are explicit Users-phase prerequisites,
// outside the 564-record clean track: user:1 adopts an existing ADMIN and
// user:129 replays the already-approved manual/privileged track.
usersExecutableRecords.unshift(
  { sourceRecordKey: "wordpress-db:user:1", action: "CREATE" },
  { sourceRecordKey: "wordpress-db:user:129", action: "CREATE" },
  { sourceRecordKey: "wordpress-db:user:27", action: "CREATE" },
);
if (usersExecutableRecords.some((r) => founderExcludedSet.has(r.sourceRecordKey))) {
  throw new Error("A founder-excluded sourceRecordKey leaked into the executable Users records.");
}

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
      status: "READY",
      artifacts: [
        {
          path: usersCleanManifestPath,
          sha256: sha256(usersCleanManifestPath),
          executable: true,
          description:
            "Frozen 564-user clean-batch classification with canonicalCandidateHash per record. 560/564 " +
            "reproduced 2026-07-30 via a bounded read-only WP capture reconciled against approved LOCAL " +
            "MigrationRecord.normalizedPayload ground truth; the remaining 4 are excluded from this first " +
            "release (see phoenix-users-founder-exclusions-2026-07-31.json).",
        },
        {
          path: usersFounderExclusionsPath,
          sha256: sha256(usersFounderExclusionsPath),
          executable: false,
          description:
            "Founder-approved EXCLUDE_FROM_FIRST_RELEASE decision for the 4 unresolved sourceRecordKeys " +
            "(2026-07-31) — temporary release exclusion, not a deletion; tracked as a post-release backlog item.",
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
      records: usersExecutableRecords,
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [...founderExcludedSet],
      exclusionReasons: Object.fromEntries([...founderExcludedSet].map((key) => [key, "EXCLUDE_FROM_FIRST_RELEASE"])),
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: [
        "WP_USER_1_MAP_TO_PLATFORM_OWNER via PHOENIX_PLATFORM_OWNER_EMAIL exact ADMIN identity",
        "WP_USER_129_REUSE_EXISTING_TRACK via PHOENIX_MANUAL_PRIVILEGED_CAPTURE",
        "WP_USER_43_REINCLUDED_FOR_CONTENT_OWNERSHIP",
      ],
    },
    {
      name: "businesses",
      status: "READY",
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
      exclusionReasons: Object.fromEntries([...entangledSet].map((key) => [key, "EXCLUDED_BY_USER_DECISION"])),
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: [`users phase completed for all ${businessRecords.length} dependent sourceRecordKeys`],
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
