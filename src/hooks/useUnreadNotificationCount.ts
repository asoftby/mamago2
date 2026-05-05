"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/auth/client";
import { useAuthMe } from "@/lib/auth/useAuthMe";

const DEFAULT_POLL_MS = 60_000;

/**
 * unreadCount из GET /api/notifications; при 401 — 0.
 * Обновление: смена маршрута, интервал, смена видимости вкладки.
 */
export function useUnreadNotificationCount(pollMs: number = DEFAULT_POLL_MS) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const { status } = useAuthMe();
  const isAuthenticated = status === "authenticated";

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch("/api/notifications?limit=1", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setUnreadCount(0);
        return;
      }
      const data = (await res.json()) as { unreadCount?: number };
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : 0,
      );
    } catch (error) {
      console.error("Failed to fetch unread notification count:", error);
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [isAuthenticated, pathname, refresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const id = window.setInterval(() => void refresh(), pollMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, refresh, pollMs]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const sync = () => void refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    };
  }, [isAuthenticated, refresh]);

  return { unreadCount, refresh };
}
