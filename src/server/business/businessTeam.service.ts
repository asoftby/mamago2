/**
 * Team listing / manager deactivation (OWNER-only for destructive actions).
 */

import { BusinessMemberRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  canListBusinessInvites,
  isBusinessOwnerForInvites,
} from "@/server/business/businessInvite.service";

export async function assertCanViewTeam(
  userId: string,
  businessId: string,
): Promise<boolean> {
  return canListBusinessInvites(userId, businessId);
}

export async function getTeamMembersForBusiness(businessId: string) {
  const rows = await prisma.businessMember.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.sort((a, b) => {
    if (a.role === b.role) return 0;
    if (a.role === BusinessMemberRole.OWNER) return -1;
    if (b.role === BusinessMemberRole.OWNER) return 1;
    return 0;
  });
}

export type DeactivateMemberResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "NOT_OWNER"
        | "NOT_FOUND"
        | "CANNOT_DEACTIVATE_OWNER"
        | "CANNOT_DEACTIVATE_SELF";
    };

export async function deactivateBusinessMember(
  actorUserId: string,
  businessId: string,
  memberId: string,
): Promise<DeactivateMemberResult> {
  if (!(await isBusinessOwnerForInvites(actorUserId, businessId))) {
    return { ok: false, code: "NOT_OWNER" };
  }

  const member = await prisma.businessMember.findFirst({
    where: { id: memberId, businessId },
  });

  if (!member) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (member.role === BusinessMemberRole.OWNER) {
    return { ok: false, code: "CANNOT_DEACTIVATE_OWNER" };
  }

  if (member.userId === actorUserId) {
    return { ok: false, code: "CANNOT_DEACTIVATE_SELF" };
  }

  await prisma.businessMember.update({
    where: { id: member.id },
    data: { isActive: false },
  });

  return { ok: true };
}
