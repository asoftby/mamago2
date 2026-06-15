"use client";

import { useCallback, useMemo } from "react";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import {
  useNotificationStore,
} from "@/features/notifications/store";

/**
 * Единый источник бейджа для всех уведомлений (USER + BUSINESS + ADMIN):
 * unreadCount из notification store (без фильтра по stream).
 * Верификация email и подключение Telegram учитываются через DB-нотификации
 * (VERIFY_EMAIL, CONNECT_TELEGRAM), созданные при регистрации.
 */
export function useUserNotificationBadgeCount() {
  const { isAuthenticated } = useAuthMe();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const refreshUnreadCount = useCallback(async () => {
    await useNotificationStore.getState().refreshUnreadOnly();
  }, []);

  const displayUnreadCount = useMemo(
    () => (isAuthenticated ? Math.max(0, unreadCount) : 0),
    [isAuthenticated, unreadCount],
  );

  return { displayUnreadCount, refreshUnreadCount };
}
