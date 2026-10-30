import { createHash, randomBytes } from "node:crypto";

export const MAX_ACTIVE_INVITES_PER_FAMILY = 3;
export const FAMILY_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FamilyInviteErrorCode =
  | "disabled"
  | "consent_required"
  | "invalid_invite"
  | "expired_invite"
  | "limit_reached"
  | "not_member"
  | "already_member"
  | "has_other_adults"
  | "needs_merge"
  | "merge_invalid"
  | "conflict";

export class FamilyInviteError extends Error {
  constructor(public readonly code: FamilyInviteErrorCode, message?: string) {
    super(message ?? code);
    this.name = "FamilyInviteError";
  }
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type FamilyInviteValidity = "valid" | "expired" | "invalid";

/** Old invitations with NULL expiresAt get the same seven-day limit from creation. */
export function familyInviteExpiresAt(invite: { expiresAt: Date | null; createdAt: Date }): Date {
  return invite.expiresAt ?? new Date(invite.createdAt.getTime() + FAMILY_INVITE_TTL_MS);
}

export function familyInviteValidity(
  invite: { status: string; expiresAt: Date | null; createdAt: Date },
  now: Date,
): FamilyInviteValidity {
  if (invite.status !== "ACTIVE") return "invalid";
  return familyInviteExpiresAt(invite).getTime() <= now.getTime() ? "expired" : "valid";
}

export function isInviteUsable(
  invite: { status: string; expiresAt: Date | null; createdAt: Date },
  now: Date,
): boolean {
  return familyInviteValidity(invite, now) === "valid";
}

/** Database filter for legacy null dates and newly explicit 7-day expiries. */
export function activeInviteWhere(now: Date) {
  return {
    status: "ACTIVE" as const,
    OR: [
      { expiresAt: { gt: now } },
      { expiresAt: null, createdAt: { gt: new Date(now.getTime() - FAMILY_INVITE_TTL_MS) } },
    ],
  };
}

export function expiredInviteWhere(now: Date) {
  return {
    status: "ACTIVE" as const,
    OR: [
      { expiresAt: { lte: now } },
      { expiresAt: null, createdAt: { lte: new Date(now.getTime() - FAMILY_INVITE_TTL_MS) } },
    ],
  };
}
