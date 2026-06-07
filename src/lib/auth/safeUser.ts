import type { Prisma, Role, UserStatus } from "@prisma/client";

/** Fields safe to expose via session, API, and client auth state. */
export const SESSION_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  displayName: true,
  phoneE164: true,
  phoneVerifiedAt: true,
  emailVerifiedAt: true,
  status: true,
  suspendedUntil: true,
  deletedAt: true,
  lastLoginAt: true,
  familyRole: true,
  ageBandLabel: true,
  preferenceSummary: true,
  leisureFormatSummary: true,
  preferenceSignalIds: true,
  leisureFormatSignalId: true,
  telegramConnected: true,
  marketingEmailsEnabled: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type SessionUserRecord = Prisma.UserGetPayload<{
  select: typeof SESSION_USER_SELECT;
}>;

/** Authenticated user returned from getCurrentUser (server-side). */
export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  displayName: string | null;
  phoneE164: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  familyRole: string | null;
  ageBandLabel: string | null;
  preferenceSummary: string | null;
  leisureFormatSummary: string | null;
  preferenceSignalIds: string[];
  leisureFormatSignalId: string | null;
  telegramConnected: boolean;
  marketingEmailsEnabled: boolean;
  avatarUrl: string | null;
};

/** Minimal identity for permission and media ACL checks. */
export type AuthActor = Pick<CurrentUser, "id" | "role">;

export function toCurrentUser(user: SessionUserRecord): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    phoneE164: user.phoneE164,
    phoneVerifiedAt: user.phoneVerifiedAt,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    familyRole: user.familyRole,
    ageBandLabel: user.ageBandLabel,
    preferenceSummary: user.preferenceSummary,
    leisureFormatSummary: user.leisureFormatSummary,
    preferenceSignalIds: user.preferenceSignalIds,
    leisureFormatSignalId: user.leisureFormatSignalId,
    telegramConnected: user.telegramConnected,
    marketingEmailsEnabled: user.marketingEmailsEnabled,
    avatarUrl: user.avatarUrl,
  };
}
