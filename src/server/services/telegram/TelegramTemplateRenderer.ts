import "server-only";

import type {
  DevTelegramBusinessApplication,
  Notification,
  NotificationAudience,
  NotificationType,
} from "@prisma/client";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { getNotificationRegistryEntry } from "@/lib/notifications/notificationRegistry";
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

function renderRegistryNotification(notification: Notification): RenderedTelegramMessage | null {
  const registryEntry = getNotificationRegistryEntry(notification.type);
  if (!registryEntry?.telegram) return null;

  const icon =
    notification.type.startsWith("BOOKING_")
      ? "📌"
      : notification.type.startsWith("PLACE_")
        ? "📍"
        : notification.type.startsWith("ACTIVITY_")
          ? "🎟️"
          : notification.type.startsWith("OFFER_")
            ? "🎁"
            : notification.type.startsWith("BUSINESS_")
              ? "🏢"
              : notification.type.startsWith("ADMIN_")
                ? "🛠"
                : notification.type === "REMINDER" || notification.type === "PLAN_TOMORROW_DIGEST"
                  ? "⏰"
                  : "🔔";

  const title = registryEntry.telegram.title || notification.title;
  const bodyTemplate = registryEntry.telegram.body || notification.body;
  const body = bodyTemplate.replace(/\{\{body\}\}/g, notification.body);
  const replyMarkup = buildReplyMarkup(notification, registryEntry);

  return {
    text: `${icon} ${title}\n\n${body}`,
    replyMarkup,
  };
}

export function renderNotificationTelegramMessage(
  notification: Notification,
): RenderedTelegramMessage {
  const registryRendered = renderRegistryNotification(notification);
  if (registryRendered) {
    return registryRendered;
  }
  
  // Специальная обработка для BUSINESS_APPLICATION_CREATED (legacy)
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

  // Fallback на generic template
  return renderGenericNotification(notification);
}

/**
 * Построить inline keyboard для уведомления на основе registry
 */
function buildReplyMarkup(
  notification: Notification,
  registryEntry: ReturnType<typeof getNotificationRegistryEntry>,
): TelegramReplyMarkup | undefined {
  if (!registryEntry?.ctaLabel) return undefined;
  
  // Получаем href из registry
  let href: string | null = null;
  if (registryEntry.resolveHref) {
    try {
      href = registryEntry.resolveHref({
        entityType: notification.entityType ?? undefined,
        entityId: notification.entityId ?? undefined,
        ctaAction: notification.ctaAction ?? undefined,
      });
    } catch (error) {
      console.warn("[telegram] Failed to resolve href for", notification.type, error);
    }
  }
  
  // Если нет href, не показываем кнопку
  if (!href) return undefined;
  
  // Строим абсолютный URL
  const absoluteUrl = href.startsWith('http') 
    ? href 
    : `${getPublicAppBaseUrl()}${href}`;
  
  return {
    inline_keyboard: [
      [
        {
          text: registryEntry.ctaLabel,
          url: absoluteUrl,
        },
      ],
    ],
  };
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
