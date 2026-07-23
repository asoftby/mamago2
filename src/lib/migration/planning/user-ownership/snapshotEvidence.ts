import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loaders over the immutable USERS source snapshot
 * (`/tmp/scratchpad/users/` by convention, passed in as `snapshotRoot`).
 * These functions only ever read files that already exist inside the
 * snapshot — no SSH, no WordPress query, no new source discovery. They
 * strip WordPress PII (email, login, display name) at the boundary: only
 * counts, booleans, and WordPress post IDs (not personal data) cross out
 * of this module.
 */

const MANUAL_CLASS_KEY = "H";
const BUSINESS_CLASS_KEY = "C";
const AUTHOR_CLASS_KEY = "D";

interface ClassificationClass {
  count: number;
  sourceRecordKeys: readonly string[];
}

interface ClassificationFile {
  sourceScope: number;
  classes: Record<string, ClassificationClass>;
  reconciliation: { sumOfClasses: number; equalsSourceScope: boolean; cleanScope: number; blockedOrManualScope: number };
}

export interface ClassificationSets {
  sourceScope: number;
  cleanScope: number;
  manualPrivileged: readonly string[];
  businessLinked: readonly string[];
  contentAuthor: readonly string[];
}

export function loadClassification(snapshotRoot: string): ClassificationSets {
  const raw = readFileSync(join(snapshotRoot, "analysis/users-classification.json"), "utf8");
  const parsed = JSON.parse(raw) as ClassificationFile;
  const manualPrivileged = [...parsed.classes[MANUAL_CLASS_KEY].sourceRecordKeys].sort();
  const businessLinked = [...parsed.classes[BUSINESS_CLASS_KEY].sourceRecordKeys].sort();
  const contentAuthor = [...parsed.classes[AUTHOR_CLASS_KEY].sourceRecordKeys].sort();
  return { sourceScope: parsed.sourceScope, cleanScope: parsed.reconciliation.cleanScope, manualPrivileged, businessLinked, contentAuthor };
}

interface InventoryUserRecord {
  sourceRecordKey: string;
  roles: readonly string[];
  identityConfidence: string;
  emailCollision: boolean;
  existingLocalUserCandidates: ReadonlyArray<{ role: string; status: string }>;
  ownership: {
    authoredCounts: Record<string, number>;
    placePostIds: readonly string[];
    offerPostIds: readonly string[];
    articlePostIds: readonly string[];
    routePostIds: readonly string[];
  };
}

interface InventoryFile {
  users: readonly InventoryUserRecord[];
}

function loadInventoryByKey(snapshotRoot: string): Map<string, InventoryUserRecord> {
  const raw = readFileSync(join(snapshotRoot, "analysis/users-inventory.json"), "utf8");
  const parsed = JSON.parse(raw) as InventoryFile;
  return new Map(parsed.users.map(user => [user.sourceRecordKey, user]));
}

export interface ManualSourceEvidence {
  sourceRecordKey: string;
  roles: readonly string[];
  identityConfidence: string;
  emailCollision: boolean;
  localCandidateRoles: readonly string[];
  ownershipEvidenceCount: number;
  authorshipEvidenceCount: number;
}

/** Sanitised evidence for the 15 manual/privileged users — no email, login, name, or capability payloads. */
export function loadManualEvidence(snapshotRoot: string, sourceRecordKeys: readonly string[]): readonly ManualSourceEvidence[] {
  const byKey = loadInventoryByKey(snapshotRoot);
  return sourceRecordKeys.map(key => {
    const user = byKey.get(key);
    if (!user) throw new Error(`Manual/privileged sourceRecordKey "${key}" is missing from the source inventory snapshot.`);
    const ownershipEvidenceCount = user.ownership.placePostIds.length + user.ownership.offerPostIds.length;
    const authorshipEvidenceCount = user.ownership.articlePostIds.length + user.ownership.routePostIds.length + (user.ownership.authoredCounts.events ?? 0);
    return {
      sourceRecordKey: key,
      roles: [...user.roles],
      identityConfidence: user.identityConfidence,
      emailCollision: user.emailCollision,
      localCandidateRoles: user.existingLocalUserCandidates.map(candidate => candidate.role),
      ownershipEvidenceCount,
      authorshipEvidenceCount,
    };
  });
}

export interface BusinessOwnershipSourceEvidence {
  sourceRecordKey: string;
  /** WordPress `places` post IDs authored by this user — kept in-process only, never written to a committed manifest. */
  placePostIds: readonly string[];
}

export function loadBusinessOwnershipEvidence(snapshotRoot: string, sourceRecordKeys: readonly string[]): readonly BusinessOwnershipSourceEvidence[] {
  const byKey = loadInventoryByKey(snapshotRoot);
  return sourceRecordKeys.map(key => {
    const user = byKey.get(key);
    if (!user) throw new Error(`Business-linked sourceRecordKey "${key}" is missing from the source inventory snapshot.`);
    return { sourceRecordKey: key, placePostIds: [...user.ownership.placePostIds] };
  });
}

const CONTENT_AUTHORSHIP_SECTION = "SECTION content_authorship";
const NEXT_SECTION_PREFIX = "SECTION ";

/** post_type -> the migrated entity type it becomes, per `src/lib/migration/adapters/wordpress-db`. */
const SUPPORTED_CONTENT_POST_TYPES: Record<string, "ARTICLE" | "ROUTE" | "ACTIVITY"> = {
  post: "ARTICLE",
  routes: "ROUTE",
  events: "ACTIVITY",
};

export interface AuthoredContentItem {
  postId: string;
  postType: string;
  contentType: "ARTICLE" | "ROUTE" | "ACTIVITY" | "UNSUPPORTED";
}

export interface ContentAuthorshipSourceEvidence {
  sourceRecordKey: string;
  authoredItems: readonly AuthoredContentItem[];
}

const NON_CONTENT_POST_TYPES = new Set([
  "profile",
  "attachment",
  "revision",
  "nav_menu_item",
  "oembed_cache",
  "wp_global_styles",
  "wp_navigation",
  "wpr_templates",
  "custom_css",
  "popup",
  "popup_theme",
  "elementor_library",
  "user_request",
]);

/**
 * Parses the immutable `content_authorship` section of the captured
 * WordPress TSV once and returns, for each requested WordPress user ID,
 * every authored post classified as a supported content type (article /
 * route / activity) or `UNSUPPORTED` for anything else that isn't
 * WordPress bookkeeping noise. Reads the snapshot file only — no query,
 * no SSH.
 */
export function loadContentAuthorshipEvidence(snapshotRoot: string, legacyUserIds: readonly number[]): readonly ContentAuthorshipSourceEvidence[] {
  const path = join(snapshotRoot, "raw/users-source-capture.tsv");
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const sectionStart = lines.findIndex(line => line.trim() === CONTENT_AUTHORSHIP_SECTION);
  if (sectionStart === -1) throw new Error("content_authorship section not found in source snapshot TSV.");
  const header = lines[sectionStart + 1].split("\t");
  const authorIndex = header.indexOf("post_author");
  const idIndex = header.indexOf("ID");
  const typeIndex = header.indexOf("post_type");
  if (authorIndex === -1 || idIndex === -1 || typeIndex === -1) throw new Error("content_authorship section is missing expected columns.");

  const wanted = new Set(legacyUserIds.map(String));
  const byUserId = new Map<string, AuthoredContentItem[]>();
  for (let i = sectionStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    if (line.startsWith(NEXT_SECTION_PREFIX) || line.trim() === "snapshot_section") break;
    const cols = line.split("\t");
    const authorId = cols[authorIndex];
    if (!wanted.has(authorId)) continue;
    const postType = cols[typeIndex];
    if (NON_CONTENT_POST_TYPES.has(postType)) continue;
    const contentType = SUPPORTED_CONTENT_POST_TYPES[postType] ?? "UNSUPPORTED";
    const items = byUserId.get(authorId) ?? [];
    items.push({ postId: cols[idIndex], postType, contentType });
    byUserId.set(authorId, items);
  }

  return legacyUserIds.map(legacyUserId => ({
    sourceRecordKey: `wordpress-db:user:${legacyUserId}`,
    authoredItems: byUserId.get(String(legacyUserId)) ?? [],
  }));
}

export function legacyUserIdFromSourceRecordKey(sourceRecordKey: string): number {
  const match = /^wordpress-db:user:(\d+)$/.exec(sourceRecordKey);
  if (!match) throw new Error(`Invalid user sourceRecordKey "${sourceRecordKey}".`);
  return Number(match[1]);
}
