/**
 * Family Core M5a: pure rules for member management (no DB).
 */

export type FamilyMembersErrorCode =
  | "disabled"
  | "not_member"
  | "owner_must_transfer"
  | "last_adult"
  | "not_owner"
  | "target_not_member"
  | "same_user"
  | "invalid_email"
  | "rate_limited"
  | "conflict";

export class FamilyMembersError extends Error {
  constructor(public readonly code: FamilyMembersErrorCode, message?: string) {
    super(message ?? code);
    this.name = "FamilyMembersError";
  }
}

/** Per-user daily limit of invite LETTERS (links are bounded by the active-invite cap). */
export const INVITE_EMAILS_PER_USER_PER_DAY = 5;
export const INVITE_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeInviteEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export type LeaveVerdict = { ok: true } | { ok: false; code: "owner_must_transfer" | "last_adult" };

/** ADULT may leave; OWNER must transfer first; the last adult cannot "leave". */
export function checkLeave(input: { role: "OWNER" | "ADULT"; activeAdults: number }): LeaveVerdict {
  if (input.activeAdults <= 1) return { ok: false, code: "last_adult" };
  if (input.role === "OWNER") return { ok: false, code: "owner_must_transfer" };
  return { ok: true };
}

export type TransferVerdict = { ok: true } | { ok: false; code: "not_owner" | "same_user" | "target_not_member" };

export function checkTransfer(input: {
  actorRole: "OWNER" | "ADULT" | null;
  actorId: string;
  targetId: string;
  targetIsActiveMember: boolean;
}): TransferVerdict {
  if (input.actorRole !== "OWNER") return { ok: false, code: "not_owner" };
  if (input.actorId === input.targetId) return { ok: false, code: "same_user" };
  if (!input.targetIsActiveMember) return { ok: false, code: "target_not_member" };
  return { ok: true };
}

/** Plan item of the leaver: the new family gets his PRIVATE items only. */
export function mapLeaverPlanChildId(
  childId: string | null,
  childIdMap: ReadonlyMap<string, string>,
): string | null {
  if (!childId) return null;
  return childIdMap.get(childId) ?? null;
}
