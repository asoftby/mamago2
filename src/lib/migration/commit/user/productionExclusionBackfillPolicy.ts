import { createHash } from "node:crypto";

export const WORDPRESS_USER_BACKFILL_ISSUE = 1064;

export interface ApprovedUserBackfillEntry {
  sourceRecordKey: string;
  emailSha256: string;
  canonicalHash: string;
  sourceHash: string;
  action: "CREATE";
}

export interface ApprovedUserBackfillManifest {
  schemaVersion: 1;
  issue: 1064;
  approvedBy: "FOUNDER";
  approvedAt: string;
  entries: ApprovedUserBackfillEntry[];
}

// This pre-existing *single-user* writer is intentionally restricted to
// user:43. New read-only evidence identified four more historical candidates
// (7, 17, 22, 42), all absent from PROD by 2026-07-03 archived email.
// They are NOT yet approved or supported by this write path. Extending
// its allowlist requires separate source-specific design, collision checks,
// approval manifest, transactional safety tests, and an explicit PROD gate.
const ALLOWED = new Set<string>(["wordpress-db:user:43"]);
const HASH = /^[a-f0-9]{64}$/;

export function hashBackfillEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index]);
}

/**
 * The reviewed manifest is deliberately an exact allowlist, not a generic
 * switch to override historical founder exclusions. It contains no emails.
 */
export function parseApprovedUserBackfillManifest(input: unknown): ApprovedUserBackfillManifest {
  if (!isRecord(input) ||
      !exactKeys(input, ["schemaVersion", "issue", "approvedBy", "approvedAt", "entries"]) ||
      input.schemaVersion !== 1 || input.issue !== WORDPRESS_USER_BACKFILL_ISSUE ||
      input.approvedBy !== "FOUNDER" || typeof input.approvedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.approvedAt) ||
      !Number.isFinite(Date.parse(input.approvedAt)) ||
      Date.parse(input.approvedAt) > Date.now() ||
      !Array.isArray(input.entries) ||
      input.entries.length < 1 || input.entries.length > ALLOWED.size) {
    throw new Error("BACKFILL_MANIFEST_INVALID");
  }
  const seen = new Set<string>();
  const entries: ApprovedUserBackfillEntry[] = [];
  for (const entry of input.entries) {
    if (!isRecord(entry) ||
        !exactKeys(entry, ["sourceRecordKey", "emailSha256", "canonicalHash", "sourceHash", "action"]) ||
        typeof entry.sourceRecordKey !== "string" ||
        !ALLOWED.has(entry.sourceRecordKey) || seen.has(entry.sourceRecordKey) ||
        entry.action !== "CREATE" ||
        typeof entry.emailSha256 !== "string" || !HASH.test(entry.emailSha256) ||
        typeof entry.canonicalHash !== "string" || !HASH.test(entry.canonicalHash) ||
        typeof entry.sourceHash !== "string" || !HASH.test(entry.sourceHash)) {
      throw new Error("BACKFILL_MANIFEST_ENTRY_INVALID");
    }
    seen.add(entry.sourceRecordKey);
    entries.push(entry as unknown as ApprovedUserBackfillEntry);
  }
  if (entries.some((entry, index) => index > 0 && entry.sourceRecordKey <= entries[index - 1].sourceRecordKey)) {
    throw new Error("BACKFILL_MANIFEST_SORT_REQUIRED");
  }
  return { schemaVersion: 1, issue: 1064, approvedBy: "FOUNDER", approvedAt: input.approvedAt, entries };
}

export interface BackfillPlanSnapshot {
  sourceRecordKey: string;
  action: string;
  canonicalHash: string;
  candidate: { normalizedEmail: string | null };
  draft: {
    role: string;
    status: string;
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
  } | null;
}

/** No role elevation, business creation, user overwrite or unreviewed source. */
export function assertBackfillPlanMatchesApproval(
  entry: ApprovedUserBackfillEntry,
  plan: BackfillPlanSnapshot,
  sourceHash: string,
): void {
  if (entry.sourceRecordKey !== plan.sourceRecordKey ||
      entry.sourceHash !== sourceHash ||
      entry.canonicalHash !== plan.canonicalHash ||
      !plan.candidate.normalizedEmail ||
      hashBackfillEmail(plan.candidate.normalizedEmail) !== entry.emailSha256 ||
      (plan.action !== "CREATE" && plan.action !== "SKIP_UNCHANGED") ||
      !plan.draft ||
      plan.draft.role !== "USER" ||
      plan.draft.status !== "PENDING_ACTIVATION" ||
      plan.draft.passwordHash !== null ||
      plan.draft.emailVerifiedAt !== null) {
    throw new Error("BACKFILL_APPROVAL_MISMATCH:" + entry.sourceRecordKey);
  }
}
