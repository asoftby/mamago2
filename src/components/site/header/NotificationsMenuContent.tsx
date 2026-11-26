"use client";

import { NotificationsPanel } from "@/components/business/notifications/NotificationsPanel";

export type NotificationsMenuContentProps = {
  open: boolean;
  stream?: "user" | "business";
  pageHref?: string;
  showHeaderClose?: boolean;
  onNotificationRead?: () => void | Promise<void>;
  onClose: () => void;
};

export function NotificationsMenuContent({
  open,
  stream = "user",
  pageHref,
  showHeaderClose = true,
  onNotificationRead,
  onClose,
}: NotificationsMenuContentProps) {
  return (
    <NotificationsPanel
      open={open}
      stream={stream}
      pageHref={pageHref}
      showHeaderClose={showHeaderClose}
      onNotificationRead={onNotificationRead}
      onClose={onClose}
    />
  );
}
