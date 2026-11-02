/**
 * Issue #1064 — 5 identity-only WordPress User recovery approvals.
 * No Business / event / role/permission transfer and no automatic emails.
 * The five-user COMMIT is separate from historical single-user script.
 */
import { createHash } from "node:crypto";
import { hashBackfillEmail } from "./productionExclusionBackfillPolicy";

export const FIVE_RECOVERY_KEYS = [
  "wordpress-db:user:7",
  "wordpress-db:user:17",
  "wordpress-db:user:22",
  "wordpress-db:user:42",
  "wordpress-db:user:43",
] as const;
export const FIVE_RECOVERY_NAMESPACE = "wordpress-audit-20260703-recovery-1064";

const SHA256 = /^[a-f0-9]{64}$/;

export interface FiveRecoveryApprovalEntry {
  sourceRecordKey: string;
  emailSha256: string;
  canonicalHash: string;
  sourceHash: string;
  action: "CREATE";
}

export interface FiveRecoveryApproval {
  schemaVersion: 1;
  issue: 1064;
  approvedBy: "FOUNDER";
  approvedAt: string;
  archiveSha256: string;
  sourceNamespace: typeof FIVE_RECOVERY_NAMESPACE;
  entries: FiveRecoveryApprovalEntry[];
}

export interface FiveRecoveryArgs {
  approvedManifest: string;
  approvedManifestSha256: string;
  backupReference: string;
  operatorFlagsValid: true;
}

function object(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function keys(v: Record<string, unknown>, allowed: readonly string[]): boolean {
  return JSON.stringify(Object.keys(v).sort()) ===
    JSON.stringify([...allowed].sort());
}

export function parseFiveRecoveryManifest(input: unknown): FiveRecoveryApproval {
  if (!object(input) || !keys(input, [
    "schemaVersion", "issue", "approvedBy", "approvedAt",
    "archiveSha256", "sourceNamespace", "entries",
  ]) || input.schemaVersion !== 1 || input.issue !== 1064 ||
      input.approvedBy !== "FOUNDER" ||
      typeof input.approvedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.approvedAt) ||
      !Number.isFinite(Date.parse(input.approvedAt)) ||
      Date.parse(input.approvedAt) > Date.now() ||
      typeof input.archiveSha256 !== "string" ||
      !SHA256.test(input.archiveSha256) ||
      input.sourceNamespace !== FIVE_RECOVERY_NAMESPACE ||
      !Array.isArray(input.entries) ||
      input.entries.length !== FIVE_RECOVERY_KEYS.length) {
    throw new Error("FIVE_RECOVERY_MANIFEST_INVALID");
  }

  const entries: FiveRecoveryApprovalEntry[] = [];
  for (let i = 0; i < FIVE_RECOVERY_KEYS.length; i++) {
    const item: unknown = input.entries[i];
    if (!object(item) ||
        !keys(item, ["sourceRecordKey", "emailSha256", "canonicalHash", "sourceHash", "action"]) ||
        item.sourceRecordKey !== FIVE_RECOVERY_KEYS[i] ||
        item.action !== "CREATE" ||
        !["emailSha256", "canonicalHash", "sourceHash"].every(name =>
          typeof item[name] === "string" && SHA256.test(item[name] as string))) {
      throw new Error("FIVE_RECOVERY_MANIFEST_USER_INVALID");
    }
    entries.push(item as unknown as FiveRecoveryApprovalEntry);
  }

  return {
    schemaVersion: 1,
    issue: 1064,
    approvedBy: "FOUNDER",
    approvedAt: input.approvedAt,
    archiveSha256: input.archiveSha256,
    sourceNamespace: FIVE_RECOVERY_NAMESPACE,
    entries,
  };
}

export function verifyFiveRecoveryManifestBytes(
  bytes: Buffer, approvedSha256: string,
): FiveRecoveryApproval {
  if (!SHA256.test(approvedSha256) ||
      createHash("sha256").update(bytes).digest("hex") !== approvedSha256) {
    throw new Error("FIVE_RECOVERY_MANIFEST_SHA256_MISMATCH");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("FIVE_RECOVERY_MANIFEST_JSON_INVALID");
  }
  return parseFiveRecoveryManifest(parsed);
}

export function parseFiveRecoveryArgs(argv: readonly string[]): FiveRecoveryArgs {
  const names = new Set([
    "--confirm-writes",
    "--confirm-production",
    "--acknowledge-prod-user-import",
    "--acknowledge-exclusion-backfill",
    "--confirm-five-user-archive-recovery",
    "--confirm-backup-restored",
  ]);
  const values = [
    "--backup-reference",
    "--manifest",
    "--reviewed-manifest-sha256",
  ];
  const seen = new Set<string>();
  const result = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (seen.has(argument)) throw new Error("FIVE_RECOVERY_DUPLICATE_ARG");
    seen.add(argument);
    if (values.includes(argument)) {
      const value = argv[++i];
      if (!value || value.startsWith("--")) throw new Error("FIVE_RECOVERY_ARG_VALUE_REQUIRED");
      result.set(argument, value);
    } else if (!names.has(argument)) {
      throw new Error("FIVE_RECOVERY_UNKNOWN_ARGUMENT");
    }
  }
  if ([...names].some(name => !seen.has(name)) ||
      values.some(name => !result.has(name))) {
    throw new Error("FIVE_RECOVERY_PROD_OPERATOR_APPROVAL_REQUIRED");
  }
  const hash = result.get("--reviewed-manifest-sha256")!;
  const backup = result.get("--backup-reference")!;
  const manifest = result.get("--manifest")!;
  if (!SHA256.test(hash) || !backup.trim() || !manifest.trim()) {
    throw new Error("FIVE_RECOVERY_PROD_OPERATOR_APPROVAL_INVALID");
  }
  return {
    approvedManifest: manifest,
    approvedManifestSha256: hash,
    backupReference: backup,
    operatorFlagsValid: true,
  };
}

export interface FiveRecoveryPlanSnapshot {
  sourceRecordKey: string;
  action: string;
  canonicalHash: string;
  candidate: { normalizedEmail: string | null };
  draft: {
    role: string;
    status: string;
    passwordHash: null;
    emailVerifiedAt: null;
    phoneE164: string | null;
  } | null;
}

export function assertFiveRecoveryPlanApproved(
  approval: FiveRecoveryApprovalEntry,
  plan: FiveRecoveryPlanSnapshot,
  sourceHash: string,
): void {
  if (approval.sourceRecordKey !== plan.sourceRecordKey ||
      approval.canonicalHash !== plan.canonicalHash ||
      approval.sourceHash !== sourceHash ||
      (plan.action !== "CREATE" && plan.action !== "SKIP_UNCHANGED") ||
      !plan.candidate.normalizedEmail ||
      hashBackfillEmail(plan.candidate.normalizedEmail) !== approval.emailSha256 ||
      !plan.draft ||
      plan.draft.role !== "USER" ||
      plan.draft.status !== "PENDING_ACTIVATION" ||
      plan.draft.passwordHash !== null ||
      plan.draft.emailVerifiedAt !== null ||
      plan.draft.phoneE164 !== null) {
    throw new Error("FIVE_RECOVERY_APPROVAL_MISMATCH:" + approval.sourceRecordKey);
  }
}
