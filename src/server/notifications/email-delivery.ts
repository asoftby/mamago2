import "server-only";

import { Prisma } from "@prisma/client";
import type {
  NotificationDeliveryOutcome,
  PreparedNotificationPayload,
} from "@/lib/notifications/domainContracts";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { emailService } from "@/features/email/server/email-service";
import {
  createNotificationDeliveryRecord,
  markNotificationDeliveryRecord,
  recordSkippedNotificationDelivery,
} from "./delivery-log";
import { renderNotification } from "./template-render.service";
import { buildScenarioTemplatePayloadCore } from "./template-payload-core";
import { toPlainText } from "./template-render-core";

function toAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${getCanonicalPublicAppUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function sendEmailNotification(params: {
  userId: string;
  notificationId: string | null;
  email: string | null | undefined;
  prepared: PreparedNotificationPayload;
}): Promise<NotificationDeliveryOutcome> {
  const payloadJson: Prisma.InputJsonValue = {
    scenario: params.prepared.scenario,
    subject: params.prepared.content.title,
    title: params.prepared.content.title,
    body: params.prepared.content.body,
    ctaLabel: params.prepared.content.ctaLabel,
    ctaUrl: toAbsoluteUrl(params.prepared.content.ctaUrl),
  };

  const delivery = await createNotificationDeliveryRecord({
    userId: params.userId,
    notificationId: params.notificationId,
    prepared: params.prepared,
    channel: "EMAIL",
    status: "PENDING",
    payloadJson,
  });

  if (!params.email) {
    const errorMessage = "EMAIL_MISSING";
    await markNotificationDeliveryRecord(delivery.id, {
      status: "FAILED",
      errorMessage,
    });
    return {
      channel: "EMAIL",
      status: "FAILED",
      deliveryId: delivery.id,
      errorMessage,
    };
  }

  try {
    // Шаблонный рендер (override из БД → дефолт реестра); null → текущий кодовый текст
    const rendered = await renderNotification(
      params.prepared.scenario,
      "EMAIL",
      buildScenarioTemplatePayloadCore(params.prepared.scenario, params.prepared.context),
    );

    const result = await emailService.sendNotificationEmail({
      to: params.email,
      subject: rendered?.subject ?? params.prepared.content.title,
      title: rendered?.subject ?? params.prepared.content.title,
      body: rendered ? toPlainText(rendered.body, 2000) : params.prepared.content.body,
      bodyHtml: rendered?.body ?? null,
      ctaLabel: params.prepared.content.ctaLabel,
      ctaUrl: toAbsoluteUrl(params.prepared.content.ctaUrl),
    });

    if (result.status === "SKIPPED") {
      await markNotificationDeliveryRecord(delivery.id, {
        status: "SKIPPED",
        errorMessage: result.reason ?? "EMAIL_NOT_CONFIGURED",
      });

      return {
        channel: "EMAIL",
        status: "SKIPPED",
        deliveryId: delivery.id,
        errorMessage: result.reason ?? "EMAIL_NOT_CONFIGURED",
      };
    }

    await markNotificationDeliveryRecord(delivery.id, {
      status: "SENT",
      sentAt: new Date(),
    });

    return {
      channel: "EMAIL",
      status: "SENT",
      deliveryId: delivery.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "EMAIL_SEND_FAILED";
    await markNotificationDeliveryRecord(delivery.id, {
      status: "FAILED",
      errorMessage,
    });

    return {
      channel: "EMAIL",
      status: "FAILED",
      deliveryId: delivery.id,
      errorMessage,
    };
  }
}

export async function skipEmailNotification(params: {
  userId: string;
  notificationId?: string | null;
  prepared: PreparedNotificationPayload;
  reason: "USER_DISABLED_CHANNEL";
}): Promise<NotificationDeliveryOutcome> {
  return recordSkippedNotificationDelivery({
    userId: params.userId,
    notificationId: params.notificationId,
    prepared: params.prepared,
    channel: "EMAIL",
    reason: params.reason,
    payloadJson: {
      scenario: params.prepared.scenario,
      subject: params.prepared.content.title,
    },
  });
}
