"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { displayWelcomeNotificationTitle } from "@/lib/notifications/welcomeNotification";
import { getNotificationHref } from "@/lib/notifications/routing";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { NotificationMessageBody } from "./NotificationMessageBody";
import { TelegramPromptBanner } from "./TelegramPromptBanner";
import { EmailVerificationPromptBanner } from "./EmailVerificationPromptBanner";
import { useEmailVerificationPromptVisibility } from "@/features/email-verification/hooks/useEmailVerificationPromptVisibility";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/auth/client";

const PAGE_SIZE = 15;

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
  onNotificationRead,
  onClose,
  listClassName,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showTelegramPrompt, setShowTelegramPrompt] = useState(false);
  const telegramBannerViewedRef = useRef(false);
  const { visible: emailVerificationPromptVisible, dismiss: dismissEmailVerificationPrompt } =
    useEmailVerificationPromptVisibility();

  const fetchPage = useCallback(
    async (startOffset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(startOffset),
      });
      // Don't pass stream parameter — fetch ALL accessible notifications
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setNotifications([]);
          setHasMore(false);
          setOffset(0);
          return {
            notifications: [],
            hasMore: false,
          };
        }
        const errText = await res.text().catch(() => "");
        let apiDetails = "";
        try {
          const j = JSON.parse(errText) as { details?: string; code?: string };
          if (typeof j.details === "string") apiDetails = j.details;
        } catch {
          /* not JSON */
        }
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[NotificationFeed] GET /api/notifications",
            res.status,
            errText.slice(0, 800),
            apiDetails ? `\n→ ${apiDetails}` : "",
          );
        }
        const hint =
          process.env.NODE_ENV === "development" && apiDetails.includes("does not exist")
            ? " (проверьте миграции: pnpm db:migrate:deploy)"
            : "";
        throw new Error(
          `GET /api/notifications failed (${res.status})${apiDetails ? `: ${apiDetails}${hint}` : errText ? `: ${errText.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json()) as {
        notifications: NotificationApiRow[];
        hasMore?: boolean;
        showTelegramPrompt?: boolean;
        telegramConnected?: boolean;
      };
      const rows = data.notifications || [];
      if (append) {
        setNotifications((prev) => [...prev, ...rows]);
      } else {
        setNotifications(rows);
        if (typeof data.showTelegramPrompt === "boolean") {
          setShowTelegramPrompt(data.showTelegramPrompt);
        }
      }
      setHasMore(Boolean(data.hasMore));
      setOffset(startOffset + rows.length);
      return data;
    },
    [],
  );

  const runMarkOpenAndSync = useCallback(async () => {
    const params = new URLSearchParams();
    // Don't pass stream parameter — mark ALL accessible notifications as seen
    const markRes = await fetch(`/api/notifications/mark-open?${params.toString()}`, {
      method: "POST",
      credentials: "include",
    });
    if (!markRes.ok) return;
    const markData = (await markRes.json()) as {
      showTelegramPrompt?: boolean;
    };
    if (typeof markData.showTelegramPrompt === "boolean") {
      setShowTelegramPrompt(markData.showTelegramPrompt);
    }
    onNotificationRead?.();
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        seenAt: n.seenAt ?? new Date().toISOString(),
        isRead: true,
      })),
    );
  }, [onNotificationRead]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await fetchPage(0, false);
      // Не блокируем первичный рендер списка: mark-open запускаем в фоне.
      void runMarkOpenAndSync();
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, [fetchPage, runMarkOpenAndSync]);

  useEffect(() => {
    if (!open) return;
    void bootstrap();
  }, [open, bootstrap]);

  useEffect(() => {
    const handler = () => {
      if (!open) return;
      void bootstrap();
    };
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler);
  }, [open, bootstrap]);

  useEffect(() => {
    if (showTelegramPrompt && !telegramBannerViewedRef.current) {
      telegramBannerViewedRef.current = true;
      trackNotificationEvent("telegram_pinned_banner_viewed");
    }
  }, [showTelegramPrompt]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    try {
      setLoadingMore(true);
      await fetchPage(offset, true);
    } catch (e) {
      console.error(e);
      toast.error("Не удалось подгрузить уведомления");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, fetchPage, offset]);

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
        // Проверяем, если это уведомление о подтверждении email
        if (n.title.includes("почта подтверждена") || n.title.includes("email")) {
          return "✉️";
        }
        return "⚙️";
      default:
        return "📢";
    }
  };

  const getNotificationContextBadge = (n: NotificationApiRow): { label: string; color: string } | null => {
    if (!n.audience) return null;
    
    switch (n.audience) {
      case "BUSINESS":
        return { label: "Бизнес", color: "bg-blue-100 text-blue-700" };
      case "ADMIN":
        return { label: "Админ", color: "bg-purple-100 text-purple-700" };
      case "USER":
      default:
        return null; // Don't show badge for USER (default context)
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
      <div className="p-6 text-center text-sm text-gray-500">Загрузка…</div>
    );
  }

  if (!hasAnyContent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <Bell className="mb-3 h-10 w-10 text-gray-200" />
        <p className="text-sm text-gray-500">Пока нет уведомлений</p>
      </div>
    );
  }

  const renderRow = (notification: NotificationApiRow) => {
    const link = getNotificationHref(notification);
    const icon = getNotificationIcon(notification);
    const isNew = isNewRow(notification);
    const contextBadge = getNotificationContextBadge(notification);

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
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded", contextBadge.color)}>
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
