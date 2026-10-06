import { Prisma, type FamilyHistoryAccess, type PrismaClient } from "@prisma/client";
import { ensureFamilyForUser } from "./ensureFamily";
import { familyInvitesEnabled } from "./familyScope";
import { applyJoinerMerge } from "./familyMerge.service";
import type { MergeDecision } from "./familyMergePure";
import {
  FamilyInviteError,
  MAX_ACTIVE_INVITES_PER_FAMILY,
  generateInviteToken,
  hashInviteToken,
  activeInviteWhere,
  isInviteUsable,
} from "./familyInvitePure";

export { FamilyInviteError } from "./familyInvitePure";

type Deps = { now?: () => Date; env?: Record<string, string | undefined> };

function assertEnabled(deps: Deps) {
  if (!familyInvitesEnabled(deps.env)) throw new FamilyInviteError("disabled");
}

async function lockFamily(tx: Prisma.TransactionClient, familyId: string) {
  await tx.$queryRaw`SELECT id FROM "Family" WHERE id = ${familyId} FOR UPDATE`;
}

/**
 * Creates an invite for the user's family (lazy family). Returns the raw token
 * once; only its hash is stored. Invites do not expire (until accepted or revoked); at most 3 active per family.
 */
export async function createFamilyInvite(
  prisma: PrismaClient,
  input: { userId: string },
  deps: Deps = {},
): Promise<{ inviteId: string; token: string }> {
  assertEnabled(deps);
  const now = (deps.now ?? (() => new Date()))();
  const familyId = await ensureFamilyForUser(prisma, input.userId);
  return prisma.$transaction(async (tx) => {
    await lockFamily(tx, familyId);
    const member = await tx.familyMembership.findFirst({
      where: { familyId, userId: input.userId, leftAt: null },
      select: { id: true },
    });
    if (!member) throw new FamilyInviteError("not_member");
    const active = await tx.familyInvite.count({
      where: { familyId, ...activeInviteWhere(now) },
    });
    if (active >= MAX_ACTIVE_INVITES_PER_FAMILY) throw new FamilyInviteError("limit_reached");
    const token = generateInviteToken();
    const invite = await tx.familyInvite.create({
      data: { familyId, createdById: input.userId, tokenHash: hashInviteToken(token), expiresAt: null },
      select: { id: true },
    });
    return { inviteId: invite.id, token };
  });
}

/** Any active adult of the family may revoke its active invite. */
export async function revokeFamilyInvite(
  prisma: PrismaClient,
  input: { userId: string; inviteId: string },
  deps: Deps = {},
): Promise<void> {
  assertEnabled(deps);
  const now = (deps.now ?? (() => new Date()))();
  await prisma.$transaction(async (tx) => {
    const invite = await tx.familyInvite.findUnique({
      where: { id: input.inviteId },
      select: { familyId: true },
    });
    if (!invite) throw new FamilyInviteError("invalid_invite");
    await lockFamily(tx, invite.familyId);
    const member = await tx.familyMembership.findFirst({
      where: { familyId: invite.familyId, userId: input.userId, leftAt: null },
      select: { id: true },
    });
    if (!member) throw new FamilyInviteError("not_member");
    const res = await tx.familyInvite.updateMany({
      where: { id: input.inviteId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
    if (res.count === 0) throw new FamilyInviteError("invalid_invite");
  });
}

/**
 * Accepts an invite. Consent (text version) is mandatory and stored in the same
 * transaction. Nothing is merged automatically (M3b): the joiner must have no
 * active family, or only an empty solo family (no children, no plan items),
 * which is archived. A family with other adults, or a solo family with data,
 * is refused.
 */
export async function acceptFamilyInvite(
  prisma: PrismaClient,
  input: {
    userId: string;
    token: string;
    consentTextVersion: string;
    historyAccess?: FamilyHistoryAccess;
    /** Explicit merge decision (M3b). Required when the joiner has data. */
    merge?: MergeDecision;
  },
  deps: Deps = {},
): Promise<{ familyId: string }> {
  assertEnabled(deps);
  if (!input.consentTextVersion?.trim()) throw new FamilyInviteError("consent_required");
  const now = (deps.now ?? (() => new Date()))();
  const tokenHash = hashInviteToken(input.token);

  try {
    return await prisma.$transaction(async (tx) => {
      const found = await tx.familyInvite.findUnique({
        where: { tokenHash },
        select: { familyId: true },
      });
      if (!found) throw new FamilyInviteError("invalid_invite");
      // Lock target and the joiner's own family in id order (no lock-order deadlock
      // between two users accepting each other's invites).
      const preMine = await tx.familyMembership.findFirst({
        where: { userId: input.userId, leftAt: null },
        select: { familyId: true },
      });
      for (const id of [...new Set([found.familyId, preMine?.familyId].filter((x): x is string => !!x))].sort()) {
        await lockFamily(tx, id);
      }

      const invite = await tx.familyInvite.findUnique({
        where: { tokenHash },
        select: { id: true, familyId: true, createdById: true, status: true, expiresAt: true },
      });
      if (!invite || !isInviteUsable(invite, now)) throw new FamilyInviteError("invalid_invite");
      const [family, creator] = await Promise.all([
        tx.family.findUnique({ where: { id: invite.familyId }, select: { archivedAt: true } }),
        tx.familyMembership.findFirst({
          where: { familyId: invite.familyId, userId: invite.createdById, leftAt: null },
          select: { id: true },
        }),
      ]);
      if (!family || family.archivedAt || !creator) throw new FamilyInviteError("invalid_invite");

      const mine = await tx.familyMembership.findFirst({
        where: { userId: input.userId, leftAt: null },
        select: { id: true, familyId: true },
      });
      if ((mine?.familyId ?? null) !== (preMine?.familyId ?? null)) throw new FamilyInviteError("conflict");
      if (mine?.familyId === invite.familyId) throw new FamilyInviteError("already_member");
      // Data check runs even without an active membership: a user with children or
      // plan items but no family would otherwise join and leave them without familyId.
      const mineFamilyId = mine?.familyId ?? null;
      const dataOwners = (id: "familyId" | "userId") => [
        ...(mineFamilyId ? [{ familyId: mineFamilyId }] : []),
        id === "familyId" ? { parentId: input.userId } : { userId: input.userId },
      ];
      const [adults, children, planItems] = await Promise.all([
        mineFamilyId
          ? tx.familyMembership.count({ where: { familyId: mineFamilyId, leftAt: null } })
          : Promise.resolve(0),
        tx.child.count({ where: { OR: dataOwners("familyId") } }),
        tx.planItem.count({ where: { OR: dataOwners("userId") } }),
      ]);
      if (adults > 1) throw new FamilyInviteError("has_other_adults");
      if ((children > 0 || planItems > 0) && !input.merge) throw new FamilyInviteError("needs_merge");
      if (children > 0 || planItems > 0 || input.merge) {
        await applyJoinerMerge(tx, {
          userId: input.userId,
          mineFamilyId,
          targetFamilyId: invite.familyId,
          decision: input.merge ?? { children: [], plan: "SKIP" },
        });
      }
      if (mine) {
        await tx.familyMembership.update({ where: { id: mine.id }, data: { leftAt: now } });
        await tx.family.update({ where: { id: mine.familyId }, data: { archivedAt: now } });
        // Moving to another family ends the shared-data consent for the old one.
        await tx.consentRecord.updateMany({
          where: { userId: input.userId, familyId: mine.familyId, type: "FAMILY_SHARED_DATA", revokedAt: null },
          data: { revokedAt: now },
        });
      }

      await tx.familyMembership.create({
        data: {
          familyId: invite.familyId,
          userId: input.userId,
          role: "ADULT",
          historyAccess: input.historyAccess ?? "FROM_JOIN",
          joinedAt: now,
        },
      });
      await tx.consentRecord.create({
        data: {
          userId: input.userId,
          familyId: invite.familyId,
          type: "FAMILY_SHARED_DATA",
          textVersion: input.consentTextVersion.trim(),
          acceptedAt: now,
        },
      });
      await tx.familyInvite.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", acceptedById: input.userId, acceptedAt: now },
      });
      return { familyId: invite.familyId };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FamilyInviteError("conflict");
    }
    throw error;
  }
}
