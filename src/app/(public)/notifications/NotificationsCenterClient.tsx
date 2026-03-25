"use client";

import { useEffect, useState } from "react";
import { NotificationList } from "@/components/business/notifications/NotificationList";

export function NotificationsCenterClient() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/notifications/mark-all-read", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-12 text-center text-sm text-muted-foreground shadow-sm">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <NotificationList
        showViewAll={false}
        viewAllHref="/notifications"
        grouped
        showHeader={false}
        listClassName="max-h-[min(70vh,560px)]"
      />
    </div>
  );
}
