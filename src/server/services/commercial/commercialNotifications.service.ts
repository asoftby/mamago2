/**
 * Commercial Notifications Service
 * 
 * Manages notifications for commercial events (contract/placement expiration).
 * Separate from general user notifications.
 */

import { prisma } from "@/lib/prisma";
import type { CommercialNotificationType, CommercialNotificationStatus, Prisma } from "@prisma/client";

export interface NotificationFilters {
  businessId?: string;
  type?: CommercialNotificationType;
  status?: CommercialNotificationStatus;
  scheduledBefore?: Date;
}

export interface CreateNotificationInput {
  businessId: string;
  type: CommercialNotificationType;
  title: string;
  message: string;
  relatedContractId?: string;
  relatedPlacementId?: string;
  relatedServicePlacementId?: string;
  scheduledFor: Date;
}

/**
 * Get notifications with filters
 */
export async function getNotifications(filters: NotificationFilters = {}) {
  const where: Prisma.CommercialNotificationWhereInput = {};

  if (filters.businessId) {
    where.businessId = filters.businessId;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.scheduledBefore) {
    where.scheduledFor = {
      lte: filters.scheduledBefore,
    };
  }

  return prisma.commercialNotification.findMany({
    where,
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
      relatedContract: {
        select: {
          id: true,
          contractNumber: true,
          endsAt: true,
        },
      },
      relatedPlacement: {
        select: {
          id: true,
          endsAt: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      },
      relatedServicePlacement: {
        select: {
          id: true,
          entityType: true,
          endsAt: true,
        },
      },
    },
    orderBy: {
      scheduledFor: "desc",
    },
  });
}

/**
 * Get notification by ID
 */
export async function getNotificationById(id: string) {
  return prisma.commercialNotification.findUnique({
    where: { id },
    include: {
      business: true,
      relatedContract: true,
      relatedPlacement: {
        include: {
          plan: true,
        },
      },
      relatedServicePlacement: true,
    },
  });
}

/**
 * Get notifications for business
 */
export async function getBusinessNotifications(businessId: string) {
  return prisma.commercialNotification.findMany({
    where: { businessId },
    include: {
      relatedContract: {
        select: {
          contractNumber: true,
          endsAt: true,
        },
      },
      relatedPlacement: {
        select: {
          endsAt: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      },
      relatedServicePlacement: {
        select: {
          entityType: true,
          endsAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get unread notifications for business
 */
export async function getUnreadNotifications(businessId: string) {
  return prisma.commercialNotification.findMany({
    where: {
      businessId,
      status: {
        in: ["PENDING", "SENT"],
      },
    },
    orderBy: {
      scheduledFor: "asc",
    },
  });
}

/**
 * Create notification
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.commercialNotification.create({
    data: {
      businessId: input.businessId,
      type: input.type,
      status: "PENDING",
      title: input.title,
      message: input.message,
      relatedContractId: input.relatedContractId,
      relatedPlacementId: input.relatedPlacementId,
      relatedServicePlacementId: input.relatedServicePlacementId,
      scheduledFor: input.scheduledFor,
    },
  });
}

/**
 * Mark notification as sent
 */
export async function markNotificationSent(id: string) {
  return prisma.commercialNotification.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string) {
  return prisma.commercialNotification.update({
    where: { id },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });
}

/**
 * Dismiss notification
 */
export async function dismissNotification(id: string) {
  return prisma.commercialNotification.update({
    where: { id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
    },
  });
}

/**
 * Get pending notifications to send (cron job)
 */
export async function getPendingNotificationsToSend() {
  const now = new Date();

  return prisma.commercialNotification.findMany({
    where: {
      status: "PENDING",
      scheduledFor: {
        lte: now,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
    },
  });
}

/**
 * Create contract expiring notification
 */
export async function createContractExpiringNotification(
  businessId: string,
  contractId: string,
  contractNumber: string,
  endsAt: Date,
  daysBeforeExpiry: number
) {
  const scheduledFor = new Date(endsAt.getTime() - daysBeforeExpiry * 24 * 60 * 60 * 1000);

  return createNotification({
    businessId,
    type: "CONTRACT_EXPIRING",
    title: "Договор истекает",
    message: `Ваш договор ${contractNumber} истекает ${endsAt.toLocaleDateString("ru-RU")}. Пожалуйста, свяжитесь с нами для продления.`,
    relatedContractId: contractId,
    scheduledFor,
  });
}

/**
 * Create contract expired notification
 */
export async function createContractExpiredNotification(
  businessId: string,
  contractId: string,
  contractNumber: string,
  endsAt: Date
) {
  return createNotification({
    businessId,
    type: "CONTRACT_EXPIRED",
    title: "Договор истек",
    message: `Ваш договор ${contractNumber} истек ${endsAt.toLocaleDateString("ru-RU")}. Для возобновления услуг необходимо заключить новый договор.`,
    relatedContractId: contractId,
    scheduledFor: endsAt,
  });
}

/**
 * Create placement expiring notification
 */
export async function createPlacementExpiringNotification(
  businessId: string,
  placementId: string,
  endsAt: Date,
  daysBeforeExpiry: number
) {
  const scheduledFor = new Date(endsAt.getTime() - daysBeforeExpiry * 24 * 60 * 60 * 1000);

  return createNotification({
    businessId,
    type: "PLACEMENT_EXPIRING",
    title: "Размещение заканчивается",
    message: `Ваше коммерческое размещение заканчивается ${endsAt.toLocaleDateString("ru-RU")}. После окончания доступ к премиум-функциям будет ограничен.`,
    relatedPlacementId: placementId,
    scheduledFor,
  });
}

/**
 * Create placement expired notification
 */
export async function createPlacementExpiredNotification(
  businessId: string,
  placementId: string,
  endsAt: Date
) {
  return createNotification({
    businessId,
    type: "PLACEMENT_EXPIRED",
    title: "Размещение завершено",
    message: `Ваше коммерческое размещение завершено. Премиум-функции отключены. Для продления свяжитесь с нами.`,
    relatedPlacementId: placementId,
    scheduledFor: endsAt,
  });
}

/**
 * Create service placement expiring notification
 */
export async function createServiceExpiringNotification(
  businessId: string,
  servicePlacementId: string,
  entityType: string,
  endsAt: Date,
  daysBeforeExpiry: number
) {
  const scheduledFor = new Date(endsAt.getTime() - daysBeforeExpiry * 24 * 60 * 60 * 1000);

  return createNotification({
    businessId,
    type: "SERVICE_EXPIRING",
    title: "Услуга заканчивается",
    message: `Ваша услуга (${entityType}) заканчивается ${endsAt.toLocaleDateString("ru-RU")}.`,
    relatedServicePlacementId: servicePlacementId,
    scheduledFor,
  });
}

/**
 * Create service placement expired notification
 */
export async function createServiceExpiredNotification(
  businessId: string,
  servicePlacementId: string,
  entityType: string,
  endsAt: Date
) {
  return createNotification({
    businessId,
    type: "SERVICE_EXPIRED",
    title: "Услуга завершена",
    message: `Ваша услуга (${entityType}) завершена ${endsAt.toLocaleDateString("ru-RU")}.`,
    relatedServicePlacementId: servicePlacementId,
    scheduledFor: endsAt,
  });
}
