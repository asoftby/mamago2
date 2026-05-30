import type { NotificationApiRow } from "@/lib/notifications/types";

export type NotificationItem = NotificationApiRow;

export type NotificationInflight = {
  fetchList?: boolean;
  fetchUnread?: boolean;
  markOpen?: boolean;
};

export type NotificationState = {
  authenticated: boolean;
  unreadCount: number;
  businessUnreadCount: number;
  activeStream: "user" | "business";
  items: NotificationItem[];
  isLoading: boolean;
  loadingMore: boolean;
  isHydrated: boolean;
  hasMore: boolean;
  offset: number;
  lastFetchedAt?: number;
  lastSeenAt?: string | null;
  error?: string | null;
  showTelegramPrompt: boolean;
  panelOpen: boolean;
  lastMarkOpenAt: number | null;
  inflight: NotificationInflight;
  /** Bump when server sync completes so hooks can re-read derived local state (e.g. email prompt). */
  revision: number;
};
