import type { PrismaClient } from "@prisma/client";
import { createNotification } from "@/server/services/notification.service";
import { familyInviteValidity, hashInviteToken } from "./familyInvitePure";

export type InviteInfo = { inviterName: string | null };
export type FamilyInviteLanding =
  | { status: "valid"; inviterName: string | null }
  | { status: "already_member" | "expired" | "invalid" };

/**
 * Public link state, with no family details exposed to outsiders before
 * consent. Current family members may safely be told they're already members
 * even if the old token was accepted, revoked or expired.
 */
export async function getFamilyInviteLanding(
  prisma: PrismaClient,
  token: string,
  userId: string | null = null,
  now: Date = new Date(),
): Promise<FamilyInviteLanding> {
  const invite = await prisma.familyInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      status: true,
      createdAt: true,
      expiresAt: true,
      familyId: true,
      createdById: true,
      family: { select: { archivedAt: true } },
      createdBy: { select: { displayName: true } },
    },
  });
  if (!invite) return { status: "invalid" };

  if (userId) {
    const member = await prisma.familyMembership.findFirst({
      where: { familyId: invite.familyId, userId, leftAt: null },
      select: { id: true },
    });
    if (member && !invite.family.archivedAt) return { status: "already_member" };
  }
  const validity = familyInviteValidity(invite, now);
  if (validity === "expired") return { status: "expired" };
  if (validity !== "valid" || invite.family.archivedAt) return { status: "invalid" };
  const creator = await prisma.familyMembership.findFirst({
    where: { familyId: invite.familyId, userId: invite.createdById, leftAt: null },
    select: { id: true },
  });
  if (!creator) return { status: "invalid" };
  return { status: "valid", inviterName: invite.createdBy.displayName?.trim() || null };
}

/** Compatibility for other readers: only a valid invite discloses inviter name. */
export async function getFamilyInviteInfo(
  prisma: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<InviteInfo | null> {
  const result = await getFamilyInviteLanding(prisma, token, null, now);
  return result.status === "valid" ? { inviterName: result.inviterName } : null;
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
