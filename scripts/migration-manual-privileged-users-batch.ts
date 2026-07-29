/**
 * USERS manual/privileged dispositions — founder-authorized final slice.
 *
 * Scope: exactly the 14 legacy WordPress users that are neither the kept
 * ADMIN (`wordpress-db:user:1`) nor the two already-migrated content-author
 * users (`wordpress-db:user:521`, `wordpress-db:user:91`). Founder rule:
 * legacy WordPress Administrator/Editor/Author capabilities are NEVER
 * inherited — every one of the 14 migrates as USER/PENDING_ACTIVATION, and
 * only gets elevated to BUSINESS_OWNER if a fresh, exact, proven Place
 * ownership link resolves after the User itself exists.
 *
 * The original Slice 4/6 raw 579-user snapshot is lost (see
 * prelaunch-checklist.md#3.7), so `loadUserSourceCandidate`'s
 * hash-pinned loader cannot be reused here. This script performs its own
 * bounded, exact-key, read-only WordPress capture (14 users only — no
 * broad re-discovery) and builds `UserSourceCandidate` objects directly,
 * then reuses the exact same generic, already-proven commit primitives
 * every other Users slice used: `planUserMigration`/`writeUserMigration`
 * (Slice 4/5), `planBusinessOwnershipGolden`/`writeBusinessOwnershipGolden`
 * (Slice 7) and `planRoleElevationGolden`/`writeRoleElevationGolden`
 * (Slice 9) — unmodified, imported as library functions.
 *
 * Phases (`--phase capture|preview|commit|rerun`):
 *   capture — SSH+mysql read-only fetch, writes the immutable snapshot
 *             under ~/.mamago2/migration-snapshots/users/manual-privileged-14/
 *             (0700/0600) and a fixed manifest under docs/migration/
 *             (canonical hashes + expected actions, before any write).
 *   preview — loads the snapshot already on disk, runs planUserMigration
 *             for all 14, zero writes.
 *   commit  — sequential writeUserMigration for all 14 (stop-on-first-error,
 *             no rollback of an already-written prefix), then a read-only
 *             re-check of business ownership evidence for every newly
 *             created User and, only where EXACT_LINK_CANDIDATE resolves,
 *             the ownership + role-elevation writes.
 *   rerun   — re-runs the exact same plan; expects SKIP_UNCHANGED /
 *             ALREADY_SATISFIED everywhere, zero deltas.
 */
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  maskEmail,
  normalizeUserCandidate,
  planUserMigration,
  writeUserMigration,
  type UserSourceCandidate,
} from "../src/lib/migration/commit/user";
import {
  planBusinessOwnershipGolden,
  writeBusinessOwnershipGolden,
  type BusinessOwnershipGoldenCandidate,
} from "../src/lib/migration/commit/business-ownership/BusinessOwnershipGoldenRunner";
import {
  planRoleElevationGolden,
  writeRoleElevationGolden,
} from "../src/lib/migration/commit/business-ownership/RoleElevationGoldenRunner";
import { assertLocalDatabaseUrl } from "./migration-user-vertical-slice";

// ---------------------------------------------------------------------------
// Fixed scope — exactly the 14 founder-authorized legacy user IDs. Not a
// CLI argument: this script must not be pointable at any other user.
// ---------------------------------------------------------------------------
const LEGACY_USER_IDS = [108, 123, 134, 21, 438, 439, 51, 52, 6, 129, 27, 16, 4, 14] as const;

const CONTENT_POST_TYPES = ["places", "post", "routes", "events", "hb-programs", "services"] as const;

const SNAPSHOT_ROOT = "/Users/shapovalovalexey/.mamago2/migration-snapshots/users/manual-privileged-14";
const MANIFEST_PATH = join(process.cwd(), "docs/migration/users-manual-privileged-14-manifest.json");

interface RawUserRow {
  ID: number;
  user_email: string;
  user_login: string;
  display_name: string;
  user_registered: string;
}
interface RawUserMetaRow {
  user_id: number;
  meta_key: string;
  meta_value: string;
}
interface RawPostRow {
  ID: number;
  post_author: number;
  post_type: string;
  post_status: string;
}

interface CaptureFile {
  capturedAt: string;
  legacyUserIds: readonly number[];
  users: RawUserRow[];
  userMeta: RawUserMetaRow[];
  posts: RawPostRow[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(",");
}

async function runCapture(): Promise<void> {
  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, true);
  const executor = createWordPressSshMysqlExecutor(wpConfig);

  const ids = [...LEGACY_USER_IDS];

  const users = await executor<RawUserRow>(
    `SELECT ID, user_email, user_login, display_name, user_registered FROM wp_users WHERE ID IN (${placeholders(ids.length)}) ORDER BY ID`,
    ids,
  );
  const userMeta = await executor<RawUserMetaRow>(
    `SELECT user_id, meta_key, meta_value FROM wp_usermeta WHERE user_id IN (${placeholders(ids.length)}) AND meta_key IN ('wp_capabilities','first_name','last_name') ORDER BY user_id, meta_key`,
    ids,
  );
  const posts = await executor<RawPostRow>(
    `SELECT ID, post_author, post_type, post_status FROM wp_posts WHERE post_author IN (${placeholders(ids.length)}) AND post_status = 'publish' AND post_type IN (${placeholders(CONTENT_POST_TYPES.length)}) ORDER BY post_author, post_type, ID`,
    [...ids, ...CONTENT_POST_TYPES],
  );

  if (users.length !== ids.length) {
    const found = new Set(users.map(u => u.ID));
    const missing = ids.filter(id => !found.has(id));
    throw new Error(`CAPTURE_INCOMPLETE: missing wp_users rows for legacy IDs: ${missing.join(", ")}`);
  }

  const capture: CaptureFile = { capturedAt: new Date().toISOString(), legacyUserIds: ids, users, userMeta, posts };
  const raw = JSON.stringify(capture, null, 2);
  const rawHash = sha256(raw);

  mkdirSync(SNAPSHOT_ROOT, { recursive: true, mode: 0o700 });
  chmodSync(SNAPSHOT_ROOT, 0o700);
  const rawPath = join(SNAPSHOT_ROOT, "raw-capture.json");
  writeFileSync(rawPath, raw, { mode: 0o600 });
  chmodSync(rawPath, 0o600);

  console.log(JSON.stringify({ phase: "capture", legacyUserIds: ids, usersFetched: users.length, userMetaRows: userMeta.length, postRows: posts.length, snapshotPath: rawPath, sha256: rawHash }, null, 2));
}

// ---------------------------------------------------------------------------
// Candidate building — from the bounded capture, no legacy-role signal is
// ever consulted for classification/exclusion (founder rule). businessLinked
// is set purely from *published* `places` authorship evidence in this fresh
// capture; it only ever defers to the golden ownership check post-creation,
// never elevates role itself.
// ---------------------------------------------------------------------------

function loadCapture(): { capture: CaptureFile; sha256: string } {
  const rawPath = join(SNAPSHOT_ROOT, "raw-capture.json");
  const raw = readFileSync(rawPath, "utf8");
  return { capture: JSON.parse(raw) as CaptureFile, sha256: sha256(raw) };
}

interface DerivedUser {
  legacyUserId: number;
  sourceRecordKey: string;
  candidate: UserSourceCandidate;
  placePostIds: string[];
  otherAuthoredCount: number;
  capabilitiesRaw: string | null;
}

function buildCandidates(capture: CaptureFile, snapshotHash: string): DerivedUser[] {
  const metaByUser = new Map<number, RawUserMetaRow[]>();
  for (const row of capture.userMeta) {
    const list = metaByUser.get(row.user_id) ?? [];
    list.push(row);
    metaByUser.set(row.user_id, list);
  }
  const postsByUser = new Map<number, RawPostRow[]>();
  for (const row of capture.posts) {
    const list = postsByUser.get(row.post_author) ?? [];
    list.push(row);
    postsByUser.set(row.post_author, list);
  }

  return capture.users.map(user => {
    const meta = metaByUser.get(user.ID) ?? [];
    const firstName = meta.find(m => m.meta_key === "first_name")?.meta_value || null;
    const lastName = meta.find(m => m.meta_key === "last_name")?.meta_value || null;
    const capabilitiesRaw = meta.find(m => m.meta_key === "wp_capabilities")?.meta_value ?? null;

    const authored = postsByUser.get(user.ID) ?? [];
    const placePostIds = authored.filter(p => p.post_type === "places").map(p => String(p.ID));
    const otherAuthoredCount = authored.filter(p => p.post_type !== "places").length;
    const businessLinked = placePostIds.length > 0;

    const sourceRecordKey = `wordpress-db:user:${user.ID}`;
    const sourceCandidate: UserSourceCandidate = {
      sourceRecordKey: sourceRecordKey as UserSourceCandidate["sourceRecordKey"],
      sourceSystem: "wordpress-db",
      legacyUserId: user.ID,
      email: user.user_email,
      displayName: user.display_name || null,
      firstName,
      lastName,
      phone: null,
      sourceCreatedAt: user.user_registered || null,
      legacyRoles: !businessLinked && otherAuthoredCount > 0 ? ["content-author-evidence"] : [],
      legacyPasswordPresent: false,
      businessLinked,
      businessEvidence: { exactOwnership: false, placeCount: placePostIds.length },
      privilegedCollision: false,
      profileMediaReferencePresent: false,
      sourceHash: snapshotHash,
    };

    return { legacyUserId: user.ID, sourceRecordKey, candidate: sourceCandidate, placePostIds, otherAuthoredCount, capabilitiesRaw };
  });
}

interface ManifestEntry { sourceRecordKey: string; emailMask: string | null; placePostIdsCount: number; otherAuthoredCount: number; action: string; reason: string | null; canonicalHash: string }
interface ManifestFile { snapshotSha256: string; entries: ManifestEntry[] }

async function runPreview(prisma: PrismaClient, options: { writeManifestFile: boolean } = { writeManifestFile: false }): Promise<DerivedUser[]> {
  const { capture, sha256: snapshotHash } = loadCapture();
  const derived = buildCandidates(capture, snapshotHash);
  const manifestEntries: ManifestEntry[] = [];
  for (const entry of derived) {
    const normalized = normalizeUserCandidate(entry.candidate);
    const plan = await planUserMigration(prisma, normalized);
    console.log(JSON.stringify({
      phase: "preview",
      sourceRecordKey: entry.sourceRecordKey,
      emailMask: maskEmail(normalized.normalizedEmail),
      classification: normalized.classification,
      placePostIds: entry.placePostIds,
      otherAuthoredCount: entry.otherAuthoredCount,
      legacyCapabilitiesRaw: entry.capabilitiesRaw,
      action: plan.action,
      reason: plan.reason,
      canonicalHash: plan.canonicalHash,
      expectedRole: "USER",
      expectedStatus: "PENDING_ACTIVATION",
    }));
    manifestEntries.push({
      sourceRecordKey: entry.sourceRecordKey,
      emailMask: maskEmail(normalized.normalizedEmail),
      placePostIdsCount: entry.placePostIds.length,
      otherAuthoredCount: entry.otherAuthoredCount,
      action: plan.action,
      reason: plan.reason,
      canonicalHash: plan.canonicalHash,
    });
  }
  if (options.writeManifestFile) writeManifest(manifestEntries, snapshotHash);
  return derived;
}

function writeManifest(entries: ManifestEntry[], snapshotHash: string): void {
  const manifest = {
    phase: "USERS manual/privileged — founder-authorized final disposition",
    scope: "exactly the 14 legacy users neither kept ADMIN (user:1) nor already-migrated user:521/user:91",
    founderRule: "no legacy WordPress role (Administrator/Editor/Author) is ever inherited; every record migrates as USER/PENDING_ACTIVATION; BUSINESS_OWNER only after exact proven Place ownership",
    snapshotSha256: snapshotHash,
    executionPolicy: { sequential: true, stopOnFirstError: true, reruns: 1 },
    entries,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ phase: "manifest", path: MANIFEST_PATH, entryCount: entries.length }));
}

function loadManifest(): ManifestFile {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Fixed manifest missing at ${MANIFEST_PATH} — run --phase preview first (Rule 7: manifest must exist before any write).`);
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as ManifestFile;
}

async function captureAudit(prisma: PrismaClient) {
  const [user, session, token, business, place, offer, article, route, activity, media, lineage, record, admins] = await Promise.all([
    prisma.user.count(),
    prisma.session.count(),
    prisma.userActionToken.count(),
    prisma.business.count(),
    prisma.place.count(),
    prisma.offer.count(),
    prisma.article.count(),
    prisma.route.count(),
    prisma.activity.count(),
    prisma.mediaAsset.count(),
    prisma.migrationLineage.count(),
    prisma.migrationRecord.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  return { user, session, token, business, place, offer, article, route, activity, media, lineage, record, admins };
}

async function runCommit(prisma: PrismaClient): Promise<void> {
  const { capture, sha256: snapshotHash } = loadCapture();
  const derived = buildCandidates(capture, snapshotHash);
  const manifest = loadManifest();
  if (manifest.snapshotSha256 !== snapshotHash) {
    throw new Error(`MANIFEST_SNAPSHOT_MISMATCH: fixed manifest was built from a different snapshot hash (${manifest.snapshotSha256}) than the one on disk now (${snapshotHash}).`);
  }
  const manifestBySourceKey = new Map(manifest.entries.map(entry => [entry.sourceRecordKey, entry]));

  const baseline = await captureAudit(prisma);
  console.log(JSON.stringify({ phase: "commit-baseline", ...baseline }));

  const createdUsers: Array<{ sourceRecordKey: string; targetId: string }> = [];
  let stoppedEarly: string | null = null;

  for (const entry of derived) {
    const normalized = normalizeUserCandidate(entry.candidate);
    const plan = await planUserMigration(prisma, normalized);

    const frozen = manifestBySourceKey.get(entry.sourceRecordKey);
    if (!frozen) throw new Error(`MANIFEST_ENTRY_MISSING: ${entry.sourceRecordKey} is not in the fixed manifest.`);
    if (frozen.canonicalHash !== plan.canonicalHash || frozen.action !== plan.action) {
      throw new Error(`MANIFEST_DRIFT: ${entry.sourceRecordKey} plan changed since the fixed manifest was written (manifest: ${frozen.action}/${frozen.canonicalHash}, now: ${plan.action}/${plan.canonicalHash}).`);
    }

    if (plan.action === "BLOCKED") {
      console.log(JSON.stringify({ phase: "commit", sourceRecordKey: entry.sourceRecordKey, action: "BLOCKED", reason: plan.reason }));
      stoppedEarly = `${entry.sourceRecordKey}:${plan.reason}`;
      break;
    }

    try {
      const result = await writeUserMigration(prisma, plan);
      console.log(JSON.stringify({ phase: "commit", sourceRecordKey: entry.sourceRecordKey, action: result.action, targetId: result.targetId }));
      if (result.action === "CREATE" && result.targetId) createdUsers.push({ sourceRecordKey: entry.sourceRecordKey, targetId: result.targetId });
    } catch (error) {
      console.error(JSON.stringify({ phase: "commit", sourceRecordKey: entry.sourceRecordKey, error: error instanceof Error ? error.message : String(error) }));
      stoppedEarly = `${entry.sourceRecordKey}:WRITE_ERROR`;
      break;
    }
  }

  if (stoppedEarly) {
    throw new Error(`STOP_ON_FIRST_ERROR: ${stoppedEarly}`);
  }

  // Post-create ownership + role elevation — read-only check first, write
  // only where the exact golden mechanism itself resolves CREATE/ELEVATE.
  const ownershipResults: unknown[] = [];
  for (const entry of derived) {
    if (entry.placePostIds.length === 0) continue;
    const ownershipCandidate: BusinessOwnershipGoldenCandidate = {
      sourceRecordKey: entry.sourceRecordKey,
      legacyUserId: entry.legacyUserId,
      placeSourcePostIds: entry.placePostIds,
    };
    const ownPlan = await planBusinessOwnershipGolden(prisma, ownershipCandidate);
    console.log(JSON.stringify({ phase: "ownership-plan", sourceRecordKey: entry.sourceRecordKey, placePostIds: entry.placePostIds, action: ownPlan.action, reason: ownPlan.reason }));
    let ownWriteResult: unknown = null;
    if (ownPlan.action === "CREATE") {
      ownWriteResult = await writeBusinessOwnershipGolden(prisma, ownPlan);
      console.log(JSON.stringify({ phase: "ownership-write", sourceRecordKey: entry.sourceRecordKey, result: ownWriteResult }));
    }

    let roleResult: unknown = null;
    if (ownPlan.action === "CREATE" || ownPlan.action === "SKIP_UNCHANGED") {
      const rolePlan = await planRoleElevationGolden(prisma, { sourceRecordKey: entry.sourceRecordKey });
      console.log(JSON.stringify({ phase: "role-plan", sourceRecordKey: entry.sourceRecordKey, action: rolePlan.action, reason: rolePlan.reason }));
      if (rolePlan.action === "ELEVATE") {
        roleResult = await writeRoleElevationGolden(prisma, rolePlan);
        console.log(JSON.stringify({ phase: "role-write", sourceRecordKey: entry.sourceRecordKey, result: roleResult }));
      }
    }
    ownershipResults.push({ sourceRecordKey: entry.sourceRecordKey, ownershipAction: ownPlan.action, ownershipReason: ownPlan.reason, roleWrite: roleResult });
  }

  const after = await captureAudit(prisma);
  console.log(JSON.stringify({ phase: "commit-audit", baseline, after, delta: {
    user: after.user - baseline.user,
    session: after.session - baseline.session,
    token: after.token - baseline.token,
    business: after.business - baseline.business,
    place: after.place - baseline.place,
    lineage: after.lineage - baseline.lineage,
    record: after.record - baseline.record,
    admins: after.admins - baseline.admins,
  } }));
  console.log(JSON.stringify({ phase: "commit-summary", createdUsers, ownershipResults }));
}

async function runRerun(prisma: PrismaClient): Promise<void> {
  const { capture, sha256: snapshotHash } = loadCapture();
  const derived = buildCandidates(capture, snapshotHash);
  const baseline = await captureAudit(prisma);

  for (const entry of derived) {
    const normalized = normalizeUserCandidate(entry.candidate);
    const plan = await planUserMigration(prisma, normalized);
    console.log(JSON.stringify({ phase: "rerun-user", sourceRecordKey: entry.sourceRecordKey, action: plan.action, reason: plan.reason }));
    if (plan.action !== "SKIP_UNCHANGED" && plan.action !== "BLOCKED") {
      throw new Error(`RERUN_UNEXPECTED_ACTION:${entry.sourceRecordKey}:${plan.action}`);
    }

    if (entry.placePostIds.length > 0) {
      const ownPlan = await planBusinessOwnershipGolden(prisma, { sourceRecordKey: entry.sourceRecordKey, legacyUserId: entry.legacyUserId, placeSourcePostIds: entry.placePostIds });
      console.log(JSON.stringify({ phase: "rerun-ownership", sourceRecordKey: entry.sourceRecordKey, action: ownPlan.action, reason: ownPlan.reason }));
      const rolePlan = await planRoleElevationGolden(prisma, { sourceRecordKey: entry.sourceRecordKey });
      console.log(JSON.stringify({ phase: "rerun-role", sourceRecordKey: entry.sourceRecordKey, action: rolePlan.action, reason: rolePlan.reason }));
    }
  }

  const after = await captureAudit(prisma);
  const delta = Object.fromEntries(Object.keys(baseline).map(key => [key, (after as Record<string, number>)[key] - (baseline as Record<string, number>)[key]]));
  console.log(JSON.stringify({ phase: "rerun-audit", baseline, after, delta }));
  if (Object.values(delta).some(value => value !== 0)) {
    throw new Error(`RERUN_UNEXPECTED_DELTA: ${JSON.stringify(delta)}`);
  }
}

function parsePhase(argv: readonly string[]): "capture" | "preview" | "commit" | "rerun" {
  const index = argv.indexOf("--phase");
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value !== "capture" && value !== "preview" && value !== "commit" && value !== "rerun") {
    throw new Error("Requires --phase capture|preview|commit|rerun.");
  }
  return value;
}

async function main(): Promise<void> {
  const phase = parsePhase(process.argv.slice(2));
  assertLocalDatabaseUrl(process.env.DATABASE_URL);

  if (phase === "capture") {
    if (existsSync(join(SNAPSHOT_ROOT, "raw-capture.json")) && !process.argv.includes("--force-recapture")) {
      throw new Error(`Snapshot already exists at ${SNAPSHOT_ROOT}/raw-capture.json — refusing silent overwrite. Pass --force-recapture to intentionally replace it.`);
    }
    await runCapture();
    return;
  }

  const prisma = new PrismaClient();
  try {
    if (phase === "preview") {
      const derived = await runPreview(prisma, { writeManifestFile: true });
      void derived;
    } else if (phase === "commit") {
      await runCommit(prisma);
    } else if (phase === "rerun") {
      await runRerun(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
