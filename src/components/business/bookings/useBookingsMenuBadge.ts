"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/features/notifications/store";
import { BOOKINGS_BADGE_REFRESH_EVENT } from "./bookingsBadgeEvents";

const POLL_MS = 60_000;

/**
 * Число заявок, где клиент ждёт ответа (`menuBadge` единого инбокса).
 * «Закройте прошедшие» в бейдж намеренно не входят — это решает сервер.
 * Не используем число непрочитанных уведомлений: это разные показатели.
 */
export function useBookingsMenuBadge(): number {
  const pathname = usePathname();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let requestSequence = 0;

    const load = async () => {
      const sequence = ++requestSequence;
      try {
        const res = await fetch("/api/business/bookings/inbox?tab=action&limit=1", {
          cache: "no-store",
        });
        if (cancelled || sequence !== requestSequence) return;
        if (res.status === 401 || res.status === 403) {
          setBadge(0);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as { menuBadge?: unknown };
        if (
          !cancelled &&
          sequence === requestSequence &&
          typeof data.menuBadge === "number" &&
          Number.isFinite(data.menuBadge)
        ) {
          setBadge(Math.max(0, Math.trunc(data.menuBadge)));
        }
      } catch {
        // Бейдж — вспомогательный: при ошибке сети оставляем прошлое значение.
      }
    };

    void load();

    // Колокольчик обновляется независимо. Когда меняется его business-stream,
    // перечитываем истинное количество необработанных заявок из inbox, а не
    // копируем туда число непрочитанных уведомлений.
    const unsubscribe = useNotificationStore.subscribe((next, previous) => {
      if (
        next.authenticated &&
        next.businessUnreadCount !== previous.businessUnreadCount
      ) {
        void load();
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    window.addEventListener(BOOKINGS_BADGE_REFRESH_EVENT, load);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      requestSequence++;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener(BOOKINGS_BADGE_REFRESH_EVENT, load);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return badge;
}
