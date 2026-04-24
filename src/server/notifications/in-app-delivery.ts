import "server-only";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  NotificationDeliveryOutcome,
  PreparedNotificationPayload,
} from "@/lib/notifications/domainContracts";
import type { NotificationAudience } from "@prisma/client";
import { createNotificationDeliveryRecord, recordSkippedNotificationDelivery } from "./delivery-log";
import { resolveNotificationTypeForScenario } from "./notification-scenario";

type InAppDeliveryRecord = {
  notificationId: string;
  deliveryId: string;
  outcome: NotificationDeliveryOutcome;
};

function resolveNotificationAudience(
  scenario: PreparedNotificationPayload["scenario"],
): NotificationAudience {
  switch (scenario) {
    case "PLAN_EVENT_2H_BEFORE":
      return "USER";
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}

async function markFailedDelivery(params: {
  userId: string;
  notificationId: string;
  scenario: PreparedNotificationPayload["scenario"];
  dedupeKey: string;
  errorMessage: string;
  payloadJson: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.notificationDelivery.create({
      data: {
        userId: params.userId,
        notificationId: params.notificationId,
        scenario: params.scenario,
        channel: "IN_APP",
        status: "FAILED",
        dedupeKey: params.dedupeKey,
        payloadJson: params.payloadJson,
        errorMessage: params.errorMessage,
      },
    });
  } catch (error) {
    console.error("[notifications:in-app] failed to persist FAILED delivery", error);
  }
}

export async function sendInAppNotification(
  prepared: PreparedNotificationPayload,
): Promise<InAppDeliveryRecord> {
  const payloadJson: Prisma.InputJsonValue = {
    scenario: prepared.scenario,
    context: {
      planItemId: prepared.context.planItemId,
      activityId: prepared.context.activityId ?? null,
      eventTitle: prepared.context.eventTitle,
      startsAt: prepared.context.startsAt.toISOString(),
      placeName: prepared.context.placeName ?? null,
      cityName: prepared.context.cityName ?? null,
    },
    content: prepared.content,
  };

  const notification = await prisma.notification.create({
    data: {
      userId: prepared.userId,
      audience: resolveNotificationAudience(prepared.scenario),
      type: resolveNotificationTypeForScenario(prepared.scenario),
      scenario: prepared.scenario,
      title: prepared.content.title,
      body: prepared.content.body,
      ctaLabel: prepared.content.ctaLabel,
      ctaAction: prepared.content.ctaUrl,
      entityType: "PLAN_ITEM",
      entityId: prepared.context.planItemId,
    },
    select: { id: true },
  });

  try {
    const delivery = await createNotificationDeliveryRecord({
      userId: prepared.userId,
      notificationId: notification.id,
      prepared,
      channel: "IN_APP",
      status: "SENT",
      payloadJson,
      sentAt: new Date(),
    });

    return {
      notificationId: notification.id,
      deliveryId: delivery.id,
      outcome: {
        channel: "IN_APP",
        status: "SENT",
        deliveryId: delivery.id,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "IN_APP_DELIVERY_CREATE_FAILED";

    await markFailedDelivery({
      userId: prepared.userId,
      notificationId: notification.id,
      scenario: prepared.scenario,
      dedupeKey: prepared.dedupeKey,
      payloadJson,
      errorMessage,
    });

    throw error;
  }
}

export async function skipInAppNotification(
  prepared: PreparedNotificationPayload,
): Promise<NotificationDeliveryOutcome> {
  return recordSkippedNotificationDelivery({
    userId: prepared.userId,
    prepared,
    channel: "IN_APP",
    reason: "USER_DISABLED_CHANNEL",
    payloadJson: {
      scenario: prepared.scenario,
      context: {
        planItemId: prepared.context.planItemId,
        activityId: prepared.context.activityId ?? null,
      },
    },
  });
}
