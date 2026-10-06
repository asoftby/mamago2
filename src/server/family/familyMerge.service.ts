import type { Prisma, PrismaClient } from "@prisma/client";
import { FamilyInviteError } from "./familyInvitePure";
import {
  mergeInterestsText,
  mergedPlanVisibility,
  suggestChildMatches,
  validateMergeDecision,
  type MergeChild,
  type MergeDecision,
} from "./familyMergePure";
import { hashInviteToken, isInviteUsable } from "./familyInvitePure";
import { recordFamilySharedDataConsent } from "./familyConsentRecord";

type Tx = Prisma.TransactionClient;

/** Children and plan items owned by the joiner (own family, or orphan rows by author). */
function joinerOwned(userId: string, mineFamilyId: string | null) {
  return [...(mineFamilyId ? [{ familyId: mineFamilyId }] : []), { parentId: userId }];
}

export type MergePreview = {
  joinerChildren: Array<{ id: string; name: string | null; birthYear: number | null }>;
  targetChildren: Array<{ id: string; name: string | null; birthYear: number | null }>;
  /** joiner child id -> suggested target child id (suggestion only, never applied automatically) */
  suggestions: Record<string, string | null>;
  planItemCount: number;
};

/**
 * Data for the "merge" step. The target family's children are shown only to a
 * user who has accepted the consent text (version required), and only for a
 * usable invite.
 */
export async function previewFamilyInviteMerge(
  prisma: PrismaClient,
  input: { userId: string; token: string; consentTextVersion: string },
  now: Date = new Date(),
): Promise<MergePreview> {
  if (!input.consentTextVersion?.trim()) throw new FamilyInviteError("consent_required");
  const invite = await prisma.familyInvite.findUnique({
    where: { tokenHash: hashInviteToken(input.token) },
    select: {
      familyId: true,
      status: true,
      expiresAt: true,
      createdById: true,
      family: { select: { archivedAt: true } },
    },
  });
  if (!invite || !isInviteUsable(invite, now) || invite.family.archivedAt) {
    throw new FamilyInviteError("invalid_invite");
  }
  // Same validity as accept: a link whose creator left the family is dead and must not leak children.
  const creator = await prisma.familyMembership.findFirst({
    where: { familyId: invite.familyId, userId: invite.createdById, leftAt: null },
    select: { id: true },
  });
  if (!creator) throw new FamilyInviteError("invalid_invite");
  // This is the first disclosure of the family's children: the consent must be
  // persisted before any of their data is read (accept reuses this record).
  await recordFamilySharedDataConsent(prisma, {
    userId: input.userId,
    familyId: invite.familyId,
    textVersion: input.consentTextVersion,
    now,
  });
  const mine = await prisma.familyMembership.findFirst({
    where: { userId: input.userId, leftAt: null },
    select: { familyId: true },
  });
  const [joiner, target, planItemCount] = await Promise.all([
    prisma.child.findMany({
      where: { OR: joinerOwned(input.userId, mine?.familyId ?? null) },
      select: { id: true, name: true, birthDate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.child.findMany({
      where: { familyId: invite.familyId },
      select: { id: true, name: true, birthDate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.planItem.count({
      where: {
        OR: [...(mine ? [{ familyId: mine.familyId }] : []), { userId: input.userId }],
      },
    }),
  ]);
  const view = (c: MergeChild) => ({
    id: c.id,
    name: c.name,
    birthYear: c.birthDate?.getUTCFullYear() ?? null,
  });
  return {
    joinerChildren: joiner.map(view),
    targetChildren: target.map(view),
    suggestions: Object.fromEntries(suggestChildMatches(joiner, target)),
    planItemCount,
  };
}

/**
 * Applies the joiner's explicit merge decision inside the accept transaction
 * (both families are already locked). Skipped data stays in the joiner's old
 * family, which the caller archives (kept 30 days, restore = later PR).
 */
export async function applyJoinerMerge(
  tx: Tx,
  input: {
    userId: string;
    mineFamilyId: string | null;
    targetFamilyId: string;
    decision: MergeDecision;
  },
): Promise<void> {
  const { userId, mineFamilyId, targetFamilyId, decision } = input;
  const [joinerChildren, targetChildren] = await Promise.all([
    tx.child.findMany({
      where: { OR: joinerOwned(userId, mineFamilyId) },
      select: { id: true, interests: true },
    }),
    tx.child.findMany({
      where: { familyId: targetFamilyId },
      select: { id: true, interests: true },
    }),
  ]);
  const problem = validateMergeDecision(
    joinerChildren.map((c) => c.id),
    targetChildren.map((c) => c.id),
    decision,
  );
  if (problem) throw new FamilyInviteError("merge_invalid", problem);

  const childById = new Map(joinerChildren.map((c) => [c.id, c]));
  const targetById = new Map(targetChildren.map((c) => [c.id, c]));
  const skippedChildIds = new Set<string>();
  const remap = new Map<string, string>();

  for (const d of decision.children) {
    if (d.action === "SKIP") {
      skippedChildIds.add(d.childId);
    } else if (d.action === "ADD") {
      await tx.child.update({ where: { id: d.childId }, data: { familyId: targetFamilyId } });
    } else {
      // SAME: keep the family's child (birth date and name come from the family),
      // union the interests, repoint plan items, drop the duplicate.
      const joinerChild = childById.get(d.childId)!;
      const targetChild = targetById.get(d.targetChildId)!;
      const system = await tx.childInterest.findMany({
        where: { childId: d.childId },
        select: { interestSlug: true, source: true },
      });
      if (system.length) {
        await tx.childInterest.createMany({
          data: system.map((s) => ({ childId: d.targetChildId, interestSlug: s.interestSlug, source: s.source })),
          skipDuplicates: true,
        });
      }
      const [targetCustom, joinerCustom] = await Promise.all([
        tx.childCustomInterest.findMany({ where: { childId: d.targetChildId }, select: { label: true } }),
        tx.childCustomInterest.findMany({ where: { childId: d.childId }, select: { id: true, label: true } }),
      ]);
      const have = new Set(targetCustom.map((c) => c.label.trim().toLowerCase()));
      const move = joinerCustom.filter((c) => !have.has(c.label.trim().toLowerCase())).map((c) => c.id);
      if (move.length) {
        await tx.childCustomInterest.updateMany({ where: { id: { in: move } }, data: { childId: d.targetChildId } });
      }
      const text = mergeInterestsText(targetChild.interests, joinerChild.interests);
      if (text !== targetChild.interests) {
        await tx.child.update({ where: { id: d.targetChildId }, data: { interests: text } });
      }
      remap.set(d.childId, d.targetChildId);
    }
  }

  if (decision.plan !== "SKIP") {
    const items = await tx.planItem.findMany({
      where: { OR: [...(mineFamilyId ? [{ familyId: mineFamilyId }] : []), { userId }] },
      select: { id: true, activityId: true, childId: true },
    });
    const familyActive = await tx.planItem.findMany({
      where: { familyId: targetFamilyId, visibility: "FAMILY", status: { not: "CANCELLED" }, activityId: { not: null } },
      select: { activityId: true },
    });
    const familyActivityIds = new Set(familyActive.map((i) => i.activityId!));
    for (const item of items) {
      const childId = item.childId
        ? remap.get(item.childId) ?? (skippedChildIds.has(item.childId) ? null : item.childId)
        : null;
      await tx.planItem.update({
        where: { id: item.id },
        data: {
          familyId: targetFamilyId,
          visibility: mergedPlanVisibility(decision.plan, item, familyActivityIds),
          childId,
        },
      });
    }
  }
  // Plan SKIP: items stay in the old family; deleting a merged duplicate nulls their childId (FK SET NULL).

  // Duplicates are merged away only after plan items were repointed.
  for (const from of remap.keys()) {
    await tx.child.delete({ where: { id: from } });
  }
}
