import type { NotificationItem } from "./notification-types";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function fetchUnreadCountFromApi(
  stream?: "business",
): Promise<number> {
  const qs =
    stream === "business" ? `?${new URLSearchParams({ stream: "business" }).toString()}` : "";
  const res = await fetch(`/api/notifications/unread-count${qs}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { unreadCount?: number };
  return typeof data.unreadCount === "number" ? data.unreadCount : 0;
}

export type NotificationsPageResult = {
  notifications: NotificationItem[];
  hasMore: boolean;
  showTelegramPrompt?: boolean;
};

export async function fetchNotificationsPageApi(
  offset: number,
  limit: number,
  stream: "user" | "business",
): Promise<NotificationsPageResult> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    stream,
  });
  const res = await fetch(`/api/notifications?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) {
    return { notifications: [], hasMore: false };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text ? `GET /api/notifications failed (${res.status})` : `HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as {
    notifications?: NotificationItem[];
    hasMore?: boolean;
    showTelegramPrompt?: boolean;
  };
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  return {
    notifications,
    hasMore: Boolean(data.hasMore),
    showTelegramPrompt:
      typeof data.showTelegramPrompt === "boolean"
        ? data.showTelegramPrompt
        : undefined,
  };
}

export async function postMarkNotificationsOpenApi(
  stream: "user" | "business",
): Promise<{
  showTelegramPrompt?: boolean;
}> {
  const params = new URLSearchParams({ stream });
  const res = await fetch(`/api/notifications/mark-open?${params.toString()}`, {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { showTelegramPrompt?: boolean };
  return data ?? {};
}
