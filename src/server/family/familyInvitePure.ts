import { createHash, randomBytes } from "node:crypto";

export const MAX_ACTIVE_INVITES_PER_FAMILY = 3;

export type FamilyInviteErrorCode =
  | "disabled"
  | "consent_required"
  | "invalid_invite"
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

export function isInviteUsable(
  invite: { status: string; expiresAt: Date | null },
  now: Date,
): boolean {
  // expiresAt null = no expiry (only legacy rows carry a date).
  return invite.status === "ACTIVE" && (invite.expiresAt === null || invite.expiresAt.getTime() > now.getTime());
}

/** Prisma where-fragment: ACTIVE invites that are still usable at `now`. */
export function activeInviteWhere(now: Date) {
  return {
    status: "ACTIVE" as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}
