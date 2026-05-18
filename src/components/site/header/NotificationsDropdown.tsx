"use client";

import { useCallback, useState } from "react";
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
import { useNotificationStore } from "@/features/notifications/store";
import type { HeaderChromeContext } from "@/lib/header/chromeContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

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

  const [open, setOpen] = useState(false);
  // Only subscribe to businessUnreadCount when actually in business context.
  // This prevents the user-facing header from re-rendering on business count changes.
  const businessUnreadCount = useNotificationStore((s) =>
    isUserStream ? 0 : s.businessUnreadCount,
  );

  const refreshUnread = useCallback(async () => {
    // Force-refresh so the explicit user action bypasses throttle.
    await useNotificationStore.getState().refreshBusinessUnreadOnly({ force: true });
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      useNotificationStore.getState().closePanel();
    }
  }, []);

  const panelProps = {
    open,
    stream: stream as "user" | "business",
    showHeaderClose: true as const,
    onNotificationRead: refreshUnread,
    onClose: () => handleOpenChange(false),
  };

  if (isUserStream) {
    return (
      <UserNotificationsDropdown
        isDesktop={isDesktop}
        open={open}
        handleOpenChange={handleOpenChange}
        panelProps={panelProps}
        triggerClassName={triggerClassName}
      />
    );
  }

  const badge =
    businessUnreadCount > 0 ? (
      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
        {businessUnreadCount > 9 ? "9+" : businessUnreadCount}
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
        <Popover open={open} onOpenChange={handleOpenChange}>
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
      <Button {...triggerProps} onClick={() => handleOpenChange(true)} />
      <NotificationsModal
        open={open}
        onOpenChange={handleOpenChange}
        stream={stream}
        onNotificationRead={panelProps.onNotificationRead}
      />
    </div>
  );
}

function UserNotificationsDropdown({
  isDesktop,
  open,
  handleOpenChange,
  panelProps,
  triggerClassName,
}: {
  isDesktop: boolean;
  open: boolean;
  handleOpenChange: (open: boolean) => void;
  panelProps: {
    open: boolean;
    stream: "user" | "business";
    showHeaderClose: true;
    onNotificationRead: () => Promise<void>;
    onClose: () => void;
  };
  triggerClassName?: string;
}) {
  const {
    displayUnreadCount,
    refreshUnreadCount,
  } = useUserNotificationBadgeCount();

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

  const resolvedPanelProps = {
    ...panelProps,
    onNotificationRead: refreshUnreadCount,
  };

  if (isDesktop) {
    return (
      <div data-notifications-dropdown>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button {...triggerProps} />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[min(100vw-1.5rem,480px)] max-w-[480px] overflow-hidden rounded-[24px] border border-neutral-200/90 p-0 shadow-[0_20px_60px_rgba(15,23,42,0.14)]"
          >
            <NotificationsMenuContent {...resolvedPanelProps} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div data-notifications-dropdown>
      <Button {...triggerProps} onClick={() => handleOpenChange(true)} />
      <NotificationsModal
        open={open}
        onOpenChange={handleOpenChange}
        stream="user"
        onNotificationRead={resolvedPanelProps.onNotificationRead}
      />
    </div>
  );
}
