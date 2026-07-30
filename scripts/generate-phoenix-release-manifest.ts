import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const output = "docs/migration/releases/phoenix-approved-2026-07-30.json";
const placesPath = "docs/migration/manifests/places-preview-2026-07-30.json";
const offersPath = "docs/migration/manifests/offers-local-manifest-2026-07-30.json";
const usersPath = "docs/migration/users-production-activation-manifest.json";
const privilegedUsersPath = "docs/migration/users-manual-privileged-14-manifest.json";
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
      blocker: "Existing artifacts prove final local state but do not encode an executable fresh-environment user scope.",
    },
    {
      name: "businesses",
      status: "BLOCKED",
      artifacts: [],
      records: [],
      protectedSourceRecordKeys: [],
      excludedSourceRecordKeys: [],
      deterministicConflicts: [],
      mediaPolicy: "NONE",
      prerequisites: ["Frozen business/ownership sourceRecordKey manifest."],
      blocker: "Ownership proof slices are historical reports; no single executable frozen business manifest exists.",
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
