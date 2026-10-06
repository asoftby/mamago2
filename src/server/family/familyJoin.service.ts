import type { PrismaClient } from "@prisma/client";
import { createNotification } from "@/server/services/notification.service";
import { hashInviteToken, isInviteUsable } from "./familyInvitePure";

export type InviteInfo = { inviterName: string | null };

/**
 * What an invite link may reveal BEFORE the consent: only who invites.
 * No children, no plan, no other adults. Null = unusable link.
 */
export async function getFamilyInviteInfo(
  prisma: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<InviteInfo | null> {
  const invite = await prisma.familyInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      status: true,
      expiresAt: true,
      familyId: true,
      createdById: true,
      family: { select: { archivedAt: true } },
      createdBy: { select: { displayName: true } },
    },
  });
  if (!invite || !isInviteUsable(invite, now) || invite.family.archivedAt) return null;
  const creator = await prisma.familyMembership.findFirst({
    where: { familyId: invite.familyId, userId: invite.createdById, leftAt: null },
    select: { id: true },
  });
  if (!creator) return null;
  return { inviterName: invite.createdBy.displayName?.trim() || null };
}

/** Tells the inviter (in-app) that someone joined. Best effort, never throws. */
export async function notifyInviterJoined(
  prisma: PrismaClient,
  input: { familyId: string; joinerUserId: string },
): Promise<void> {
  try {
    const invite = await prisma.familyInvite.findFirst({
      where: { familyId: input.familyId, acceptedById: input.joinerUserId, status: "ACCEPTED" },
      orderBy: { acceptedAt: "desc" },
      select: { createdById: true },
    });
    if (!invite || invite.createdById === input.joinerUserId) return;
    const joiner = await prisma.user.findUnique({
      where: { id: input.joinerUserId },
      select: { displayName: true },
    });
    const name = joiner?.displayName?.trim() || "Новый взрослый";
    await createNotification({
      userId: invite.createdById,
      type: "SYSTEM_INFO",
      title: `${name} присоединился(ась) к вашей семье`,
      body: "Теперь дети и общие записи плана видны вам обоим. Личные записи остаются личными.",
      ctaLabel: "Открыть семью",
      actionUrl: "/me/profile",
    });
  } catch (error) {
    console.error("[familyJoin] notify inviter failed", error instanceof Error ? error.message : "unknown");
  }
}
