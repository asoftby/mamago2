/**
 * One-shot generator for the two frozen Phoenix Businesses/ownership
 * artifacts. Reads only already-committed evidence — never invents scope,
 * never queries a database:
 *
 * - Base 36-candidate rule: filtered straight from
 *   `docs/migration/business-ownership-plan.json` (action ===
 *   "EXACT_LINK_CANDIDATE"), which already backed Slice 7 (golden
 *   `wordpress-db:user:38`) and Slice 8 (the remaining 35).
 * - Manual override scope for the 2 partial-coverage users
 *   (`wordpress-db:user:89`, `wordpress-db:user:130`): the approved
 *   Place-source-ID lists are copied verbatim from the committed Slice
 *   12/13 script constants (`migration-partial-coverage-ownership-golden.ts`,
 *   `migration-partial-coverage-ownership-user89.ts`) — not recomputed from
 *   any current WordPress/DEV/LOCAL state.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS } from "../src/lib/migration/release/knownBlockers";

const planPath = "docs/migration/business-ownership-plan.json";
const plan = JSON.parse(readFileSync(planPath, "utf8")) as Array<{
  action: string;
  sourceRecordKey: string;
  roleRecommendation: string;
  evidenceHash: string;
}>;

const exactCandidates = plan.filter((entry) => entry.action === "EXACT_LINK_CANDIDATE");
if (exactCandidates.length !== 36) {
  throw new Error(`Expected exactly 36 EXACT_LINK_CANDIDATE entries in ${planPath}, found ${exactCandidates.length}.`);
}
const manualReview = plan.filter((entry) => entry.action === "MANUAL_REVIEW");
if (manualReview.length !== 2) {
  throw new Error(`Expected exactly 2 MANUAL_REVIEW entries in ${planPath}, found ${manualReview.length}.`);
}
const EXPECTED_OVERRIDE_KEYS = new Set(["wordpress-db:user:89", "wordpress-db:user:130"]);
const manualReviewKeys = new Set(manualReview.map((e) => e.sourceRecordKey));
if (manualReviewKeys.size !== EXPECTED_OVERRIDE_KEYS.size || ![...EXPECTED_OVERRIDE_KEYS].every((k) => manualReviewKeys.has(k))) {
  throw new Error(
    `MANUAL_REVIEW entries in ${planPath} no longer match the hardcoded override identities: ` +
      `expected ${[...EXPECTED_OVERRIDE_KEYS].join(", ")}, found ${[...manualReviewKeys].join(", ")}.`,
  );
}

// One or more of the 36 EXACT_LINK_CANDIDATE entries may also be one of the
// permanently-unresolved Users sourceRecordKeys (see knownBlockers.ts) —
// per explicit product decision no per-user override is permitted for
// those, so their User record can never exist. The base artifact still
// records them faithfully (they genuinely are approved candidates by the
// generic rule); `entangledWithUnresolvedUsers` flags them so
// generate-phoenix-release-manifest.ts can exclude them from the
// businesses phase's *executable* records without needing its own
// separate, potentially-divergent copy of this list — a sequential apply
// that didn't exclude them would halt on the first one forever, since its
// User dependency never resolves, and never reach the valid candidates
// after it.
const unresolvedUsersSet = new Set<string>(USERS_UNRESOLVED_SOURCE_RECORD_KEYS);
const entangledWithUnresolvedUsers = exactCandidates
  .map((e) => e.sourceRecordKey)
  .filter((key) => unresolvedUsersSet.has(key));

const baseArtifact = {
  schemaVersion: 1,
  artifactId: "phoenix-business-ownership-base-2026-07-30",
  description:
    "Generic business-ownership + BUSINESS_OWNER elevation scope: exactly the 36 EXACT_LINK_CANDIDATE users " +
    "already written in USERS Slice 7 (golden, wordpress-db:user:38) and Slice 8 (batch, remaining 35). " +
    "Filtered verbatim from the committed business-ownership-plan.json classification, not recomputed.",
  sourceEvidence: {
    path: planPath,
    filterRule: 'action === "EXACT_LINK_CANDIDATE"',
  },
  expectedAction: "CREATE" as const,
  expectedRoleTransition: "USER_TO_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE" as const,
  ownershipRule: "GENERIC_ALL_OWNED_PLACES",
  entries: exactCandidates.map((entry) => ({
    sourceRecordKey: entry.sourceRecordKey,
    roleRecommendation: entry.roleRecommendation,
    evidenceHash: entry.evidenceHash,
  })),
  recordCount: exactCandidates.length,
  entangledWithUnresolvedUsers,
};

const overridesArtifact = {
  schemaVersion: 1,
  artifactId: "phoenix-business-ownership-overrides-2026-07-30",
  description:
    "Manual override scope for the 2 partial-coverage business-linked users excluded from the generic " +
    "36-candidate rule (business-ownership-plan.json classifies both as MANUAL_REVIEW / NO_TARGET_BUSINESS). " +
    "Approved Place scope is copied verbatim from the committed Slice 12/13 script constants — not " +
    "recomputed from current WordPress, DEV or LOCAL state. Missing, extra, or reordered Place IDs versus " +
    "this exact list must fail closed before any write.",
  entries: [
    {
      sourceRecordKey: "wordpress-db:user:130",
      legacyUserId: 130,
      approvedPlaceSourcePostIds: ["18886"],
      excludedPlaceSourcePostIds: ["30605"],
      excludedPlaceSourcePostIdsRationale: "draft status, never imported",
      expectedAction: "CREATE" as const,
      expectedRoleTransition: "USER_TO_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE" as const,
      rationale:
        "Deliberately reduced to the single publish-status owned Place; the user's other owned Place " +
        "(wordpress-db:places:30605, draft) is intentionally excluded and was never imported.",
      provenance: {
        scriptPath: "scripts/migration-partial-coverage-ownership-golden.ts",
        commitSha: "0c844aad7034269134ae230b0ff3d83452fafd71",
        sliceName: "USERS Slice 12",
        sourceReference: planPath,
      },
    },
    {
      sourceRecordKey: "wordpress-db:user:89",
      legacyUserId: 89,
      approvedPlaceSourcePostIds: [
        "437", "5457", "5492", "5515", "5528", "5579", "12447", "12923", "13311",
        "13317", "13322", "13323", "13324", "13327", "13331", "45846", "48372",
        "49952", "49977",
      ],
      excludedPlaceSourcePostIdsCount: 195,
      excludedPlaceSourcePostIdsRationale: "187 unpublished + 8 draft, never imported",
      expectedAction: "CREATE" as const,
      expectedRoleTransition: "USER_TO_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE" as const,
      rationale:
        "Deliberately reduced to the 19 already-migrated publish-status Places out of 214 owned in " +
        "WordPress; the other 195 (187 unpublished, 8 draft) are intentionally excluded and were never " +
        "imported.",
      provenance: {
        scriptPath: "scripts/migration-partial-coverage-ownership-user89.ts",
        commitSha: "c0405ab30efb5640a8aba6976bddd51df94dfb8a",
        sliceName: "USERS Slice 13",
        sourceReference: planPath,
      },
    },
  ],
  recordCount: 2,
  totalApprovedPlaceCount: 1 + 19,
};

if (overridesArtifact.entries[1].approvedPlaceSourcePostIds.length !== 19) {
  throw new Error("user:89 approved Place list must be exactly 19 entries.");
}
if (new Set(overridesArtifact.entries[1].approvedPlaceSourcePostIds).size !== 19) {
  throw new Error("user:89 approved Place list contains duplicates.");
}

const basePath = "docs/migration/manifests/phoenix-business-ownership-base-2026-07-30.json";
const overridesPath = "docs/migration/manifests/phoenix-business-ownership-overrides-2026-07-30.json";
writeFileSync(basePath, `${JSON.stringify(baseArtifact, null, 2)}\n`);
writeFileSync(overridesPath, `${JSON.stringify(overridesArtifact, null, 2)}\n`);
console.log(basePath, "->", baseArtifact.recordCount, "entries");
console.log(overridesPath, "->", overridesArtifact.recordCount, "entries,", overridesArtifact.totalApprovedPlaceCount, "approved Places");
