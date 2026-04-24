import "server-only";

import prisma from "@/lib/prisma";
import type {
  NotificationDeliveryOutcome,
  NotificationDeliverySuppressedReason,
  PreparedNotificationPayload,
} from "@/lib/notifications/domainContracts";
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  Prisma,
} from "@prisma/client";

type DeliveryRecordParams = {
  userId: string;
  notificationId?: string | null;
  prepared: PreparedNotificationPayload;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  payloadJson?: Prisma.InputJsonValue;
  errorMessage?: string | NotificationDeliverySuppressedReason | null;
  sentAt?: Date | null;
};

export async function createNotificationDeliveryRecord(
  params: DeliveryRecordParams,
): Promise<{ id: string }> {
  if (params.notificationId) {
    return prisma.notificationDelivery.upsert({
      where: {
        notificationId_channel: {
          notificationId: params.notificationId,
          channel: params.channel,
        },
      },
      create: {
        userId: params.userId,
        notificationId: params.notificationId,
        scenario: params.prepared.scenario,
        channel: params.channel,
        status: params.status,
        dedupeKey: params.prepared.dedupeKey,
        payloadJson: params.payloadJson,
        errorMessage: params.errorMessage ?? null,
        sentAt: params.sentAt ?? null,
      },
      update: {
        userId: params.userId,
        scenario: params.prepared.scenario,
        status: params.status,
        dedupeKey: params.prepared.dedupeKey,
        payloadJson: params.payloadJson,
        errorMessage: params.errorMessage ?? null,
        sentAt: params.sentAt ?? null,
      },
      select: { id: true },
    });
  }

  return prisma.notificationDelivery.create({
    data: {
      userId: params.userId,
      scenario: params.prepared.scenario,
      channel: params.channel,
      status: params.status,
      dedupeKey: params.prepared.dedupeKey,
      payloadJson: params.payloadJson,
      errorMessage: params.errorMessage ?? null,
      sentAt: params.sentAt ?? null,
    },
    select: { id: true },
  });
}

export async function markNotificationDeliveryRecord(
  deliveryId: string,
  params: {
    status: NotificationDeliveryStatus;
    errorMessage?: string | NotificationDeliverySuppressedReason | null;
    sentAt?: Date | null;
  },
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      sentAt: params.sentAt ?? null,
    },
  });
}

export async function recordSkippedNotificationDelivery(params: {
  userId: string;
  notificationId?: string | null;
  prepared: PreparedNotificationPayload;
  channel: NotificationChannel;
  reason: NotificationDeliverySuppressedReason;
  payloadJson?: Prisma.InputJsonValue;
}): Promise<NotificationDeliveryOutcome> {
  const delivery = await createNotificationDeliveryRecord({
    userId: params.userId,
    notificationId: params.notificationId,
    prepared: params.prepared,
    channel: params.channel,
    status: "SKIPPED",
    errorMessage: params.reason,
    payloadJson: params.payloadJson,
  });

  return {
    channel: params.channel,
    status: "SKIPPED",
    deliveryId: delivery.id,
    errorMessage: params.reason,
  };
}
