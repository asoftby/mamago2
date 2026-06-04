import type {
  Notification,
  NotificationActionMode,
  NotificationEntityType,
  NotificationType,
} from "@prisma/client";

type ResolvedNotificationAction = {
  actionMode: NotificationActionMode;
  actionUrl: string | null;
  modalTitle: string | null;
  modalBody: string | null;
};

function resolveDefaultActionMode(
  type: NotificationType,
  actionUrl?: string | null,
): NotificationActionMode {
  if (actionUrl && /^https?:\/\//i.test(actionUrl)) {
    return "EXTERNAL_URL";
  }

  switch (type) {
    case "SYSTEM_INFO":
    case "FEATURE_UPDATE":
    case "BUSINESS_NEWS":
    case "SECURITY_ALERT":
    case "PAYMENT_INFO":
    case "SYSTEM":
    case "WELCOME":
    case "NEWS":
    case "ANNOUNCEMENT":
      return actionUrl ? "PAGE" : "MODAL";
    case "MODERATION_RESULT":
    case "BUSINESS_ACTION_REQUIRED":
    case "BOOKING_REQUEST":
    case "LEAD_CREATED":
    case "PLAN_REMINDER":
    case "UPCOMING_EVENT":
    case "COMMENT_REPLY":
    case "CONTENT_PUBLISHED":
    case "CONTENT_REJECTED":
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
    case "BOOKING_CREATED":
    case "BOOKING_STALE":
    case "BOOKING_NEEDS_ATTENTION":
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_COMPLETED":
    case "BOOKING_FEEDBACK_REQUEST":
    case "REMINDER":
    case "PLAN_TOMORROW_DIGEST":
    case "RECOMMENDATION":
    case "BUSINESS_APPLICATION_CREATED":
    case "ADMIN_MODERATION_ITEM_CREATED":
      return actionUrl ? "PAGE" : "NONE";
    default:
      return actionUrl ? "PAGE" : "NONE";
  }
}

export function resolveNotificationActionDefaults(input: {
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | null;
  actionMode?: NotificationActionMode | null;
  modalTitle?: string | null;
  modalBody?: string | null;
}): ResolvedNotificationAction {
  const actionUrl = input.actionUrl?.trim() ? input.actionUrl : null;
  const actionMode =
    input.actionMode ?? resolveDefaultActionMode(input.type, actionUrl);

  return {
    actionMode,
    actionUrl,
    modalTitle: input.modalTitle ?? input.title,
    modalBody: input.modalBody ?? input.body,
  };
}

export function resolveNotificationPageUrl(params: {
  type: NotificationType;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  actionUrl?: string | null;
}): string | null {
  if (params.actionUrl?.trim()) {
    return params.actionUrl;
  }

  switch (params.type) {
    case "PLACE_APPROVED":
    case "PLACE_NEEDS_CHANGES":
    case "PLACE_REJECTED":
    case "PLACE_UPDATE_APPROVED":
    case "PLACE_UPDATE_NEEDS_REVISION":
    case "PLACE_UPDATE_REJECTED":
    case "CONTENT_PUBLISHED":
    case "CONTENT_REJECTED":
    case "MODERATION_RESULT":
      if (params.entityType === "PLACE" && params.entityId) {
        return `/business/places/${params.entityId}/edit`;
      }
      if (params.entityType === "OFFER" && params.entityId) {
        return `/business/offers/${params.entityId}/edit`;
      }
      if ((params.entityType === "ACTIVITY" || params.entityType === "EVENT") && params.entityId) {
        return `/business/events/${params.entityId}/edit`;
      }
      if (params.entityType === "ARTICLE" && params.entityId) {
        return `/admin/articles/${params.entityId}`;
      }
      return null;
    case "BUSINESS_VERIFIED":
    case "BUSINESS_REJECTED":
    case "BUSINESS_NEEDS_INFO":
    case "BUSINESS_ACTION_REQUIRED":
      return "/business/verification";
    case "BOOKING_CREATED":
    case "BOOKING_STALE":
    case "BOOKING_NEEDS_ATTENTION":
    case "BOOKING_REQUEST":
      return params.entityId
        ? `/business/bookings?id=${params.entityId}`
        : "/business/bookings";
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_COMPLETED":
    case "BOOKING_FEEDBACK_REQUEST":
      return "/me/bookings";
    case "PLAN_REMINDER":
    case "UPCOMING_EVENT":
    case "REMINDER":
    case "PLAN_TOMORROW_DIGEST":
      if (params.entityType === "PLAN_DAY" && params.entityId) {
        return `/me/day/${params.entityId}`;
      }
      return "/me/plan";
    case "ADMIN_MODERATION_ITEM_CREATED":
      return "/admin/moderation/queue";
    case "BUSINESS_APPLICATION_CREATED":
      return params.entityId
        ? `/admin/b2b/requests?status=PENDING&open=${params.entityId}`
        : "/admin/b2b/requests?status=PENDING";
    default:
      return null;
  }
}

export function resolveNotificationAction(notification: Pick<
  Notification,
  "type" | "title" | "body" | "actionMode" | "actionUrl" | "modalTitle" | "modalBody" | "entityType" | "entityId"
>): ResolvedNotificationAction {
  const actionUrl =
    notification.actionUrl ??
    resolveNotificationPageUrl({
      type: notification.type,
      entityType: notification.entityType,
      entityId: notification.entityId,
      actionUrl: notification.actionUrl,
    });

  return resolveNotificationActionDefaults({
    type: notification.type,
    title: notification.title,
    body: notification.body,
    actionMode: notification.actionMode,
    actionUrl,
    modalTitle: notification.modalTitle,
    modalBody: notification.modalBody,
  });
}
