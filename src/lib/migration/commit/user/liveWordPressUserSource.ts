import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { WordPressUserRow } from "../../adapters/wordpress-db/types";
import {
  USER_SOURCE_ENTITY_TYPE,
  type UserSourceCandidate,
  type UserSourceRecordKey,
} from "./UserMigrationVerticalSlice";

export const LIVE_USER_SOURCE_NAMESPACE = "wordpress-db-live-users";
export const FOUNDER_EXCLUSIONS_PATH = "docs/migration/manifests/phoenix-users-founder-exclusions-2026-07-31.json";

export interface FounderExclusionFile {
  excludedSourceRecordKeys: readonly string[];
}

export function readFounderExclusionKeys(path: string = FOUNDER_EXCLUSIONS_PATH): ReadonlySet<string> {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as FounderExclusionFile;
  return new Set(parsed.excludedSourceRecordKeys);
}

export function liveUserSourceRecordKey(id: number): UserSourceRecordKey {
  return `wordpress-db:user:${id}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Maps a live WordPress `wp_users` row (no password column) into the
 * existing User importer candidate shape. Privileged collision is decided
 * later against the *target* User table, never from WP roles.
 */
export function userSourceCandidateFromWordPressRow(
  row: WordPressUserRow,
  options: { excludedKeys?: ReadonlySet<string> } = {},
): UserSourceCandidate {
  const sourceRecordKey = liveUserSourceRecordKey(row.ID);
  return {
    sourceRecordKey,
    sourceSystem: "wordpress-db",
    legacyUserId: row.ID,
    email: row.user_email,
    displayName: row.display_name || null,
    firstName: null,
    lastName: null,
    phone: null,
    sourceCreatedAt: row.user_registered || null,
    legacyRoles: [],
    legacyPasswordPresent: false,
    businessLinked: false,
    businessEvidence: { exactOwnership: false, placeCount: 0 },
    privilegedCollision: false,
    profileMediaReferencePresent: false,
    sourceHash: sha256(
      JSON.stringify({
        sourceRecordKey,
        email: row.user_email.trim().toLowerCase(),
        displayName: row.display_name,
        registered: row.user_registered,
        excluded: options.excludedKeys?.has(sourceRecordKey) ?? false,
      }),
    ),
  };
}

export function classifyLiveUserEligibility(
  sourceRecordKey: string,
  excludedKeys: ReadonlySet<string>,
): { eligible: boolean; exclusionReason: string | null } {
  if (excludedKeys.has(sourceRecordKey)) {
    return { eligible: false, exclusionReason: "FOUNDER_EXCLUSION" };
  }
  return { eligible: true, exclusionReason: null };
}
