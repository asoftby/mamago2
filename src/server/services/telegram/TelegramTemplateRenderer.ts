import "server-only";

import type {
  DevTelegramBusinessApplication,
  Notification,
  NotificationAudience,
  NotificationType,
} from "@prisma/client";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { TelegramReplyMarkup } from "./TelegramChannel";

type RenderedTelegramMessage = {
  text: string;
  replyMarkup?: TelegramReplyMarkup;
};

function audiencePrefix(audience: NotificationAudience | null | undefined): string {
  switch (audience) {
    case "BUSINESS":
      return "🏢 Бизнес";
    case "ADMIN":
      return "🛠 Админ";
    case "USER":
    default:
      return "👤 Для вас";
  }
}

function getPublicAppBaseUrl(): string {
  return getCanonicalPublicAppUrl();
}

function renderGenericNotification(notification: Notification): RenderedTelegramMessage {
  const prefix = audiencePrefix(notification.audience);
  return {
    text: `${prefix} — ${notification.title}\n\n${notification.body}`,
  };
}

export function renderNotificationTelegramMessage(
  notification: Notification,
): RenderedTelegramMessage {
  if (
    notification.type === "BUSINESS_APPLICATION_CREATED" &&
    notification.entityId
  ) {
    return {
      text: `${audiencePrefix(notification.audience)} — новая заявка\n\n${notification.body}`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "Подтвердить", callback_data: `application:${notification.entityId}:confirm` },
            { text: "Отклонить", callback_data: `application:${notification.entityId}:reject` },
          ],
          [
            {
              text: "Открыть в кабинете",
              url: `${getPublicAppBaseUrl()}/business/bookings`,
            },
          ],
        ],
      },
    };
  }

  return renderGenericNotification(notification);
}

export function renderDevBusinessApplicationMessage(
  application: DevTelegramBusinessApplication,
): RenderedTelegramMessage {
  const statusLine =
    application.status === "CONFIRMED"
      ? "Статус: подтверждена"
      : application.status === "REJECTED"
        ? "Статус: отклонена"
        : "Статус: ожидает решения";

  const baseText =
    `🏢 Бизнес — новая заявка\n\n` +
    `Номер заявки: ${application.applicationNumber}\n` +
    `Услуга: ${application.serviceName}\n` +
    `Клиент: ${application.clientName}\n` +
    `Дата/время: ${application.scheduledFor.toLocaleString("ru-RU")}\n` +
    `${statusLine}`;

  if (application.status !== "PENDING") {
    return { text: baseText };
  }

  return {
    text: baseText,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "Подтвердить", callback_data: `application:${application.id}:confirm` },
          { text: "Отклонить", callback_data: `application:${application.id}:reject` },
        ],
        [
          {
            text: "Открыть в кабинете",
            url: `${getPublicAppBaseUrl()}/business/bookings`,
          },
        ],
      ],
    },
  };
}

export function buildDevDemoNotificationPayload(params: {
  audience: NotificationAudience;
  type: NotificationType;
  title: string;
  body: string;
}): string {
  return `${audiencePrefix(params.audience)} — ${params.title}\n\n${params.body}`;
}
