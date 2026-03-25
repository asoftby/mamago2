"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NotificationList } from "@/components/business/notifications/NotificationList";
import type { HeaderChromeContext } from "@/lib/header/chromeContext";
import { cn } from "@/lib/utils";

export type NotificationsDropdownProps = {
  /** Публичный сайт — личные уведомления; кабинет партнёра — бизнес */
  context: HeaderChromeContext;
  viewAllHref?: string;
  triggerClassName?: string;
  /**
   * Как у профиля: bottom sheet вместо popover (мобилка / узкий viewport).
   */
  narrow?: boolean;
};

/**
 * Единый колокол уведомлений: тот же UI, данные по `context` (stream на API).
 * Зарезервировано под будущие вкладки «Личное / Бизнес» внутри popover.
 */
export function NotificationsDropdown({
  context,
  viewAllHref,
  triggerClassName,
  narrow = false,
}: NotificationsDropdownProps) {
  const stream = context === "business" ? "business" : "user";
  const defaultViewAll =
    context === "business" ? "/business/notifications" : "/notifications";

  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const resolvedViewAll = viewAllHref ?? defaultViewAll;

  const fetchUnreadCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        unreadOnly: "true",
        stream,
      });
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [stream]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchUnreadCount();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      void fetchUnreadCount();
    }, 0);
    return () => window.clearTimeout(id);
  }, [isOpen, fetchUnreadCount]);

  const handleNotificationRead = () => {
    fetchUnreadCount();
  };

  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      className={cn("relative", triggerClassName)}
      aria-label="Уведомления"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );

  const list = (
    <NotificationList
      stream={stream}
      onNotificationRead={handleNotificationRead}
      onClose={() => setIsOpen(false)}
      viewAllHref={resolvedViewAll}
      grouped={false}
      showHeader={!narrow}
      listClassName={narrow ? "max-h-[min(60vh,420px)]" : undefined}
    />
  );

  if (narrow) {
    return (
      <div data-notifications-dropdown>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton
            className={cn(
              "z-[60] max-h-[min(90vh,calc(100dvh-1rem))] gap-0 overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lg",
            )}
          >
            <SheetHeader className="flex-row items-center justify-between space-y-0 p-0 pb-3 text-left">
              <SheetTitle className="text-base font-semibold text-gray-900">
                Уведомления
              </SheetTitle>
              <Link
                href={resolvedViewAll}
                className="shrink-0 text-xs text-blue-600 hover:text-blue-700"
                onClick={() => setIsOpen(false)}
              >
                Все уведомления
              </Link>
            </SheetHeader>
            {list}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div data-notifications-dropdown>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          {list}
        </PopoverContent>
      </Popover>
    </div>
  );
}
