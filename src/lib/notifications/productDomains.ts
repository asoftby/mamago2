import { getNotificationRegistryEntry } from "./notificationRegistry";
import type { NotificationApiRow } from "./types";

export type NotificationProductDomain =
  | "ACCOUNT"
  | "BOOKINGS"
  | "PLAN"
  | "BUSINESS"
  | "SYSTEM";

export type NotificationProductDomainBadge = {
  label: string;
  color: string;
};

const PRODUCT_DOMAIN_BADGES: Record<NotificationProductDomain, NotificationProductDomainBadge> = {
  ACCOUNT: {
    label: "Аккаунт",
    color: "bg-teal-100 text-teal-700 font-semibold",
  },
  BOOKINGS: {
    label: "Мои записи",
    color: "bg-[#EF8759]/14 text-[#C65D2E] font-semibold",
  },
  PLAN: {
    label: "План",
    color: "bg-indigo-100 text-indigo-700 font-semibold",
  },
  BUSINESS: {
    label: "Бизнес",
    color: "bg-blue-100 text-blue-700 font-semibold",
  },
  SYSTEM: {
    label: "Система",
    color: "bg-neutral-200 text-neutral-700 font-semibold",
  },
};

function looksLikeAccountNotification(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    "почт",
    "email",
    "телефон",
    "otp",
    "парол",
    "telegram",
    "аккаунт",
    "безопас",
    "верификац",
    "подтвержд",
    "вход",
  ].some((token) => normalized.includes(token));
}

function resolveExplicitProductDomain(
  notification: Pick<NotificationApiRow, "type" | "audience" | "title" | "body">,
): NotificationProductDomain | null {
  switch (notification.type) {
    case "SYSTEM":
      return looksLikeAccountNotification(`${notification.title} ${notification.body}`)
        ? "ACCOUNT"
        : "SYSTEM";
    case "WELCOME":
    case "ANNOUNCEMENT":
    case "NEWS":
    case "RECOMMENDATION":
      return "SYSTEM";
    case "REMINDER":
    case "PLAN_TOMORROW_DIGEST":
      return "PLAN";
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_COMPLETED":
    case "BOOKING_FEEDBACK_REQUEST":
      return "BOOKINGS";
    case "BOOKING_CREATED":
    case "BOOKING_STALE":
    case "BOOKING_NEEDS_ATTENTION":
      return notification.audience === "USER" ? "BOOKINGS" : "BUSINESS";
    case "PLACE_APPROVED":
    case "PLACE_NEEDS_CHANGES":
    case "PLACE_REJECTED":
    case "PLACE_UPDATE_APPROVED":
    case "PLACE_UPDATE_NEEDS_REVISION":
    case "PLACE_UPDATE_REJECTED":
    case "ACTIVITY_APPROVED":
    case "ACTIVITY_NEEDS_CHANGES":
    case "ACTIVITY_REJECTED":
    case "OFFER_APPROVED":
    case "OFFER_NEEDS_CHANGES":
    case "OFFER_REJECTED":
    case "BUSINESS_VERIFIED":
    case "BUSINESS_REJECTED":
    case "BUSINESS_NEEDS_INFO":
    case "BUSINESS_APPLICATION_CREATED":
    case "ADMIN_MODERATION_ITEM_CREATED":
      return "BUSINESS";
    default:
      return null;
  }
}

export function resolveNotificationProductDomain(
  notification: Pick<NotificationApiRow, "type" | "audience" | "title" | "body">,
): NotificationProductDomain {
  const explicitDomain = resolveExplicitProductDomain(notification);
  if (explicitDomain) {
    return explicitDomain;
  }

  const entry = getNotificationRegistryEntry(notification.type);
  if (!entry) {
    return "SYSTEM";
  }

  switch (entry.category) {
    case "PLAN":
      return "PLAN";
    case "BOOKING":
      return notification.audience === "USER" ? "BOOKINGS" : "BUSINESS";
    case "BUSINESS":
    case "MODERATION":
    case "ADMIN":
      return "BUSINESS";
    case "SYSTEM":
      return looksLikeAccountNotification(`${notification.title} ${notification.body}`)
        ? "ACCOUNT"
        : "SYSTEM";
    case "MARKETING":
    default:
      return "SYSTEM";
  }
}

export function getNotificationProductDomainBadge(
  notification: Pick<NotificationApiRow, "type" | "audience" | "title" | "body">,
): NotificationProductDomainBadge {
  return PRODUCT_DOMAIN_BADGES[resolveNotificationProductDomain(notification)];
}
