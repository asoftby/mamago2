import type { PrismaClient } from "@prisma/client";
import { familyInvitesEnabled, familyReadsEnabled } from "@/server/family/familyScope";
import { listFamilyForUser } from "@/server/family/familyMembers.service";

export type FamilyBlockData = {
  myRole: "OWNER" | "ADULT";
  adults: Array<{ userId: string; displayName: string | null; role: "OWNER" | "ADULT"; isMe: boolean }>;
  invites: Array<{ id: string; createdAt: string }>;
  invitesEnabled: boolean;
};

/**
 * Data for the family/invites block, shared by `/me` and `/me/profile`.
 * `includeChildren: false` skips the Child query (the caller already has the children).
 * Returns null while FAMILY_CORE_READS is off (nothing is queried then).
 * Lazy family: a user without a family row can still invite when FAMILY_INVITES is on
 * (the family is created on the first invite), hence the solo fallback.
 */
export async function loadFamilyBlockData(
  db: PrismaClient,
  user: { id: string; displayName?: string | null },
  opts: { includeChildren?: boolean } = {},
): Promise<FamilyBlockData | null> {
  if (!familyReadsEnabled()) return null;
  const invitesEnabled = familyInvitesEnabled();
  const family = await listFamilyForUser(db, user.id, { includeChildren: opts.includeChildren });
  if (family) {
    return {
      myRole: family.myRole,
      adults: family.adults.map((a) => ({
        userId: a.userId,
        displayName: a.displayName,
        role: a.role,
        isMe: a.isMe,
      })),
      invites: family.invites.map((i) => ({ id: i.id, createdAt: i.createdAt.toISOString() })),
      invitesEnabled,
    };
  }
  if (!invitesEnabled) return null;
  return {
    myRole: "OWNER",
    adults: [{ userId: user.id, displayName: user.displayName ?? null, role: "OWNER", isMe: true }],
    invites: [],
    invitesEnabled,
  };
}
