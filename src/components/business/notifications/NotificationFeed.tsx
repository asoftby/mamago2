"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { displayWelcomeNotificationTitle } from "@/lib/notifications/welcomeNotification";
import { getNotificationProductDomainBadge } from "@/lib/notifications/productDomains";
import { getNotificationHref } from "@/lib/notifications/routing";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { NotificationMessageBody } from "./NotificationMessageBody";
import { TelegramPromptBanner } from "./TelegramPromptBanner";
import { EmailVerificationPromptBanner } from "./EmailVerificationPromptBanner";
import { useEmailVerificationPromptVisibility } from "@/features/email-verification/hooks/useEmailVerificationPromptVisibility";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";
import { useNotificationStore } from "@/features/notifications/store";

type Props = {
  open: boolean;
  stream?: "user" | "business";
  onNotificationRead?: () => void;
  onClose?: () => void;
  listClassName?: string;
};

function isNewRow(n: NotificationApiRow): boolean {
  return n.seenAt == null;
}

/**
 * Единый список уведомлений: без табов, без авто-прочтения по таймеру.
 * При первом открытии панели — POST mark-open (seenAt), без перезагрузки страницы.
 * Показывает ВСЕ уведомления, доступные пользователю (USER + BUSINESS + ADMIN).
 */
export function NotificationFeed({
  open,
  stream,
  onClose,
  listClassName,
}: Props) {
  const notifications = useNotificationStore((s) => s.items);
  const loading = useNotificationStore((s) => s.isLoading);
  const loadingMore = useNotificationStore((s) => s.loadingMore);
  const hasMore = useNotificationStore((s) => s.hasMore);
  const error = useNotificationStore((s) => s.error);
  const showTelegramPrompt = useNotificationStore((s) => s.showTelegramPrompt);
  const fetchMoreNotifications = useNotificationStore((s) => s.fetchMoreNotifications);
  const clearError = useNotificationStore((s) => s.clearError);

  const telegramBannerViewedRef = useRef(false);
  const { visible: emailVerificationPromptVisible, dismiss: dismissEmailVerificationPrompt } =
    useEmailVerificationPromptVisibility();

  useEffect(() => {
    useNotificationStore.getState().setActiveStream(stream ?? "user");
  }, [stream]);

  useEffect(() => {
    if (!open) return;
    void useNotificationStore.getState().openPanel();
  }, [open, stream]);

  useEffect(() => {
    if (!open || !error) return;
    toast.error("Не удалось загрузить уведомления");
    clearError();
  }, [open, error, clearError]);

  useEffect(() => {
    if (showTelegramPrompt && !telegramBannerViewedRef.current) {
      telegramBannerViewedRef.current = true;
      trackNotificationEvent("telegram_pinned_banner_viewed");
    }
  }, [showTelegramPrompt]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    try {
      await fetchMoreNotifications();
    } catch {
      toast.error("Не удалось подгрузить уведомления");
    }
  }, [hasMore, loadingMore, fetchMoreNotifications]);

  const handleNotificationClick = useCallback(
    (notification: NotificationApiRow) => {
      if (notification.type === "WELCOME") {
        trackNotificationEvent("notification_welcome_clicked");
      }
      onClose?.();
    },
    [onClose],
  );

  const getNotificationIcon = (n: NotificationApiRow): string => {
    if (n.type === "WELCOME") return "🎉";
    switch (n.type) {
      case "BOOKING_CREATED":
        return "📋";
      case "PLACE_APPROVED":
        return "✅";
      case "PLACE_NEEDS_CHANGES":
        return "⚠️";
      case "PLACE_REJECTED":
        return "❌";
      case "PLACE_UPDATE_APPROVED":
        return "✅";
      case "PLACE_UPDATE_NEEDS_REVISION":
        return "⚠️";
      case "PLACE_UPDATE_REJECTED":
        return "❌";
      case "NEWS":
        return "📰";
      case "ANNOUNCEMENT":
        return "📣";
      case "SYSTEM":
        if (n.title.includes("почта подтверждена") || n.title.includes("email")) {
          return "✉️";
        }
        return "⚙️";
      default:
        return "📢";
    }
  };

  const showInlineTelegramPrompt =
    showTelegramPrompt && stream !== "business";

  const showInlineEmailVerificationPrompt =
    emailVerificationPromptVisible && stream !== "business";

  const hasAnyContent =
    notifications.length > 0 ||
    showInlineTelegramPrompt ||
    showInlineEmailVerificationPrompt;

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-gray-100 h-20" />
        ))}
      </div>
    );
  }

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Bell className="h-8 w-8 text-gray-300" />
        </div>
        <p className="text-base font-medium text-gray-900">Пока нет уведомлений</p>
        <p className="mt-1 text-sm text-gray-500">
          Здесь появятся важные обновления о ваших заявках и публикациях
        </p>
      </div>
    );
  }

  const renderRow = (notification: NotificationApiRow) => {
    const link = getNotificationHref(notification);
    const icon = getNotificationIcon(notification);
    const isNew = isNewRow(notification);
    const contextBadge = getNotificationProductDomainBadge(notification);

    return (
      <div
        key={notification.id}
        className={cn(
          "p-4 transition-colors hover:bg-gray-50/90",
          isNew
            ? "border-l-[3px] border-[#EF8759] bg-[#FFF8F4]"
            : "border-l border-transparent bg-white",
          notification.isPinned && isNew && "bg-amber-50/50",
        )}
      >
        {link ? (
          <Link
            href={link}
            onClick={() => handleNotificationClick(notification)}
            className="block"
          >
            <FeedRowContent
              notification={notification}
              icon={icon}
              isNew={isNew}
              contextBadge={contextBadge}
            />
          </Link>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleNotificationClick(notification)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleNotificationClick(notification);
            }}
          >
            <FeedRowContent
              notification={notification}
              icon={icon}
              isNew={isNew}
              contextBadge={contextBadge}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-white",
        listClassName,
      )}
    >
      <ScrollArea className="max-h-[min(56vh,520px)] flex-1 bg-white">
        <div className="divide-y divide-gray-100 bg-white">
          {showInlineEmailVerificationPrompt ? (
            <div className="border-b border-gray-100 bg-white p-4">
              <EmailVerificationPromptBanner onDismiss={dismissEmailVerificationPrompt} />
            </div>
          ) : null}
          {showInlineTelegramPrompt ? (
            <div className="border-b border-gray-100 bg-white p-4">
              <TelegramPromptBanner />
            </div>
          ) : null}
          {notifications.map((n) => renderRow(n))}
        </div>
      </ScrollArea>
      {hasMore ? (
        <div className="shrink-0 border-t border-gray-100 p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Загрузка…" : "Загрузить ещё"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FeedRowContent({
  notification,
  icon,
  isNew,
  contextBadge,
}: {
  notification: NotificationApiRow;
  icon: string;
  isNew: boolean;
  contextBadge?: { label: string; color: string } | null;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 text-2xl">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className={cn(
                  "text-sm text-gray-900",
                  isNew ? "font-semibold" : "font-medium text-gray-700",
                )}
              >
                {notification.type === "WELCOME"
                  ? displayWelcomeNotificationTitle(notification.title)
                  : notification.title}
              </p>
              {contextBadge && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full", contextBadge.color)}>
                  {contextBadge.label}
                </span>
              )}
            </div>
          </div>
          {isNew ? (
            <span className="mt-0.5 shrink-0 rounded-full bg-[#EF8759]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C65D2E]">
              Новое
            </span>
          ) : null}
        </div>
        <NotificationMessageBody body={notification.body} type={notification.type} />
        <p className="mt-1 text-xs text-gray-400">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
            locale: ru,
          })}
        </p>
      </div>
    </div>
  );
}
