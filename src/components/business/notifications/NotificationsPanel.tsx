"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { CheckCheck } from "lucide-react";
import { Settings } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast";
import { handleNotificationClick } from "@/features/notifications/notification-click";
import {
  fetchNotificationsPageApi,
  postReadAllNotificationsApi,
} from "@/features/notifications/store/notification-actions";
import { useNotificationStore } from "@/features/notifications/store";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { useRouter } from "next/navigation";
import { NotificationModal } from "./NotificationModal";
import { NotificationListItem } from "./NotificationListItem";
import { NotificationSettingsInModal } from "./NotificationSettingsInModal";
import { useOnboardingNotificationCta } from "@/features/notifications/hooks/useOnboardingNotificationCta";

export type NotificationsPanelProps = {
  /** Вызывается при закрытии popover/sheet (кнопка X и т.д.) */
  onClose: () => void;
  stream?: "user" | "business";
  onNotificationRead?: () => void;
  /** Родительское открытие — при закрытии сбрасываем list/settings */
  open?: boolean;
  /** В dropdown (popover) закрытие снаружи — кнопку X в шапке не показываем */
  showHeaderClose?: boolean;
};
export function NotificationsPanel({
  onClose,
  stream = "user",
  onNotificationRead,
  open = true,
  showHeaderClose = true,
}: NotificationsPanelProps) {
  const router = useRouter();
  const unreadCount = useNotificationStore((s) =>
    stream === "business" ? s.businessUnreadCount : s.unreadCount,
  );
  const [items, setItems] = useState<NotificationApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [modalNotification, setModalNotification] = useState<NotificationApiRow | null>(null);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [modalBody, setModalBody] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "settings">("list");
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const handleClosePanel = () => {
    setView("list");
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setView("list");
    }
  }, [open]);

  const notificationsPageHref = stream === "business" ? "/business/notifications" : "/notifications";

  const refreshCounts = useCallback(async () => {
    if (onNotificationRead) {
      await onNotificationRead();
      return;
    }
    if (stream === "business") {
      await useNotificationStore.getState().refreshBusinessUnreadOnly({ force: true });
    } else {
      await useNotificationStore.getState().refreshUnreadOnly({ force: true });
    }
  }, [onNotificationRead, stream]);

  const refreshRecent = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchNotificationsPageApi(0, 7, stream, "inbox");
      setItems(page.notifications);
    } catch (error) {
      console.error(error);
      toast.error("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  }, [stream]);

  useEffect(() => {
    if (!open) return;
    void refreshRecent();
  }, [open, refreshRecent]);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      await postReadAllNotificationsApi();
      await refreshCounts();
      await refreshRecent();
    } catch (error) {
      console.error(error);
      toast.error("Не удалось отметить уведомления как прочитанные");
    } finally {
      setMarkingAllRead(false);
    }
  }, [refreshCounts, refreshRecent]);

  const markItemAsReadLocally = useCallback(
    async (notificationId: string) => {
      setItems((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                seenAt: notification.seenAt ?? new Date().toISOString(),
                readAt: notification.readAt ?? new Date().toISOString(),
              }
            : notification,
        ),
      );
      await refreshCounts();
    },
    [refreshCounts],
  );

  const refreshPanel = useCallback(async () => {
    await refreshCounts();
    await refreshRecent();
  }, [refreshCounts, refreshRecent]);

  const openSettings = useCallback(() => {
    // Вложенная NotificationModal перекрывала бы настройки — закрываем её первой.
    setModalNotification(null);
    setModalTitle(null);
    setModalBody(null);
    setView("settings");
    window.setTimeout(() => backButtonRef.current?.focus(), 0);
  }, []);

  const backToList = useCallback(() => {
    setView("list");
    // Настройки могли изменить набор/состояние уведомлений — список нужен свежий.
    void refreshPanel();
    window.setTimeout(() => settingsButtonRef.current?.focus(), 0);
  }, [refreshPanel]);

  const { handleCtaClick: handleOnboardingCta, getCtaProps } =
    useOnboardingNotificationCta({
      onRefresh: refreshPanel,
    });

  const handleCtaClick = useCallback(
    async (notification: NotificationApiRow) => {
      const handled = await handleOnboardingCta(notification);
      if (handled) {
        return;
      }

      if (!notification.actionUrl) return;
      onClose();
      router.push(notification.actionUrl);
    },
    [handleOnboardingCta, onClose, router],
  );

  const handleRowClick = useCallback(
    async (notification: NotificationApiRow) => {
      try {
        await handleNotificationClick({
          notification,
          router,
          onAfterRead: (notificationId) => {
            void markItemAsReadLocally(notificationId);
          },
          onClose,
          onOpenModal: (item, action) => {
            setModalNotification({
              ...item,
              actionUrl: action.actionUrl,
              readAt: item.readAt ?? new Date().toISOString(),
            });
            setModalTitle(action.modalTitle);
            setModalBody(action.modalBody);
          },
        });
      } catch (error) {
        console.error(error);
        toast.error("Не удалось открыть уведомление");
      }
    },
    [markItemAsReadLocally, onClose, router],
  );

  const hasUnread = useMemo(() => items.some((item) => item.readAt == null), [items]);

  return (
    <div className="flex max-h-[min(85vh,640px)] min-h-[320px] min-w-0 flex-col overflow-hidden bg-white">
      <span className="sr-only" aria-live="polite">
        {view === "list" ? "Уведомления" : "Настройки уведомлений"}
      </span>
      {view === "list" ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-neutral-900">Уведомления</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={settingsButtonRef}
              type="button"
              onClick={openSettings}
              aria-label="Настройки уведомлений"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              <Settings className="h-[18px] w-[18px] shrink-0" aria-hidden />
            </button>
            {showHeaderClose ? (
              <ModalCloseButton
                type="button"
                className="shrink-0"
                aria-label="Закрыть уведомления"
                onClick={handleClosePanel}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              ref={backButtonRef}
              type="button"
              onClick={backToList}
              aria-label="Назад к списку"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              <ArrowLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
            </button>
            <h2 className="truncate text-lg font-semibold text-neutral-900">
              Настройки уведомлений
            </h2>
          </div>
          {showHeaderClose ? (
            <ModalCloseButton
              type="button"
              className="shrink-0"
              aria-label="Закрыть уведомления"
              onClick={handleClosePanel}
            />
          ) : null}
        </div>
      )}

      {view === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
          <NotificationSettingsInModal
            mode={stream === "business" ? "business" : "user"}
          />
        </div>
      ) : (
        <>
      <div className="min-h-0 flex-1 bg-white">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Bell className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-base font-medium text-gray-900">Пока нет уведомлений</p>
            <p className="mt-1 text-sm text-gray-500">
              Здесь появятся важные обновления о ваших заявках и публикациях.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full max-h-[min(56vh,520px)]">
            <div className="divide-y divide-gray-100 bg-white">
              {items.map((notification) => {
                const ctaProps = getCtaProps(notification);
                return (
                  <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    compact
                    onClick={handleRowClick}
                    onCtaClick={handleCtaClick}
                    ctaLabel={ctaProps.label}
                    ctaLoading={ctaProps.loading}
                    ctaDisabled={ctaProps.disabled}
                  />
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-neutral-200/90 bg-white px-4 py-3 sm:px-5">
        {hasUnread && unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={markingAllRead}
            onClick={() => void handleMarkAllRead()}
          >
            <CheckCheck className="h-4 w-4" />
            Отметить все прочитанными
          </Button>
        ) : null}
        <div className="flex min-h-8 items-center justify-center sm:justify-end">
          <Button
            asChild
            type="button"
            variant="ghost"
            className="h-9 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:text-[#EF8759]"
          >
            <Link href={notificationsPageHref} onClick={handleClosePanel}>
              Смотреть все уведомления →
            </Link>
          </Button>
        </div>
      </div>
        </>
      )}

      <NotificationModal
        open={modalNotification != null}
        notification={modalNotification}
        title={modalTitle}
        body={modalBody}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setModalNotification(null);
            setModalTitle(null);
            setModalBody(null);
          }
        }}
      />
    </div>
  );
}
