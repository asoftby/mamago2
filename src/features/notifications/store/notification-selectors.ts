import type { NotificationState } from "./notification-types";

export function selectUnreadCount(state: NotificationState): number {
  return state.unreadCount;
}

export function selectBusinessUnreadCount(state: NotificationState): number {
  return state.businessUnreadCount;
}

export function selectNotificationItems(state: NotificationState) {
  return state.items;
}

export function selectNotificationsLoading(state: NotificationState): boolean {
  return state.isLoading;
}

export function selectNotificationsLoadingMore(state: NotificationState): boolean {
  return state.loadingMore;
}

export function selectNotificationsHydrated(state: NotificationState): boolean {
  return state.isHydrated;
}

export function selectNotificationsError(state: NotificationState): string | null | undefined {
  return state.error;
}

export function selectShowTelegramPrompt(state: NotificationState): boolean {
  return state.showTelegramPrompt;
}

export function selectNotificationsHasMore(state: NotificationState): boolean {
  return state.hasMore;
}

export function selectNotificationRevision(state: NotificationState): number {
  return state.revision;
}
