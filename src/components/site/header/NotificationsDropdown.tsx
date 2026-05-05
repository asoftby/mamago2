"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationsModal } from "@/components/business/notifications/NotificationsModal";
import { NotificationsMenuContent } from "@/components/site/header/NotificationsMenuContent";
import { useUserNotificationBadgeCount } from "@/features/notifications/hooks/useUserNotificationBadgeCount";
import type { HeaderChromeContext } from "@/lib/header/chromeContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  AUTH_STATE_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/auth/client";

export type NotificationsDropdownProps = {
  /** Публичный сайт / админка → лента user; кабинет партнёра (режим business) → stream business в настройках */
  context: HeaderChromeContext;
  triggerClassName?: string;
};

/**
 * Колокол: desktop — Popover с {@link NotificationsPanel}, mobile — тот же контент в sheet ({@link NotificationsModal}).
 * Один UI для user, admin и business (различается только stream настроек: user vs business).
 */
export function NotificationsDropdown({
  context,
  triggerClassName,
}: NotificationsDropdownProps) {
  const stream = context === "business" ? "business" : "user";
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isUserStream = stream === "user";
  const {
    displayUnreadCount: userDisplayUnreadCount,
    refreshUnreadCount: refreshUserUnreadCount,
  } = useUserNotificationBadgeCount();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "1" });
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, []);

  useEffect(() => {
    if (isUserStream) return;
    const id = window.setTimeout(() => {
      void fetchUnreadCount();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchUnreadCount, isUserStream]);

  useEffect(() => {
    if (isUserStream) return;
    const sync = () => void fetchUnreadCount();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, sync);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, sync);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, sync);
    };
  }, [fetchUnreadCount, isUserStream]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(
      () => void (isUserStream ? refreshUserUnreadCount() : fetchUnreadCount()),
      0,
    );
    return () => window.clearTimeout(id);
  }, [open, fetchUnreadCount, isUserStream, refreshUserUnreadCount]);

  const displayUnreadCount = isUserStream ? userDisplayUnreadCount : unreadCount;

  const badge =
    displayUnreadCount > 0 ? (
      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
        {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
      </span>
    ) : null;

  const triggerProps = {
    type: "button" as const,
    variant: "ghost" as const,
    size: "sm" as const,
    className: cn("relative", triggerClassName),
    "aria-label": "Уведомления",
    "aria-expanded": open,
    "aria-haspopup": "dialog" as const,
    children: (
      <>
        <Bell className="h-4 w-4" />
        {badge}
      </>
    ),
  };

  const panelProps = {
    open,
    stream: stream as "user" | "business",
    showHeaderClose: true as const,
    onNotificationRead: isUserStream ? refreshUserUnreadCount : fetchUnreadCount,
    onClose: () => setOpen(false),
  };

  if (isDesktop) {
    return (
      <div data-notifications-dropdown>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button {...triggerProps} />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[min(100vw-1.5rem,480px)] max-w-[480px] overflow-hidden rounded-[24px] border border-neutral-200/90 p-0 shadow-[0_20px_60px_rgba(15,23,42,0.14)]"
          >
            <NotificationsMenuContent {...panelProps} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div data-notifications-dropdown>
      <Button {...triggerProps} onClick={() => setOpen(true)} />
      <NotificationsModal
        open={open}
        onOpenChange={setOpen}
        stream={stream}
        onNotificationRead={panelProps.onNotificationRead}
      />
    </div>
  );
}
