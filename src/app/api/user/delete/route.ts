/**
 * POST /api/user/delete
 * Hard-delete the authenticated user's account.
 *
 * - Personal data: deleted via Prisma cascade + explicit deletes
 * - Analytics (UserEvent): userId set to null (anonymised, record kept)
 * - AuditLog: строки с участием пользователя удаляются (actorId/targetId NOT NULL в схеме)
 * - Ссылки User? без onDelete Cascade — обнуляются до delete user
 * - Sessions: deleted → cookie becomes invalid on next request
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { deleteSessionCookieAction } from "@/lib/auth/session";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    await prisma.$transaction(async (tx) => {
      // 1. Anonymise analytics — keep rows, remove identity
      await tx.userEvent.updateMany({
        where: { userId },
        data: { userId: null, sessionId: null },
      });

      // 2. AuditLog: actorId/targetId обязательные — нельзя обнулить; удаляем записи с участием пользователя
      await tx.auditLog.deleteMany({
        where: { OR: [{ actorId: userId }, { targetId: userId }] },
      });

      // 3. Действия модератора, выданные этим пользователем (createdBy без Cascade)
      await tx.userModerationAction.deleteMany({
        where: { createdById: userId },
      });

      // 4. Опциональные FK на User без SetNull в схеме — обнуляем вручную
      await tx.mediaAsset.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: null },
      });
      await tx.route.updateMany({
        where: { authorId: userId },
        data: { authorId: null },
      });
      await tx.place.updateMany({
        where: { moderatedByUserId: userId },
        data: { moderatedByUserId: null },
      });
      await tx.place.updateMany({
        where: { archivedByUserId: userId },
        data: { archivedByUserId: null },
      });
      await tx.businessInvite.updateMany({
        where: { invitedById: userId },
        data: { invitedById: null },
      });
      await tx.businessVerificationLog.updateMany({
        where: { reviewedByUserId: userId },
        data: { reviewedByUserId: null },
      });
      await tx.business.updateMany({
        where: { reviewedByUserId: userId },
        data: { reviewedByUserId: null },
      });
      await tx.placeRevision.updateMany({
        where: { reviewedByUserId: userId },
        data: { reviewedByUserId: null },
      });
      await tx.placeClaimRequest.updateMany({
        where: { reviewedByUserId: userId },
        data: { reviewedByUserId: null },
      });
      await tx.moderationLog.updateMany({
        where: { reviewedByUserId: userId },
        data: { reviewedByUserId: null },
      });

      // 5. Hard-delete personal data (cascade handles children of these)
      // Order: leaf tables first, then parent rows

      await tx.userNotificationPreference.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.planItem.deleteMany({ where: { userId } });
      await tx.idea.deleteMany({ where: { userId } });
      await tx.routeIdea.deleteMany({ where: { userId } });
      await tx.phoneOtp.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.userBehaviorProfile.deleteMany({ where: { userId } });

      // Children + their interests (parentId → User; cascade при удалении User, но явно для ясности)
      const children = await tx.child.findMany({
        where: { parentId: userId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length > 0) {
        await tx.childInterest.deleteMany({ where: { childId: { in: childIds } } });
        await tx.childCustomInterest.deleteMany({ where: { childId: { in: childIds } } });
        await tx.child.deleteMany({ where: { parentId: userId } });
      }

      // 6. Finally delete the user — remaining FK relations use onDelete: Cascade
      await tx.user.delete({ where: { id: userId } });
    });

    // Clear session cookie
    const response = NextResponse.json({ success: true });
    await deleteSessionCookieAction();
    return response;
  } catch (error) {
    console.error("[user/delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
