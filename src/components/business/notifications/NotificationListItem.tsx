"use client";

import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { displayWelcomeNotificationTitle } from "@/lib/notifications/welcomeNotification";
import { getNotificationProductDomainBadge } from "@/lib/notifications/productDomains";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { NotificationMessageBody } from "./NotificationMessageBody";
import {
  getNotificationIcon,
  getNotificationTypeLabel,
} from "./notificationPresentation";

type NotificationListItemProps = {
  notification: NotificationApiRow;
  onClick: (notification: NotificationApiRow) => void | Promise<void>;
  trailingAction?: ReactNode;
  compact?: boolean;
};

function isUnreadRow(notification: NotificationApiRow): boolean {
  return notification.readAt == null;
}

export function NotificationListItem({
  notification,
  onClick,
  trailingAction,
  compact = false,
}: NotificationListItemProps) {
  const isUnread = isUnreadRow(notification);
  const icon = getNotificationIcon(notification.type);
  const typeLabel = getNotificationTypeLabel(notification.type);
  const contextBadge = getNotificationProductDomainBadge(notification);

  return (
    <div
      className={cn(
        "transition-colors hover:bg-gray-50/90",
        compact ? "px-4 py-3" : "p-4",
        isUnread
          ? "border-l-[3px] border-[#EF8759] bg-[#FFF8F4]"
          : "border-l border-transparent bg-white",
        notification.isPinned && isUnread && "bg-amber-50/50",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => void onClick(notification)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex gap-3">
            <div className={cn("shrink-0", compact ? "text-xl" : "text-2xl")}>{icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                      {typeLabel}
                    </span>
                    {contextBadge ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", contextBadge.color)}>
                        {contextBadge.label}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-sm text-gray-900",
                      isUnread ? "font-semibold" : "font-medium text-gray-700",
                    )}
                  >
                    {notification.type === "WELCOME"
                      ? displayWelcomeNotificationTitle(notification.title)
                      : notification.title}
                  </p>
                </div>
                {isUnread ? (
                  <span className="mt-0.5 shrink-0 rounded-full bg-[#EF8759]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C65D2E]">
                    Новое
                  </span>
                ) : null}
              </div>
              <div className={cn(compact && "line-clamp-2")}>
                <NotificationMessageBody body={notification.body} type={notification.type} />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                  locale: ru,
                })}
              </p>
            </div>
          </div>
        </button>
        {trailingAction}
      </div>
    </div>
  );
}
