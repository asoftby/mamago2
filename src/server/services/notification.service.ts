/**
 * Notification Service
 *
 * Single entry point for all in-app notifications + delivery dispatch.
 * Server-only — do not import in client components.
 *
 * Flow:
 *   createNotification(params) → saves Notification → dispatchDelivery(notification, user)
 *
 * All notify*() helpers are thin wrappers that resolve the owner userId
 * and call createNotification(). Route handlers should call these helpers,
 * not createNotification() directly.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import {
  NOTIFICATION_TYPES_BUSINESS,
  NOTIFICATION_TYPES_USER,
} from "@/lib/notifications/streamFilters";
import { dispatchDelivery } from "./notificationDelivery.service";

export type NotificationStreamFilter = "user" | "business";

function mergeStreamFilter(
  base: Prisma.NotificationWhereInput,
  stream?: NotificationStreamFilter,
): Prisma.NotificationWhereInput {
  if (stream === "user") return { ...base, type: { in: NOTIFICATION_TYPES_USER } };
  if (stream === "business") return { ...base, type: { in: NOTIFICATION_TYPES_BUSINESS } };
  return base;
}

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Core: create in-app notification record + dispatch delivery channels.
 * Never throws on delivery failure — delivery errors are recorded in NotificationDelivery.
 */
export async function createNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    },
  });

  // Dispatch delivery async — fire and forget, never blocks the caller
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, role: true },
  });
  if (user) {
    dispatchDelivery(notification, user).catch((e) =>
      console.error("[notification] dispatchDelivery failed:", e),
    );
  }

  return notification;
}

// ── PLACE ─────────────────────────────────────────────────────────────────────

export async function notifyPlaceApproved(placeId: string, placeName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_APPROVED",
    title: "Место опубликовано",
    message: `Ваше место «${placeName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceNeedsChanges(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_NEEDS_CHANGES",
    title: "Требуются правки",
    message: `Ваше место «${placeName}» требует доработки. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_REJECTED",
    title: "Место отклонено",
    message: `Ваше место «${placeName}» было отклонено. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateApproved(placeId: string, placeName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_APPROVED",
    title: "Изменения опубликованы",
    message: `Изменения для места «${placeName}» успешно прошли модерацию и опубликованы.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateNeedsRevision(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_NEEDS_REVISION",
    title: "Требуются правки",
    message: `Изменения для места «${placeName}» требуют правок. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_REJECTED",
    title: "Изменения отклонены",
    message: `Изменения для места «${placeName}» были отклонены. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

// ── ACTIVITY ──────────────────────────────────────────────────────────────────

export async function notifyActivityApproved(activityId: string, activityName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_APPROVED",
    title: "Событие опубликовано",
    message: `Ваше событие «${activityName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

export async function notifyActivityNeedsChanges(
  activityId: string,
  activityName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_NEEDS_CHANGES",
    title: "Требуются правки",
    message: `Ваше событие «${activityName}» требует доработки. ${moderatorComment}`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

export async function notifyActivityRejected(
  activityId: string,
  activityName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_REJECTED",
    title: "Событие отклонено",
    message: `Ваше событие «${activityName}» было отклонено. ${moderatorComment}`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

// ── OFFER ─────────────────────────────────────────────────────────────────────

export async function notifyOfferApproved(offerId: string, offerName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "OFFER_APPROVED",
    title: "Предложение опубликовано",
    message: `Ваше предложение «${offerName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

export async function notifyOfferNeedsChanges(
  offerId: string,
  offerName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "OFFER_NEEDS_CHANGES",
    title: "Требуются правки",
    message: `Ваше предложение «${offerName}» требует доработки. ${moderatorComment}`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

export async function notifyOfferRejected(
  offerId: string,
  offerName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "OFFER_REJECTED",
    title: "Предложение отклонено",
    message: `Ваше предложение «${offerName}» было отклонено. ${moderatorComment}`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

// ── BUSINESS VERIFICATION ─────────────────────────────────────────────────────

export async function notifyBusinessVerified(businessId: string, businessName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "BUSINESS_VERIFIED",
    title: "Верификация пройдена",
    message: `Ваш бизнес «${businessName}» успешно верифицирован. Теперь вы можете публиковать места и события.`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessRejected(
  businessId: string,
  businessName: string,
  ownerId: string,
  note: string,
) {
  return createNotification({
    userId: ownerId,
    type: "BUSINESS_REJECTED",
    title: "Верификация отклонена",
    message: `Верификация бизнеса «${businessName}» отклонена. ${note}`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessNeedsInfo(
  businessId: string,
  businessName: string,
  ownerId: string,
  note: string,
) {
  return createNotification({
    userId: ownerId,
    type: "BUSINESS_NEEDS_INFO",
    title: "Требуется дополнительная информация",
    message: `Для верификации бизнеса «${businessName}» требуется дополнительная информация. ${note}`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

// ── READ / QUERY ──────────────────────────────────────────────────────────────

export async function getUnreadNotifications(userId: string, stream?: NotificationStreamFilter) {
  return prisma.notification.findMany({
    where: mergeStreamFilter({ userId, isRead: false }, stream),
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0,
  stream?: NotificationStreamFilter,
) {
  return prisma.notification.findMany({
    where: mergeStreamFilter({ userId }, stream),
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function getUnreadCount(userId: string, stream?: NotificationStreamFilter): Promise<number> {
  return prisma.notification.count({
    where: mergeStreamFilter({ userId, isRead: false }, stream),
  });
}

export async function deleteOldNotifications(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  return prisma.notification.deleteMany({
    where: { isRead: true, readAt: { lt: cutoffDate } },
  });
}
