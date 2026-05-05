"use client";

import { NotificationsPanel } from "@/components/business/notifications/NotificationsPanel";

export type NotificationsMenuContentProps = {
  open: boolean;
  stream?: "user" | "business";
  showHeaderClose?: boolean;
  onNotificationRead?: () => void | Promise<void>;
  onClose: () => void;
};

export function NotificationsMenuContent({
  open,
  stream = "user",
  showHeaderClose = true,
  onNotificationRead,
  onClose,
}: NotificationsMenuContentProps) {
  return (
    <NotificationsPanel
      open={open}
      stream={stream}
      showHeaderClose={showHeaderClose}
      onNotificationRead={onNotificationRead}
      onClose={onClose}
    />
  );
}
