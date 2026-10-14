"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BOOKINGS_BADGE_REFRESH_EVENT } from "./bookingsBadgeEvents";

const POLL_MS = 60_000;

/**
 * Число заявок, где клиент ждёт ответа (`menuBadge` единого инбокса).
 * «Закройте прошедшие» в бейдж намеренно не входят — это решает сервер.
 */
export function useBookingsMenuBadge(): number {
  const pathname = usePathname();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/business/bookings/inbox?tab=action&limit=1", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { menuBadge?: unknown };
        if (!cancelled && typeof data.menuBadge === "number") setBadge(data.menuBadge);
      } catch {
        // бейдж — вспомогательный: при ошибке сети оставляем прошлое значение
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    window.addEventListener(BOOKINGS_BADGE_REFRESH_EVENT, load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(BOOKINGS_BADGE_REFRESH_EVENT, load);
    };
  }, [pathname]);

  return badge;
}
