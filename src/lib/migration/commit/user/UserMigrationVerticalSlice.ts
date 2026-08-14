import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { domainToASCII } from "node:url";

import { Prisma, PrismaClient, type Role, type UserStatus } from "@prisma/client";

import { normalizePhoneToE164 } from "@/lib/phone/e164";

export const USER_SOURCE_ENTITY_TYPE = "wordpress-db:user";
export const USER_SNAPSHOT_SHA256 = "569c59f2e0d0a277a98ff5f7fe418170b123c77901c5c42064cecbaa2338f5a4";
export const USER_GOLDEN_KEYS = ["wordpress-db:user:7", "wordpress-db:user:38", "wordpress-db:user:1"] as const;

export type UserSourceRecordKey = `wordpress-db:user:${number}`;
export type UserGoldenSourceRecordKey = (typeof USER_GOLDEN_KEYS)[number];
export type UserClassification = "ORDINARY" | "BUSINESS_LINKED" | "CONTENT_AUTHOR" | "PRIVILEGED_COLLISION";
export type UserMigrationAction = "CREATE" | "SKIP_UNCHANGED" | "BLOCKED";
export type UserMigrationReason =
  | "PRIVILEGED_ACCOUNT_COLLISION"
  | "EXISTING_USER_EMAIL_COLLISION"
  | "MIGRATED_USER_SOURCE_CHANGED"
  | "INVALID_EMAIL"
  | "UNSUPPORTED_ROLE_ELEVATION";

export interface UserSourceCandidate {
  sourceRecordKey: UserSourceRecordKey;
  sourceSystem: "wordpress-db";
  legacyUserId: number;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  sourceCreatedAt: string | null;
  legacyRoles: readonly string[];
  legacyPasswordPresent: boolean;
  businessLinked: boolean;
  businessEvidence: { exactOwnership: boolean; placeCount: number };
  privilegedCollision: boolean;
  profileMediaReferencePresent: boolean;
  sourceHash: string;
}

export interface NormalizedUserCandidate {
  sourceRecordKey: UserSourceRecordKey;
  sourceSystem: "wordpress-db";
  legacyUserId: number;
  normalizedEmail: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  normalizedPhone: string | null;
  sourceCreatedAt: string | null;
  classification: UserClassification;
  classificationEvidence: readonly string[];
  businessLinked: boolean;
  businessEvidence: { exactOwnership: boolean; placeCount: number };
  privilegedCollision: boolean;
  profileMediaReferencePresent: boolean;
  warnings: readonly string[];
  sourceHash: string;
}

export interface UserCreateDraft {
  email: string;
  passwordHash: null;
  status: "PENDING_ACTIVATION";
  role: "USER";
  emailVerifiedAt: null;
  phoneE164: string | null;
  displayName: string | null;
}

export interface UserMigrationPlan {
  sourceRecordKey: UserSourceRecordKey;
  action: UserMigrationAction;
  reason: UserMigrationReason | null;
  canonicalHash: string;
  candidate: NormalizedUserCandidate;
  draft: UserCreateDraft | null;
  targetId: string | null;
  warnings: readonly string[];
}

type InventoryUser = {
  sourceRecordKey: string;
  legacyUserId: number;
  normalizedEmail?: string | null;
  displayName?: string | null;
  registrationDate?: string | null;
  roles?: string[];
  profileFields?: Record<string, string | null>;
  profileMedia?: unknown[];
  ownership?: { exactBusinessOwnership?: boolean; placePostIds?: string[] };
  primaryClass?: string;
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normalizeUserEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1 || value.indexOf("@") !== at) return null;
  const local = value.slice(0, at);
  const domain = domainToASCII(value.slice(at + 1));
  if (!domain || !domain.includes(".") || /\s/.test(local) || /\s/.test(domain)) return null;
  return `${local}@${domain}`;
}

export function normalizeUserCandidate(source: UserSourceCandidate): NormalizedUserCandidate {
  const normalizedEmail = normalizeUserEmail(source.email);
  const normalizedPhone = source.phone ? normalizePhoneToE164(source.phone) || null : null;
  const classification: UserClassification = source.privilegedCollision
    ? "PRIVILEGED_COLLISION"
    : source.businessLinked
      ? "BUSINESS_LINKED"
      : source.legacyRoles.includes("content-author-evidence")
        ? "CONTENT_AUTHOR"
      : "ORDINARY";
  const warnings: string[] = [];
  if (!source.displayName && !source.firstName && !source.lastName) warnings.push("MISSING_DISPLAY_NAME");
  if (source.phone && !normalizedPhone) warnings.push("INVALID_OPTIONAL_PHONE");
  if (source.profileMediaReferencePresent) warnings.push("PROFILE_MEDIA_DEFERRED");
  if (source.businessLinked) warnings.push("BUSINESS_OWNERSHIP_DEFERRED");
  return {
    sourceRecordKey: source.sourceRecordKey,
    sourceSystem: source.sourceSystem,
    legacyUserId: source.legacyUserId,
    normalizedEmail,
    displayName: source.displayName?.trim() || null,
    firstName: source.firstName?.trim() || null,
    lastName: source.lastName?.trim() || null,
    normalizedPhone,
    sourceCreatedAt: source.sourceCreatedAt,
    classification,
    classificationEvidence: source.privilegedCollision
      ? ["LEGACY_PRIVILEGED_ROLE", "EXISTING_LOCAL_ACCOUNT"]
      : source.businessLinked
        ? ["EXACT_AUTHORED_PLACE_EVIDENCE"]
        : classification === "CONTENT_AUTHOR"
          ? ["CONTENT_AUTHOR_EVIDENCE"]
        : ["VALID_UNIQUE_EMAIL"],
    businessLinked: source.businessLinked,
    businessEvidence: source.businessEvidence,
    privilegedCollision: source.privilegedCollision,
    profileMediaReferencePresent: source.profileMediaReferencePresent,
    warnings,
    sourceHash: source.sourceHash,
  };
}

export function buildUserDraft(candidate: NormalizedUserCandidate): UserCreateDraft | null {
  if (!candidate.normalizedEmail || candidate.privilegedCollision) return null;
  return {
    email: candidate.normalizedEmail,
    passwordHash: null,
    status: "PENDING_ACTIVATION",
    role: "USER",
    emailVerifiedAt: null,
    phoneE164: candidate.normalizedPhone,
    displayName: candidate.displayName,
  };
}

export function buildUserCanonicalHash(candidate: NormalizedUserCandidate, draft: UserCreateDraft | null): string {
  return sha256(stable({
    sourceRecordKey: candidate.sourceRecordKey,
    normalizedEmail: candidate.normalizedEmail,
    displayName: candidate.displayName,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    normalizedPhone: candidate.normalizedPhone,
    classification: candidate.classification,
    businessLinked: candidate.businessLinked,
    businessEvidence: candidate.businessEvidence,
    profileMediaDeferred: candidate.profileMediaReferencePresent,
    policy: draft ? { status: draft.status, role: draft.role, passwordHash: null, emailVerifiedAt: null } : null,
  }));
}

export function validateUserDraft(candidate: NormalizedUserCandidate, draft: UserCreateDraft | null): readonly UserMigrationReason[] {
  if (!candidate.normalizedEmail) return ["INVALID_EMAIL"];
  if (candidate.privilegedCollision) return ["PRIVILEGED_ACCOUNT_COLLISION"];
  if (!draft || draft.role !== "USER") return ["UNSUPPORTED_ROLE_ELEVATION"];
  if (draft.status !== "PENDING_ACTIVATION" || draft.passwordHash !== null || draft.emailVerifiedAt !== null) {
    return ["UNSUPPORTED_ROLE_ELEVATION"];
  }
  return [];
}

export async function planUserMigration(prisma: PrismaClient, candidate: NormalizedUserCandidate, sourceNamespace = "users-immutable-snapshot"): Promise<UserMigrationPlan> {
  const draft = buildUserDraft(candidate);
  const canonicalHash = buildUserCanonicalHash(candidate, draft);
  const validation = validateUserDraft(candidate, draft);
  if (validation.length > 0) return { sourceRecordKey: candidate.sourceRecordKey, action: "BLOCKED", reason: validation[0], canonicalHash, candidate, draft: null, targetId: null, warnings: candidate.warnings };
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } } });
  const lineage = source ? await prisma.migrationLineage.findUnique({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "USER", targetRole: "primary" } } }) : null;
  if (lineage) {
    if (lineage.isActive && lineage.lastSourceHash === canonicalHash && lineage.targetId) return { sourceRecordKey: candidate.sourceRecordKey, action: "SKIP_UNCHANGED", reason: null, canonicalHash, candidate, draft, targetId: lineage.targetId, warnings: candidate.warnings };
    return { sourceRecordKey: candidate.sourceRecordKey, action: "BLOCKED", reason: "MIGRATED_USER_SOURCE_CHANGED", canonicalHash, candidate, draft: null, targetId: null, warnings: candidate.warnings };
  }
  const collision = await prisma.user.findUnique({ where: { email: candidate.normalizedEmail! }, select: { id: true, role: true } });
  if (collision) return { sourceRecordKey: candidate.sourceRecordKey, action: "BLOCKED", reason: collision.role === "ADMIN" || collision.role === "MODERATOR" ? "PRIVILEGED_ACCOUNT_COLLISION" : "EXISTING_USER_EMAIL_COLLISION", canonicalHash, candidate, draft: null, targetId: null, warnings: candidate.warnings };
  return { sourceRecordKey: candidate.sourceRecordKey, action: "CREATE", reason: null, canonicalHash, candidate, draft, targetId: null, warnings: candidate.warnings };
}

function safeNormalizedPayload(plan: UserMigrationPlan): Prisma.InputJsonValue {
  return {
    sourceRecordKey: plan.sourceRecordKey,
    legacyUserId: plan.candidate.legacyUserId,
    normalizedEmailMask: maskEmail(plan.candidate.normalizedEmail),
    classification: plan.candidate.classification,
    classificationEvidence: [...plan.candidate.classificationEvidence],
    businessLinked: plan.candidate.businessLinked,
    businessEvidence: plan.candidate.businessEvidence,
    privilegedCollision: plan.candidate.privilegedCollision,
    warnings: [...plan.warnings],
    securityPolicy: { status: "PENDING_ACTIVATION", role: "USER", passwordImported: false, activationTokenCreated: false },
  };
}

export async function writeUserMigration(
  prisma: PrismaClient,
  plan: UserMigrationPlan,
  sourceNamespace = "users-immutable-snapshot",
  options?: { snapshotHash?: string },
): Promise<{ action: UserMigrationAction; targetId: string | null; recordId: string }> {
  const snapshotHash = options?.snapshotHash ?? USER_SNAPSHOT_SHA256;
  return prisma.$transaction(async tx => {
    const source = await tx.migrationSource.upsert({
      where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace } },
      create: { adapterKey: "wordpress-db", sourceNamespace, name: sourceNamespace === "users-immutable-snapshot" ? "Immutable WordPress User snapshot" : "Live WordPress users", scope: { goldenOnly: sourceNamespace === "users-immutable-snapshot" } },
      update: {},
    });
    const run = await tx.migrationRun.create({ data: { sourceId: source.id, mode: "COMMIT", status: "RUNNING", adapterVersion: "users-v1", snapshotHash, startedAt: new Date() } });
    const record = await tx.migrationRecord.create({ data: {
      sourceId: source.id, runId: run.id, status: plan.action === "BLOCKED" ? "QUARANTINED" : plan.action === "SKIP_UNCHANGED" ? "COMPLETED" : "PLANNED",
      sourceEntityType: USER_SOURCE_ENTITY_TYPE, sourceExternalId: String(plan.candidate.legacyUserId), sourceStableKey: plan.sourceRecordKey, sourceRecordKey: plan.sourceRecordKey,
      sourceHash: plan.canonicalHash, rawPayload: Prisma.JsonNull, normalizedPayload: safeNormalizedPayload(plan), targetTypeHint: "USER",
      planAction: plan.action === "BLOCKED" ? "QUARANTINE" : plan.action, planSummary: { action: plan.action, reason: plan.reason, canonicalHash: plan.canonicalHash, warnings: [...plan.warnings] },
      validationSummary: { blocked: plan.action === "BLOCKED", reason: plan.reason }, lastErrorCode: plan.reason,
    } });
    if (plan.action !== "CREATE") {
      await tx.migrationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date(), counters: { [plan.action]: 1 } } });
      return { action: plan.action, targetId: plan.targetId, recordId: record.id };
    }
    if (!plan.draft) throw new Error("CREATE requires a validated User draft.");
    const existingLineage = await tx.migrationLineage.findUnique({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: plan.sourceRecordKey, targetType: "USER", targetRole: "primary" } } });
    const collision = await tx.user.findUnique({ where: { email: plan.draft.email }, select: { id: true } });
    if (existingLineage || collision) throw new Error("USER_CREATE_CONFLICT: refusing non-conditional User create.");
    const user = await tx.user.create({ data: {
      email: plan.draft.email, passwordHash: null, status: plan.draft.status as UserStatus, role: plan.draft.role as Role,
      emailVerifiedAt: null, phoneE164: plan.draft.phoneE164, displayName: plan.draft.displayName, deletedAt: null,
    } });
    await tx.migrationLineage.create({ data: {
      sourceId: source.id, recordId: record.id, runId: run.id, sourceEntityType: USER_SOURCE_ENTITY_TYPE,
      sourceExternalId: String(plan.candidate.legacyUserId), sourceStableKey: plan.sourceRecordKey, sourceRecordKey: plan.sourceRecordKey,
      targetType: "USER", targetId: user.id, targetRole: "primary", targetNaturalKey: maskEmail(user.email), lastSourceHash: plan.canonicalHash,
      lastPlanAction: "CREATE", isActive: true, lastSeenAt: new Date(), lastImportedAt: new Date(),
    } });
    await tx.migrationRecord.update({ where: { id: record.id }, data: { status: "LINKED" } });
    await tx.migrationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date(), counters: { CREATE: 1 } } });
    return { action: "CREATE", targetId: user.id, recordId: record.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

function readAllSnapshotUserRows(raw: string): Map<number, Record<string, string>> {
  const lines = raw.split(/\r?\n/);
  const start = lines.indexOf("SECTION users");
  if (start < 0) throw new Error("Snapshot has no users section.");
  const header = lines[start + 1].split("\t");
  const rows = new Map<number, Record<string, string>>();
  for (let index = start + 2; index < lines.length && !lines[index].startsWith("SECTION "); index += 1) {
    const parts = lines[index].split("\t", header.length);
    const id = Number(parts[0]);
    if (Number.isInteger(id)) rows.set(id, Object.fromEntries(header.map((key, offset) => [key, parts[offset] ?? ""])));
  }
  return rows;
}

const snapshotCache = new Map<string, { rowsById: Map<number, Record<string, string>>; inventory: InventoryUser[] }>();

function loadSnapshotArtifacts(snapshotRoot: string): { rowsById: Map<number, Record<string, string>>; inventory: InventoryUser[] } {
  const cached = snapshotCache.get(snapshotRoot);
  if (cached) return cached;
  const rawBuffer = readFileSync(`${snapshotRoot}/raw/users-source-capture.tsv`);
  if (sha256(rawBuffer) !== USER_SNAPSHOT_SHA256) throw new Error("BLOCKED_SOURCE_SNAPSHOT_UNAVAILABLE: raw snapshot hash mismatch.");
  const inventory = JSON.parse(readFileSync(`${snapshotRoot}/analysis/users-inventory.json`, "utf8")) as { users: InventoryUser[] };
  const raw = rawBuffer.toString("utf8");
  const rowsById = readAllSnapshotUserRows(raw);
  const artifacts = { rowsById, inventory: inventory.users };
  snapshotCache.set(snapshotRoot, artifacts);
  return artifacts;
}

export function loadUserSourceCandidate(snapshotRoot: string, sourceRecordKey: string): UserSourceCandidate {
  if (!/^wordpress-db:user:\d+$/.test(sourceRecordKey)) throw new Error("Invalid User sourceRecordKey.");
  const artifacts = loadSnapshotArtifacts(snapshotRoot);
  const legacyUserId = Number(sourceRecordKey.split(":").at(-1));
  const row = artifacts.rowsById.get(legacyUserId);
  if (!row) throw new Error(`Source candidate ${legacyUserId} is absent from immutable snapshot.`);
  const mapped = artifacts.inventory.find(user => user.sourceRecordKey === sourceRecordKey);
  if (!mapped) throw new Error(`Planning artifact missing ${sourceRecordKey}.`);
  if (!mapped.primaryClass || !["A", "C", "D", "H"].includes(mapped.primaryClass)) throw new Error(`Unsupported planning class for ${sourceRecordKey}.`);
  const privileged = mapped.primaryClass === "H";
  const businessLinked = mapped.primaryClass === "C";
  const legacyRoles = mapped.primaryClass === "D" ? ["content-author-evidence"] : mapped.roles ?? [];
  return {
    sourceRecordKey: sourceRecordKey as UserSourceRecordKey, sourceSystem: "wordpress-db", legacyUserId,
    email: row.user_email ?? mapped.normalizedEmail ?? "", displayName: mapped.displayName ?? null,
    firstName: mapped.profileFields?.first_name ?? null, lastName: mapped.profileFields?.last_name ?? null, phone: null,
    sourceCreatedAt: mapped.registrationDate ?? row.user_registered ?? null, legacyRoles, legacyPasswordPresent: false,
    businessLinked, businessEvidence: { exactOwnership: Boolean(mapped.ownership?.exactBusinessOwnership), placeCount: mapped.ownership?.placePostIds?.length ?? 0 },
    privilegedCollision: privileged, profileMediaReferencePresent: Boolean(mapped.profileMedia?.length), sourceHash: USER_SNAPSHOT_SHA256,
  };
}
