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
import { NotificationsPanel } from "@/components/business/notifications/NotificationsPanel";
import { NotificationsBellPopover } from "@/components/business/notifications/NotificationsBellPopover";
import { useUserNotificationBadgeCount } from "@/features/notifications/hooks/useUserNotificationBadgeCount";
import type { HeaderChromeContext } from "@/lib/header/chromeContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  AUTH_STATE_CHANGED_EVENT,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/lib/auth/client";

export type NotificationsDropdownProps = {
  /** Публичный сайт — личные уведомления; кабинет партнёра — бизнес */
  context: HeaderChromeContext;
  triggerClassName?: string;
};

/**
 * Колокол в шапке: desktop — dropdown (Popover), mobile — тот же контент в bottom sheet через NotificationsModal.
 */
export function NotificationsDropdown({
  context,
  triggerClassName,
}: NotificationsDropdownProps) {
  if (context === "business") {
    return <NotificationsBellPopover triggerClassName={triggerClassName} />;
  }

  return (
    <PersonalNotificationsDropdown
      context={context}
      triggerClassName={triggerClassName}
    />
  );
}

function PersonalNotificationsDropdown({
  context,
  triggerClassName,
}: NotificationsDropdownProps) {
  const stream = context === "business" ? "business" : "user";
  const isDesktop = useMediaQuery("(min-width: 1024px)");
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
      // Don't pass stream parameter — fetch ALL accessible notifications
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
            <NotificationsPanel
              open={open}
              stream={stream}
              showHeaderClose
              onNotificationRead={isUserStream ? refreshUserUnreadCount : fetchUnreadCount}
              onClose={() => setOpen(false)}
            />
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
        onNotificationRead={isUserStream ? refreshUserUnreadCount : fetchUnreadCount}
      />
    </div>
  );
}
