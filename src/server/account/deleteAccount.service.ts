import "server-only";

import { createHash } from "node:crypto";
import { BusinessMemberRole, Role, UserStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "ACCOUNT_NOT_FOUND" | "BUSINESS_OWNER_TRANSFER_REQUIRED" | "LAST_ADMIN" };

function tombstoneEmail(userId: string): string {
  const digest = createHash("sha256").update(`mamago-deleted-user:${userId}`).digest("hex");
  return `deleted-${digest}@deleted.invalid`;
}

/**
 * Canonical account-deletion policy. Required User foreign keys on shared and
 * business records make hard deletion destructive, so a non-identifying,
 * non-authenticatable tombstone is retained while private data is erased.
 */
export async function deleteAccount(
  userId: string,
  client: PrismaClient = prisma,
): Promise<DeleteAccountResult> {
  return client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return { ok: false, code: "ACCOUNT_NOT_FOUND" };

    const [ownedBusiness, ownerMembership] = await Promise.all([
      tx.business.findFirst({ where: { ownerUserId: userId }, select: { id: true } }),
      tx.businessMember.findFirst({
        where: { userId, role: BusinessMemberRole.OWNER, isActive: true },
        select: { id: true },
      }),
    ]);
    if (ownedBusiness || ownerMembership) {
      return { ok: false, code: "BUSINESS_OWNER_TRANSFER_REQUIRED" };
    }

    if (user.role === Role.ADMIN) {
      const activeAdmins = await tx.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE, deletedAt: null },
      });
      if (activeAdmins <= 1) return { ok: false, code: "LAST_ADMIN" };
    }

    const deletedAt = new Date();
    const anonymousEmail = tombstoneEmail(userId);

    await tx.userEvent.updateMany({ where: { userId }, data: { userId: null, sessionId: null } });
    await tx.recommendationRun.updateMany({ where: { userId }, data: { userId: null, sessionId: null } });
    await tx.searchQueryLog.updateMany({ where: { userId }, data: { userId: null, sessionId: null } });

    // TEMP assets have no retained product purpose. Removing their DB rows also
    // makes any orphaned storage object unreachable through authenticated media routes.
    await tx.mediaAsset.deleteMany({
      where: { uploadedById: userId, status: "TEMP", usages: { none: {} } },
    });
    // Published/business media survives; detach the deleted person's identity.
    await tx.mediaAsset.updateMany({ where: { uploadedById: userId }, data: { uploadedById: null } });
    await tx.route.updateMany({ where: { authorId: userId }, data: { authorId: null } });
    await tx.article.updateMany({
      where: { authorUserId: userId },
      data: { authorUserId: null, authorLabel: "Удалённый пользователь" },
    });
    await tx.directMessage.updateMany({ where: { senderUserId: userId }, data: { senderUserId: null } });
    await tx.directRiskSignal.updateMany({ where: { customerUserId: userId }, data: { customerUserId: null } });
    await tx.bookingFeedback.updateMany({ where: { userId }, data: { userId: null } });
    await tx.bookingRequest.updateMany({
      where: { userId },
      data: {
        userId: null,
        customerName: "Удалённый пользователь",
        customerPhone: "",
        customerEmail: null,
        customerComment: null,
        childName: null,
        childAge: null,
      },
    });
    await tx.businessAccessRequest.updateMany({
      where: { requesterUserId: userId },
      data: { name: "Удалённый пользователь", phone: null, email: null, comment: null },
    });
    await tx.placeClaimRequest.updateMany({ where: { userId }, data: { note: null } });

    await tx.notificationDelivery.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.userNotificationPreference.deleteMany({ where: { userId } });
    await tx.userNotificationSchedule.deleteMany({ where: { userId } });
    await tx.dayScenario.deleteMany({ where: { userId } });
    await tx.planItem.deleteMany({ where: { userId } });
    await tx.idea.deleteMany({ where: { userId } });
    await tx.routeIdea.deleteMany({ where: { userId } });
    await tx.offerIdea.deleteMany({ where: { userId } });
    await tx.placeIdea.deleteMany({ where: { userId } });
    await tx.articleIdea.deleteMany({ where: { userId } });
    await tx.routeRating.deleteMany({ where: { userId } });
    await tx.articleRating.deleteMany({ where: { userId } });
    await tx.child.deleteMany({ where: { parentId: userId } });
    await tx.tempMedia.deleteMany({ where: { ownerUserId: userId } });
    await tx.userBehaviorProfile.deleteMany({ where: { userId } });
    await tx.unsubscribeToken.deleteMany({ where: { userId } });
    await tx.telegramLinkToken.deleteMany({ where: { userId } });
    await tx.telegramConnection.deleteMany({ where: { userId } });
    await tx.devTelegramBusinessApplication.deleteMany({ where: { userId } });
    await tx.operationsViewState.deleteMany({ where: { userId } });
    await tx.activationDeliveryAudit.deleteMany({ where: { userId } });
    await tx.userActionToken.deleteMany({ where: { userId } });
    await tx.phoneOtp.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.businessMember.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail,
        passwordHash: null,
        role: Role.USER,
        resetToken: null,
        resetTokenExpires: null,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        phoneE164: null,
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        lastVerificationEmailSentAt: null,
        lastLoginAt: null,
        deletedAt,
        status: UserStatus.SUSPENDED,
        statusReason: "ACCOUNT_DELETED",
        suspendedUntil: null,
        avatarUrl: null,
        displayName: null,
        leisureFormatSignalId: null,
        preferenceSignalIds: [],
        profileSignalIds: [],
        familyRole: null,
        ageBandLabel: null,
        preferenceSummary: null,
        leisureFormatSummary: null,
        telegramConnected: false,
        telegramId: null,
        telegramUsername: null,
        telegramPromptDismissedAt: null,
        businessContactOtpFailedAttempts: 0,
        businessContactOtpLockTier: 0,
        businessContactOtpLockedUntil: null,
        businessContactOtpSupportRequired: false,
        marketingEmailsEnabled: false,
      },
    });

    return { ok: true };
  });
}
