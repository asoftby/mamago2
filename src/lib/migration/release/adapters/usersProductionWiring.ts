import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";

import { normalizeUserCandidate, planUserMigration, writeUserMigration, type UserSourceCandidate } from "../../commit/user/UserMigrationVerticalSlice";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS } from "../knownBlockers";
import type { UsersMigrationDependencies } from "./usersAdapter";

export const PHOENIX_RELEASE_ARTIFACT_ROOT_ENV = "PHOENIX_RELEASE_ARTIFACT_ROOT";
const USER_CAPTURE_RELATIVE_PATH = "users/capture.json";
const SUPPORTED_SCHEMA_VERSION = 1;

interface FrozenUserRecord {
  sourceRecordKey: string;
  sourceSystem: string;
  legacyUserId: number;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  sourceCreatedAt: string;
  legacyRoles: string[];
  legacyPasswordPresent: boolean;
  businessLinked: boolean;
  businessEvidence: { exactOwnership: boolean; placeCount: number };
  privilegedCollision: boolean;
  profileMediaReferencePresent: boolean;
}

interface FrozenUserCapture {
  schemaVersion: number;
  entity: string;
  capturedAt: string;
  records: FrozenUserRecord[];
}

export const PHOENIX_PLATFORM_OWNER_EMAIL_ENV = "PHOENIX_PLATFORM_OWNER_EMAIL";
export const PHOENIX_MANUAL_PRIVILEGED_CAPTURE_ENV = "PHOENIX_MANUAL_PRIVILEGED_CAPTURE";
const PLATFORM_OWNER_KEY = "wordpress-db:user:1";
const PLATFORM_OWNER_ADOPTION_HASH = "founder-decision:WP_USER_1_MAP_TO_PLATFORM_OWNER";
const REUSED_TRACK_KEY = "wordpress-db:user:129";
const REUSED_MANUAL_TRACK_KEYS = new Set([REUSED_TRACK_KEY, "wordpress-db:user:27"]);

interface ManualPrivilegedCapture {
  users: Array<{ ID: number; user_email: string; display_name: string; user_registered: string }>;
  userMeta: Array<{ user_id: number; meta_key: string; meta_value: string }>;
  posts: Array<{ ID: number; post_author: number; post_type: string; post_status: string }>;
}

function failed(code: string): Error {
  return new Error(`FAILED:${code}`);
}
function releaseBlocked(code: string): Error {
  return new Error(`RELEASE_BLOCKED:${code}`);
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

const EXCLUDED_USER_KEYS = new Set<string>(USERS_UNRESOLVED_SOURCE_RECORD_KEYS);

/**
 * Reads the immutable private Phoenix Users capture — raw email/name/
 * registration-date/role-capability fields only, no reconstruction of the
 * historical A/C/D/H classification pipeline. `businessLinked` reflects
 * membership in the already-approved committed Business ownership
 * artifacts (base + overrides), not a freshly reproduced classification.
 * No password/session/activation-token data is ever read or stored here
 * (`buildUserDraft` in `UserMigrationVerticalSlice.ts` always sets
 * `passwordHash: null`, `role: "USER"` unconditionally, regardless of
 * what `legacyRoles` says — the ADMIN check below is defense in depth on
 * the capture itself, not something the writer depends on).
 */
export class FrozenUserSourceRepository {
  private capture: FrozenUserCapture | null = null;

  constructor(
    private readonly artifactRoot: string,
    private readonly expectedArtifactSha256: string,
  ) {
    if (!artifactRoot.trim()) throw failed(`MISSING_${PHOENIX_RELEASE_ARTIFACT_ROOT_ENV}`);
    if (!/^[a-f0-9]{64}$/i.test(expectedArtifactSha256)) throw failed("INVALID_USER_ARTIFACT_SHA256");
  }

  static fromEnvironment(expectedArtifactSha256: string, env: NodeJS.ProcessEnv = process.env): FrozenUserSourceRepository {
    return new FrozenUserSourceRepository(env[PHOENIX_RELEASE_ARTIFACT_ROOT_ENV] ?? "", expectedArtifactSha256);
  }

  loadSourceCandidate(sourceRecordKey: string): UserSourceCandidate {
    if (EXCLUDED_USER_KEYS.has(sourceRecordKey)) throw failed("USER_SOURCE_RECORD_EXCLUDED");
    const capture = this.loadAndVerifyCapture();
    const matches = capture.records.filter((record) => record?.sourceRecordKey === sourceRecordKey);
    if (matches.length === 0) throw failed("USER_SOURCE_RECORD_MISSING");
    if (matches.length !== 1) throw failed("DUPLICATE_USER_SOURCE_RECORD");
    const record = matches[0];
    if (
      !nonEmptyString(record.sourceRecordKey) ||
      !nonEmptyString(record.email) ||
      typeof record.legacyUserId !== "number" ||
      !Number.isFinite(record.legacyUserId) ||
      !nonEmptyString(record.sourceCreatedAt)
    ) throw failed("MALFORMED_USER_RECORD");
    if (record.privilegedCollision) throw failed("PRIVILEGED_USER_RECORD_REJECTED");

    return {
      sourceRecordKey: record.sourceRecordKey as UserSourceCandidate["sourceRecordKey"],
      sourceSystem: "wordpress-db",
      legacyUserId: record.legacyUserId,
      email: record.email,
      displayName: record.displayName,
      firstName: record.firstName,
      lastName: record.lastName,
      phone: record.phone,
      sourceCreatedAt: record.sourceCreatedAt,
      legacyRoles: record.legacyRoles,
      legacyPasswordPresent: false,
      businessLinked: record.businessLinked,
      businessEvidence: record.businessEvidence,
      privilegedCollision: false,
      profileMediaReferencePresent: record.profileMediaReferencePresent,
      sourceHash: `frozen-user-capture-v1:${sourceRecordKey}`,
    };
  }

  private loadAndVerifyCapture(): FrozenUserCapture {
    if (this.capture) return this.capture;
    let raw: Buffer;
    try {
      raw = readFileSync(resolve(this.artifactRoot, USER_CAPTURE_RELATIVE_PATH));
    } catch {
      throw failed("USER_ARTIFACT_UNREADABLE");
    }
    const actualSha256 = createHash("sha256").update(raw).digest("hex");
    if (actualSha256 !== this.expectedArtifactSha256.toLowerCase()) throw releaseBlocked("USER_ARTIFACT_CHECKSUM_MISMATCH");
    let value: unknown;
    try {
      value = JSON.parse(raw.toString("utf8"));
    } catch {
      throw failed("MALFORMED_USER_ARTIFACT");
    }
    if (!value || typeof value !== "object") throw failed("MALFORMED_USER_ARTIFACT");
    const capture = value as Partial<FrozenUserCapture>;
    if (capture.schemaVersion !== SUPPORTED_SCHEMA_VERSION) throw failed("UNSUPPORTED_USER_ARTIFACT_VERSION");
    if (capture.entity !== "users" || !Array.isArray(capture.records)) throw failed("MALFORMED_USER_ARTIFACT");
    this.capture = capture as FrozenUserCapture;
    return this.capture;
  }
}

/**
 * Wires `UsersPhaseExecutor`'s minimal interface to the real, already-
 * proven `planUserMigration`/`writeUserMigration` (see
 * `UserMigrationVerticalSlice.integration.test.ts`: atomic create,
 * concurrent-duplicate protection, rerun SKIP_UNCHANGED, email-collision
 * blocking). `write()` re-derives the plan from the same source data
 * rather than trusting the adapter-level plan object, matching the same
 * defense-in-depth pattern used for Offers.
 */
export function createUsersDependencies(
  prisma: PrismaClient,
  rawSource: FrozenUserSourceRepository,
  sourceNamespace = "phoenix-users-dev-release",
): UsersMigrationDependencies {
  const loadReusedTrackCandidate = (sourceRecordKey: string): UserSourceCandidate => {
    const path = process.env[PHOENIX_MANUAL_PRIVILEGED_CAPTURE_ENV];
    if (!path) throw failed(`MISSING_${PHOENIX_MANUAL_PRIVILEGED_CAPTURE_ENV}`);
    let raw: Buffer;
    try { raw = readFileSync(path); } catch { throw failed("USER_129_ARTIFACT_UNREADABLE"); }
    const capture = JSON.parse(raw.toString("utf8")) as ManualPrivilegedCapture;
    const legacyUserId = Number(sourceRecordKey.split(":").at(-1));
    const matches = capture.users.filter((user) => user.ID === legacyUserId);
    if (matches.length !== 1) throw failed(matches.length ? "REUSED_USER_SOURCE_AMBIGUOUS" : "REUSED_USER_SOURCE_MISSING");
    const user = matches[0];
    const meta = capture.userMeta.filter((row) => row.user_id === legacyUserId);
    const value = (key: string) => meta.find((row) => row.meta_key === key)?.meta_value?.trim() || null;
    const placeCount = capture.posts.filter((post) => post.post_author === legacyUserId && post.post_type === "places" && post.post_status === "publish").length;
    return {
      sourceRecordKey: sourceRecordKey as UserSourceCandidate["sourceRecordKey"], sourceSystem: "wordpress-db", legacyUserId,
      email: user.user_email, displayName: user.display_name || null, firstName: value("first_name"), lastName: value("last_name"),
      phone: null, sourceCreatedAt: user.user_registered, legacyRoles: [], legacyPasswordPresent: false,
      businessLinked: true, businessEvidence: { exactOwnership: true, placeCount }, privilegedCollision: false,
      profileMediaReferencePresent: false,
      sourceHash: `manual-privileged-14:${createHash("sha256").update(raw).digest("hex")}`,
    };
  };

  const planPlatformOwnerAdoption = async () => {
    const configured = process.env[PHOENIX_PLATFORM_OWNER_EMAIL_ENV]?.trim().toLowerCase();
    if (!configured) throw failed(`MISSING_${PHOENIX_PLATFORM_OWNER_EMAIL_ENV}`);
    const matches = await prisma.user.findMany({ where: { email: { equals: configured, mode: "insensitive" } } });
    if (matches.length !== 1) throw failed(matches.length ? "PLATFORM_OWNER_IDENTITY_AMBIGUOUS" : "PLATFORM_OWNER_IDENTITY_NOT_FOUND");
    const target = matches[0];
    if (target.email.toLowerCase() !== configured || target.role !== "ADMIN" || target.deletedAt) throw failed("PLATFORM_OWNER_IDENTITY_MISMATCH");
    const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } } });
    const lineage = source ? await prisma.migrationLineage.findUnique({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: PLATFORM_OWNER_KEY, targetType: "USER", targetRole: "primary" } } }) : null;
    if (lineage && (!lineage.isActive || lineage.targetId !== target.id || lineage.lastSourceHash !== PLATFORM_OWNER_ADOPTION_HASH)) throw failed("PLATFORM_OWNER_LINEAGE_MISMATCH");
    return { action: lineage ? "SKIP_UNCHANGED" as const : "CREATE" as const, target };
  };

  const writePlatformOwnerAdoption = async () => {
    const planned = await planPlatformOwnerAdoption();
    if (planned.action !== "CREATE") throw new Error(`UNEXPECTED_REPLAN_ACTION:${planned.action}`);
    await prisma.$transaction(async (tx) => {
      const source = await tx.migrationSource.upsert({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } }, create: { adapterKey: "wordpress-db", sourceNamespace, name: "Phoenix release bundle" }, update: {} });
      const collision = await tx.migrationLineage.findUnique({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: PLATFORM_OWNER_KEY, targetType: "USER", targetRole: "primary" } } });
      if (collision) throw failed("PLATFORM_OWNER_LINEAGE_RACE");
      await tx.migrationLineage.create({ data: {
        sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceExternalId: "1", sourceStableKey: PLATFORM_OWNER_KEY,
        sourceRecordKey: PLATFORM_OWNER_KEY, targetType: "USER", targetId: planned.target.id, targetRole: "primary",
        targetNaturalKey: "platform-owner-runtime-identity", lastSourceHash: PLATFORM_OWNER_ADOPTION_HASH,
        lastPlanAction: "LINK_EXISTING", isActive: true, lastSeenAt: new Date(), lastImportedAt: new Date(),
      } });
    });
    return { action: "CREATE" as const, targetId: planned.target.id };
  };

  const load = (key: string) => REUSED_MANUAL_TRACK_KEYS.has(key) ? loadReusedTrackCandidate(key) : rawSource.loadSourceCandidate(key);
  return {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async (candidate) => {
      if (candidate.sourceRecordKey === PLATFORM_OWNER_KEY) {
        const plan = await planPlatformOwnerAdoption();
        return { action: plan.action, reason: null, draftRole: null };
      }
      const source = load(candidate.sourceRecordKey);
      const normalized = normalizeUserCandidate(source);
      const plan = await planUserMigration(prisma, normalized, sourceNamespace);
      return { action: plan.action, reason: plan.reason, draftRole: plan.draft?.role === "USER" ? "USER" : null };
    },
    write: async (candidate) => {
      if (candidate.sourceRecordKey === PLATFORM_OWNER_KEY) return writePlatformOwnerAdoption();
      const source = load(candidate.sourceRecordKey);
      const normalized = normalizeUserCandidate(source);
      const plan = await planUserMigration(prisma, normalized, sourceNamespace);
      if (plan.action !== "CREATE") throw new Error(`UNEXPECTED_REPLAN_ACTION:${plan.action}`);
      const written = await writeUserMigration(prisma, plan, sourceNamespace);
      if (written.action !== "CREATE" || !written.targetId) throw new Error("USER_WRITE_DID_NOT_CREATE");
      return { action: "CREATE", targetId: written.targetId };
    },
  };
}
