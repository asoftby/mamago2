import "server-only";

import { createHash } from "node:crypto";
import { BusinessMemberRole, FamilyRole, PlanVisibility, Role, UserStatus, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildIdentityPayload,
  IDENTITY_SOURCE_SELECT,
  IdentityRetentionKeyError,
  identityRetentionPurgeAfter,
  loadPublicKeyFromEnv,
  sealIdentityPayload,
  type IdentityRetentionPublicKey,
} from "@/server/privacy/identityRetention/envelope";

export type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false;
      code: "ACCOUNT_NOT_FOUND" | "BUSINESS_OWNER_TRANSFER_REQUIRED" | "LAST_ADMIN" | "IDENTITY_RETENTION_UNAVAILABLE";
    };

export type DeleteAccountOptions = {
  /** Test seam; production reads IDENTITY_RETENTION_PUBLIC_KEY from the environment. */
  identityRetentionPublicKey?: IdentityRetentionPublicKey;
};

function tombstoneEmail(userId: string): string {
  const digest = createHash("sha256").update(`mamago-deleted-user:${userId}`).digest("hex");
  return `deleted-${digest}@deleted.invalid`;
}

async function closeMembership(
  tx: Prisma.TransactionClient,
  membership: { id: string; familyId: string; role: FamilyRole },
  deletedAt: Date,
): Promise<void> {
  await tx.familyMembership.update({ where: { id: membership.id }, data: { leftAt: deletedAt } });

  const successor = await tx.familyMembership.findFirst({
    where: { familyId: membership.familyId, leftAt: null },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  if (successor) {
    if (membership.role === FamilyRole.OWNER) {
      await tx.familyMembership.update({ where: { id: successor.id }, data: { role: FamilyRole.OWNER } });
    }
  } else {
    await tx.family.update({ where: { id: membership.familyId }, data: { archivedAt: deletedAt } });
    // Child interests / custom interests cascade; PlanItem.childId is SET NULL.
    await tx.planItem.deleteMany({ where: { familyId: membership.familyId } });
    await tx.child.deleteMany({ where: { familyId: membership.familyId } });
  }
}

/**
 * Family Core B3: detaches the deleted user from their family and erases the
 * family data that must not outlive them. Always family-aware (independent of
 * the family-reads rollout flag) and never creates a family.
 *
 * - active membership is closed (`leftAt = deletedAt`), history is kept;
 * - an OWNER leaving a family with other adults hands ownership to the
 *   earliest joiner (joinedAt, id); the old owner is closed first so the
 *   `FamilyMembership_active_owner` partial unique index holds;
 * - the last adult archives the family and erases its Child/PlanItem rows;
 * - otherwise FAMILY plan items and shared children survive (ACL is familyId;
 *   `parentId`/`userId` on them stay as tombstone provenance).
 */
async function detachFromFamily(
  tx: Prisma.TransactionClient,
  userId: string,
  deletedAt: Date,
): Promise<void> {
  const located = await tx.familyMembership.findFirst({
    where: { userId, leftAt: null },
    select: { familyId: true },
  });

  if (located) {
    // Serialise concurrent deletions of adults of one family. The role is read
    // only AFTER the lock: a concurrent deletion may have promoted this user to
    // OWNER while we waited, and a pre-lock read would then be stale.
    await tx.$queryRaw`SELECT id FROM "Family" WHERE id = ${located.familyId} FOR UPDATE`;
    const membership = await tx.familyMembership.findFirst({
      where: { userId, familyId: located.familyId, leftAt: null },
      select: { id: true, familyId: true, role: true },
    });
    if (membership) await closeMembership(tx, membership, deletedAt);
  }

  // Private entries of the deleted user and legacy (family-less) rows are theirs alone.
  await tx.planItem.deleteMany({
    where: { userId, OR: [{ familyId: null }, { visibility: PlanVisibility.PRIVATE }] },
  });
  await tx.child.deleteMany({ where: { parentId: userId, familyId: null } });
  // createdById has no FK: scrub the deleted user from surviving family children.
  await tx.child.updateMany({ where: { createdById: userId }, data: { createdById: null } });
}

/**
 * Canonical account-deletion policy. Required User foreign keys on shared and
 * business records make hard deletion destructive, so a non-identifying,
 * non-authenticatable tombstone is retained while private data is erased.
 *
 * Постановление Совмина РБ № 850: identification data (email, phone, name,
 * Telegram) must be kept for one year after the user agreement ends. Before the
 * live columns are wiped, they are sealed with the public retention key into
 * IdentityRetentionRecord in the same transaction. Without a usable key the
 * deletion is refused up front (fail closed) — nothing is written.
 */
export async function deleteAccount(
  userId: string,
  client: PrismaClient = prisma,
  options: DeleteAccountOptions = {},
): Promise<DeleteAccountResult> {
  let retentionKey: IdentityRetentionPublicKey;
  try {
    retentionKey = options.identityRetentionPublicKey ?? loadPublicKeyFromEnv();
  } catch (error) {
    const code = error instanceof IdentityRetentionKeyError ? error.code : "UNKNOWN";
    console.error(`[deleteAccount] identity retention key unavailable code=${code}`);
    return { ok: false, code: "IDENTITY_RETENTION_UNAVAILABLE" };
  }

  return client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ...IDENTITY_SOURCE_SELECT, role: true, deletedAt: true },
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

    const sealed = sealIdentityPayload(buildIdentityPayload(user, deletedAt), retentionKey);
    await tx.identityRetentionRecord.create({
      data: {
        userId,
        keyId: sealed.keyId,
        envelope: sealed.envelope,
        accountCreatedAt: user.createdAt,
        agreementEndedAt: deletedAt,
        purgeAfter: identityRetentionPurgeAfter(deletedAt),
      },
    });

    await tx.userEvent.updateMany({
      where: { userId },
      data: { userId: null, sessionId: null, familyId: null },
    });
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
    await detachFromFamily(tx, userId, deletedAt);
    // The User row stays as a tombstone, so the FK cascade never fires (BACKLOG-162).
    await tx.experience.deleteMany({ where: { userId } });
    // Inbox rows hold forwarded message text; the User row is retained as a tombstone,
    // so the FK cascade never fires. InboxItemPart is removed by cascade from InboxItem.
    await tx.inboxItem.deleteMany({ where: { userId } });
    await tx.idea.deleteMany({ where: { userId } });
    await tx.routeIdea.deleteMany({ where: { userId } });
    await tx.offerIdea.deleteMany({ where: { userId } });
    await tx.placeIdea.deleteMany({ where: { userId } });
    await tx.articleIdea.deleteMany({ where: { userId } });
    await tx.routeRating.deleteMany({ where: { userId } });
    await tx.articleRating.deleteMany({ where: { userId } });
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
