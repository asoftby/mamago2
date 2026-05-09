"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/auth/client";
import { useAuthMe } from "@/lib/auth/useAuthMe";

const POLL_MS = 60_000;

type UnreadCtx = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const UnreadNotificationCountContext = createContext<UnreadCtx | null>(null);

/**
 * Один polling / один набор слушателей на всё приложение: иначе Header + MobileNav
 * дублировали интервалы и параллельные GET /api/notifications?limit=1.
 */
export function UnreadNotificationCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { status } = useAuthMe();
  const isAuthenticated = status === "authenticated";
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
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
    } finally {
      inFlightRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      queueMicrotask(() => {
        setUnreadCount(0);
      });
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
    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, refresh]);

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

  return (
    <UnreadNotificationCountContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </UnreadNotificationCountContext.Provider>
  );
}

export function useUnreadNotificationCountFromContext(): UnreadCtx {
  const ctx = useContext(UnreadNotificationCountContext);
  if (!ctx) {
    throw new Error(
      "useUnreadNotificationCount must be used within UnreadNotificationCountProvider",
    );
  }
  return ctx;
}
