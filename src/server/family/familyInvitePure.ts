import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 7;
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

export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isInviteUsable(
  invite: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return invite.status === "ACTIVE" && invite.expiresAt.getTime() > now.getTime();
}
