import { Prisma, type PrismaClient } from "@prisma/client";
import { familyReadsEnabled } from "./familyScope";
import { activeInviteWhere } from "./familyInvitePure";
import {
  FamilyMembersError,
  checkLeave,
  checkTransfer,
  mapLeaverPlanChildId,
} from "./familyMembersPure";

export { FamilyMembersError } from "./familyMembersPure";

type Deps = { now?: () => Date; env?: Record<string, string | undefined> };

function assertEnabled(deps: Deps) {
  if (!familyReadsEnabled(deps.env)) throw new FamilyMembersError("disabled");
}

async function lockFamily(tx: Prisma.TransactionClient, familyId: string) {
  await tx.$queryRaw`SELECT id FROM "Family" WHERE id = ${familyId} FOR UPDATE`;
}

export type FamilyOverview = {
  familyId: string;
  myRole: "OWNER" | "ADULT";
  adults: Array<{ userId: string; displayName: string | null; role: "OWNER" | "ADULT"; joinedAt: Date; isMe: boolean }>;
  children: Array<{ id: string; name: string | null; birthDate: Date | null }>;
  invites: Array<{ id: string; createdAt: Date }>;
};

/** Members and children of the user's active family; null when the user has none yet (lazy family). */
export async function listFamilyForUser(
  prisma: PrismaClient,
  userId: string,
  deps: Deps = {},
): Promise<FamilyOverview | null> {
  assertEnabled(deps);
  const now = (deps.now ?? (() => new Date()))();
  const mine = await prisma.familyMembership.findFirst({
    where: { userId, leftAt: null },
    select: { familyId: true, role: true },
  });
  if (!mine) return null;
  const [members, children, invites] = await Promise.all([
    prisma.familyMembership.findMany({
      where: { familyId: mine.familyId, leftAt: null },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, role: true, joinedAt: true, user: { select: { displayName: true } } },
    }),
    prisma.child.findMany({
      where: { familyId: mine.familyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, birthDate: true },
    }),
    prisma.familyInvite.findMany({
      where: { familyId: mine.familyId, ...activeInviteWhere(now) },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
  ]);
  return {
    familyId: mine.familyId,
    myRole: mine.role,
    adults: members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
      joinedAt: m.joinedAt,
      isMe: m.userId === userId,
    })),
    children,
    invites,
  };
}

/**
 * ADULT leaves the family and gets a new solo family (OWNER):
 *  - his PRIVATE plan items move with him; FAMILY items stay (author kept);
 *  - children stay in the old family, optionally copied (unlinked) when `copyChildren`;
 *  - plan items pointing at a child he did not copy lose the child link;
 *  - OWNER must transfer ownership first; the last adult cannot leave.
 */
export async function leaveFamily(
  prisma: PrismaClient,
  input: { userId: string; copyChildren?: boolean },
  deps: Deps = {},
): Promise<{ familyId: string }> {
  assertEnabled(deps);
  const now = (deps.now ?? (() => new Date()))();
  const pre = await prisma.familyMembership.findFirst({
    where: { userId: input.userId, leftAt: null },
    select: { familyId: true },
  });
  if (!pre) throw new FamilyMembersError("not_member");
  const oldFamilyId = pre.familyId;

  return prisma.$transaction(async (tx) => {
    await lockFamily(tx, oldFamilyId);
    const mine = await tx.familyMembership.findFirst({
      where: { userId: input.userId, leftAt: null },
      select: { id: true, familyId: true, role: true },
    });
    if (!mine || mine.familyId !== oldFamilyId) throw new FamilyMembersError("conflict");
    const activeAdults = await tx.familyMembership.count({ where: { familyId: oldFamilyId, leftAt: null } });
    const verdict = checkLeave({ role: mine.role, activeAdults });
    if (!verdict.ok) throw new FamilyMembersError(verdict.code);

    // Close the old membership first: the partial unique index allows one active membership per user.
    await tx.familyMembership.update({ where: { id: mine.id }, data: { leftAt: now } });
    const family = await tx.family.create({ data: {} });
    await tx.familyMembership.create({
      data: { familyId: family.id, userId: input.userId, role: "OWNER", historyAccess: "ALL", joinedAt: now },
    });

    const childIdMap = new Map<string, string>();
    if (input.copyChildren) {
      const children = await tx.child.findMany({
        where: { familyId: oldFamilyId },
        select: {
          id: true, name: true, birthDate: true, birthPrecision: true, interests: true,
          systemInterests: { select: { interestSlug: true, source: true } },
          customInterests: { select: { label: true, normalizedSlug: true, status: true } },
        },
      });
      for (const c of children) {
        const copy = await tx.child.create({
          data: {
            name: c.name,
            birthDate: c.birthDate,
            birthPrecision: c.birthPrecision,
            interests: c.interests,
            parentId: input.userId,
            createdById: input.userId,
            familyId: family.id,
            systemInterests: { create: c.systemInterests },
            customInterests: { create: c.customInterests },
          },
          select: { id: true },
        });
        childIdMap.set(c.id, copy.id);
      }
    }

    const privateItems = await tx.planItem.findMany({
      where: { familyId: oldFamilyId, userId: input.userId, visibility: "PRIVATE" },
      select: { id: true, childId: true },
    });
    for (const item of privateItems) {
      await tx.planItem.update({
        where: { id: item.id },
        data: { familyId: family.id, childId: mapLeaverPlanChildId(item.childId, childIdMap) },
      });
    }
    return { familyId: family.id };
  });
}

/** OWNER hands the role to another active adult. Demote first (one active OWNER per family). */
export async function transferFamilyOwnership(
  prisma: PrismaClient,
  input: { userId: string; targetUserId: string },
  deps: Deps = {},
): Promise<void> {
  assertEnabled(deps);
  const pre = await prisma.familyMembership.findFirst({
    where: { userId: input.userId, leftAt: null },
    select: { familyId: true },
  });
  if (!pre) throw new FamilyMembersError("not_member");
  await prisma.$transaction(async (tx) => {
    await lockFamily(tx, pre.familyId);
    const [actor, target] = await Promise.all([
      tx.familyMembership.findFirst({
        where: { userId: input.userId, familyId: pre.familyId, leftAt: null },
        select: { id: true, role: true },
      }),
      tx.familyMembership.findFirst({
        where: { userId: input.targetUserId, familyId: pre.familyId, leftAt: null },
        select: { id: true },
      }),
    ]);
    if (!actor) throw new FamilyMembersError("conflict");
    const verdict = checkTransfer({
      actorRole: actor.role,
      actorId: input.userId,
      targetId: input.targetUserId,
      targetIsActiveMember: !!target,
    });
    if (!verdict.ok) throw new FamilyMembersError(verdict.code);
    await tx.familyMembership.update({ where: { id: actor.id }, data: { role: "ADULT" } });
    await tx.familyMembership.update({ where: { id: target!.id }, data: { role: "OWNER" } });
  });
}
