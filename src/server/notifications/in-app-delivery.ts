import "server-only";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  NotificationDeliveryOutcome,
  PlanEventReminderContext,
  PlanTomorrowDigestContext,
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
    case "PLAN_TOMORROW_DIGEST":
      return "USER";
    default: {
      const exhaustiveCheck: never = scenario;
      return exhaustiveCheck;
    }
  }
}

function buildInAppPayloadJson(
  prepared: PreparedNotificationPayload,
): Prisma.InputJsonValue {
  switch (prepared.scenario) {
    case "PLAN_EVENT_2H_BEFORE": {
      const context = prepared.context as PlanEventReminderContext;
      return {
        scenario: prepared.scenario,
        context: {
          planItemId: context.planItemId,
          activityId: context.activityId ?? null,
          eventTitle: context.eventTitle,
          startsAt: context.startsAt.toISOString(),
          placeName: context.placeName ?? null,
          cityName: context.cityName ?? null,
        },
        content: prepared.content,
      };
    }
    case "PLAN_TOMORROW_DIGEST": {
      const context = prepared.context as PlanTomorrowDigestContext;
      return {
        scenario: prepared.scenario,
        context: {
          digestDate: context.digestDate,
          citySlug: context.citySlug ?? null,
          planItemIds: context.planItemIds,
          items: context.items.map((item) => ({
            planItemId: item.planItemId,
            activityId: item.activityId ?? null,
            eventTitle: item.eventTitle,
            startsAt: item.startsAt?.toISOString() ?? null,
            placeName: item.placeName ?? null,
            cityName: item.cityName ?? null,
          })),
        },
        content: prepared.content,
      };
    }
    default: {
      const exhaustiveCheck: never = prepared.scenario;
      return exhaustiveCheck;
    }
  }
}

function resolveNotificationEntity(
  prepared: PreparedNotificationPayload,
): { entityType: "PLAN_ITEM" | "PLAN_DIGEST"; entityId: string | null } {
  switch (prepared.scenario) {
    case "PLAN_EVENT_2H_BEFORE": {
      const context = prepared.context as PlanEventReminderContext;
      return {
        entityType: "PLAN_ITEM",
        entityId: context.planItemId,
      };
    }
    case "PLAN_TOMORROW_DIGEST": {
      const context = prepared.context as PlanTomorrowDigestContext;
      return {
        entityType: "PLAN_DIGEST",
        entityId: context.digestDate,
      };
    }
    default: {
      const exhaustiveCheck: never = prepared.scenario;
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
  const payloadJson = buildInAppPayloadJson(prepared);
  const entity = resolveNotificationEntity(prepared);

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
      entityType: entity.entityType,
      entityId: entity.entityId,
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
  const payloadJson =
    prepared.scenario === "PLAN_EVENT_2H_BEFORE"
      ? {
          scenario: prepared.scenario,
          context: {
            planItemId: (prepared.context as PlanEventReminderContext).planItemId,
            activityId: (prepared.context as PlanEventReminderContext).activityId ?? null,
          },
        }
      : {
          scenario: prepared.scenario,
          context: {
            digestDate: (prepared.context as PlanTomorrowDigestContext).digestDate,
            planItemIds: (prepared.context as PlanTomorrowDigestContext).planItemIds,
          },
        };

  return recordSkippedNotificationDelivery({
    userId: prepared.userId,
    prepared,
    channel: "IN_APP",
    reason: "USER_DISABLED_CHANNEL",
    payloadJson,
  });
}
