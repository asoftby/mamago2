"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { NotificationEntityType, NotificationType } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { displayWelcomeNotificationTitle } from "@/lib/notifications/welcomeNotification";
import { getNotificationProductDomainBadge } from "@/lib/notifications/productDomains";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { resolveNotificationPageUrl } from "@/server/notifications/notification-action-resolver";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationMessageBody } from "./NotificationMessageBody";
import {
  getNotificationIcon,
  getNotificationTypeLabel,
} from "./notificationPresentation";

type NotificationListItemProps = {
  notification: NotificationApiRow;
  onClick: (notification: NotificationApiRow) => void | Promise<void>;
  onCtaClick?: (notification: NotificationApiRow) => void | Promise<void>;
  ctaLabel?: string | null;
  ctaLoading?: boolean;
  ctaDisabled?: boolean;
  trailingAction?: ReactNode;
  compact?: boolean;
};

function isUnreadRow(notification: NotificationApiRow): boolean {
  return notification.readAt == null;
}

export function NotificationListItem({
  notification,
  onClick,
  onCtaClick,
  ctaLabel,
  ctaLoading = false,
  ctaDisabled = false,
  trailingAction,
  compact = false,
}: NotificationListItemProps) {
  const isUnread = isUnreadRow(notification);
  const icon = getNotificationIcon(notification.type);
  const typeLabel = getNotificationTypeLabel(notification.type);
  const contextBadge = getNotificationProductDomainBadge(notification);

  const resolvedCtaLabel = ctaLabel ?? notification.ctaLabel;
  const showCta = Boolean(resolvedCtaLabel && onCtaClick && notification.actionUrl != null);

  const destination = resolveNotificationPageUrl({
    type: notification.type as NotificationType,
    entityType: notification.entityType as NotificationEntityType | null,
    actionUrl: notification.actionUrl,
    entityId: notification.entityId,
  });
  const isNavigable =
    !!destination ||
    notification.actionMode === "PAGE" ||
    notification.actionMode === "EXTERNAL_URL";

  const content = (
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
  );

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
        {isNavigable ? (
          // Navigate through the /n/[id] resolver: it marks the notification as
          // read and redirects to the destination server-side, so we do NOT
          // attach onClick here (no duplicate resolve-action call).
          <Link
            href={`/n/${notification.id}`}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            {content}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void onClick(notification)}
            className="min-w-0 flex-1 text-left"
          >
            {content}
          </button>
        )}
        {isNavigable ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : null}
        {trailingAction}
      </div>
      {showCta ? (
        <div className={cn("mt-2", compact ? "pl-8" : "pl-9")}>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={ctaDisabled || ctaLoading}
            onClick={() => void onCtaClick?.(notification)}
          >
            {resolvedCtaLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
