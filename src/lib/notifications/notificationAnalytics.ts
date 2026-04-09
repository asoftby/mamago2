/**
 * Notification analytics events.
 * Thin wrapper — подключи к своей telemetry (posthog, amplitude, etc.) в теле функции.
 */

export type NotificationAnalyticsEvent =
  | "notification_welcome_viewed"
  | "notification_welcome_read"
  | "notification_welcome_clicked"
  | "notification_welcome_dismissed"
  | "notification_welcome_cta_clicked"
  | "telegram_pinned_banner_viewed"
  | "telegram_pinned_banner_dismissed"
  | "telegram_connect_clicked_from_welcome"
  | "telegram_connect_clicked_from_pinned"
  | "telegram_connected_success"
  | "email_verify_pinned_banner_viewed"
  | "email_verify_pinned_banner_dismissed";

export function trackNotificationEvent(
  event: NotificationAnalyticsEvent,
  props?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  // TODO: подключить к реальной telemetry (posthog, amplitude, etc.)
  // posthog.capture(event, props);
  if (process.env.NODE_ENV === "development") {
    console.debug("[notification:analytics]", event, props ?? "");
  }
}
