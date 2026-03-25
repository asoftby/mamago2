/**
 * Notification Service
 * Handles creation and management of in-app notifications
 * Server-only - do not import in client components
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import {
  NOTIFICATION_TYPES_BUSINESS,
  NOTIFICATION_TYPES_USER,
} from "@/lib/notifications/streamFilters";

export type NotificationStreamFilter = "user" | "business";

function mergeStreamFilter(
  base: Prisma.NotificationWhereInput,
  stream?: NotificationStreamFilter,
): Prisma.NotificationWhereInput {
  if (stream === "user") {
    return { ...base, type: { in: NOTIFICATION_TYPES_USER } };
  }
  if (stream === "business") {
    return { ...base, type: { in: NOTIFICATION_TYPES_BUSINESS } };
  }
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
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
    },
  });
}

/**
 * Create notification when Place is approved
 */
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

/**
 * Create notification when Place needs changes
 */
export async function notifyPlaceNeedsChanges(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string
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

/**
 * Create notification when Place is rejected
 */
export async function notifyPlaceRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string
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

/**
 * Create notification when Place update (revision) is approved
 */
export async function notifyPlaceUpdateApproved(
  placeId: string,
  placeName: string,
  ownerId: string
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_APPROVED",
    title: "Изменения опубликованы",
    message: `Изменения для места «${placeName}» успешно прошли модерацию и опубликованы.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

/**
 * Create notification when Place update (revision) needs revision
 */
export async function notifyPlaceUpdateNeedsRevision(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_NEEDS_REVISION",
    title: "Требуются правки",
    message: `Изменения для места «${placeName}» требуют правок. Откройте публикацию и внесите исправления. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

/**
 * Create notification when Place update (revision) is rejected
 */
export async function notifyPlaceUpdateRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string
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

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(
  userId: string,
  stream?: NotificationStreamFilter,
) {
  return prisma.notification.findMany({
    where: mergeStreamFilter(
      {
        userId,
        isRead: false,
      },
      stream,
    ),
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get all notifications for a user (paginated)
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0,
  stream?: NotificationStreamFilter,
) {
  return prisma.notification.findMany({
    where: mergeStreamFilter({ userId }, stream),
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    skip: offset,
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  return prisma.notification.update({
    where: {
      id: notificationId,
      userId, // Ensure user owns the notification
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
  userId: string,
  stream?: NotificationStreamFilter,
): Promise<number> {
  return prisma.notification.count({
    where: mergeStreamFilter(
      {
        userId,
        isRead: false,
      },
      stream,
    ),
  });
}

/**
 * Delete old read notifications (cleanup job)
 * Deletes notifications older than specified days
 */
export async function deleteOldNotifications(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return prisma.notification.deleteMany({
    where: {
      isRead: true,
      readAt: {
        lt: cutoffDate,
      },
    },
  });
}
