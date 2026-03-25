"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DEFAULT_POLL_MS = 60_000;

/**
 * unreadCount из GET /api/notifications; при 401 — 0.
 * Обновление: смена маршрута, интервал, смена видимости вкладки.
 */
export function useUnreadNotificationCount(pollMs: number = DEFAULT_POLL_MS) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1", {
        credentials: "include",
      });
      if (!res.ok) {
        setUnreadCount(0);
        return;
      }
      const data = (await res.json()) as { unreadCount?: number };
      setUnreadCount(
        typeof data.unreadCount === "number" ? data.unreadCount : 0,
      );
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), pollMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, pollMs]);

  return { unreadCount, refresh };
}
