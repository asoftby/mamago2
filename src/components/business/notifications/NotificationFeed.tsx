"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bell, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { NotificationModal } from "./NotificationModal";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";
import { handleNotificationClick } from "@/features/notifications/notification-click";
import { useNotificationStore } from "@/features/notifications/store";
import { NotificationListItem } from "./NotificationListItem";

type Props = {
  open: boolean;
  stream?: "user" | "business";
  onNotificationRead?: () => void | Promise<void>;
  onClose?: () => void;
  listClassName?: string;
};

export function NotificationFeed({
  open,
  stream,
  onNotificationRead,
  onClose,
  listClassName,
}: Props) {
  const router = useRouter();
  const notifications = useNotificationStore((s) => s.items);
  const activeTab = useNotificationStore((s) => s.activeTab);
  const loading = useNotificationStore((s) => s.isLoading);
  const loadingMore = useNotificationStore((s) => s.loadingMore);
  const hasMore = useNotificationStore((s) => s.hasMore);
  const error = useNotificationStore((s) => s.error);
  const showTelegramPrompt = useNotificationStore((s) => s.showTelegramPrompt);
  const fetchMoreNotifications = useNotificationStore((s) => s.fetchMoreNotifications);
  const clearError = useNotificationStore((s) => s.clearError);

  const [modalNotification, setModalNotification] = useState<NotificationApiRow | null>(null);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [modalBody, setModalBody] = useState<string | null>(null);

  const telegramBannerViewedRef = useRef(false);

  useEffect(() => {
    useNotificationStore.getState().setActiveStream(stream ?? "user");
  }, [stream]);

  useEffect(() => {
    if (!open) return;
    void useNotificationStore.getState().openPanel();
  }, [open, stream, activeTab]);

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

  const refreshList = useCallback(async () => {
    await useNotificationStore.getState().fetchNotifications({ force: true });
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    try {
      await fetchMoreNotifications();
    } catch {
      toast.error("Не удалось подгрузить уведомления");
    }
  }, [hasMore, loadingMore, fetchMoreNotifications]);

  const markAsReadLocally = useCallback(
    async (notificationId: string) => {
      useNotificationStore.getState().markAsRead(notificationId);
      await onNotificationRead?.();
      await useNotificationStore.getState().refreshUnreadOnly({ force: true });
      if (stream === "business") {
        await useNotificationStore.getState().refreshBusinessUnreadOnly({ force: true });
      }
    },
    [onNotificationRead, stream],
  );

  const handleRowClick = useCallback(
    async (notification: NotificationApiRow) => {
      if (notification.type === "WELCOME") {
        trackNotificationEvent("notification_welcome_clicked");
      }

      try {
        await handleNotificationClick({
          notification,
          router,
          onAfterRead: (notificationId) => {
            void markAsReadLocally(notificationId);
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
      } catch (clickError) {
        console.error(clickError);
        toast.error("Не удалось открыть уведомление");
      }
    },
    [markAsReadLocally, onClose, router],
  );

  const handleArchive = useCallback(
    async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("archive_failed");
      }
      await refreshList();
      await useNotificationStore.getState().refreshUnreadOnly({ force: true });
      if (stream === "business") {
        await useNotificationStore.getState().refreshBusinessUnreadOnly({ force: true });
      }
    },
    [refreshList, stream],
  );

  const handleRestore = useCallback(
    async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("restore_failed");
      }
      await refreshList();
    },
    [refreshList],
  );

  const hasAnyContent = notifications.length > 0;

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!hasAnyContent) {
    const emptyStateText =
      activeTab === "archived"
        ? {
            title: "Архив пуст",
            description: "Архивированные уведомления появятся здесь.",
          }
        : activeTab === "unread"
          ? {
              title: "Нет непрочитанных уведомлений",
              description: "Когда появятся новые уведомления, они будут показаны здесь.",
            }
          : {
              title: "Пока нет уведомлений",
              description: "Здесь появятся важные обновления о ваших заявках и публикациях.",
            };

    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Bell className="h-8 w-8 text-gray-300" />
        </div>
        <p className="text-base font-medium text-gray-900">{emptyStateText.title}</p>
        <p className="mt-1 text-sm text-gray-500">{emptyStateText.description}</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden bg-white", listClassName)}>
        <div className="divide-y divide-gray-100 bg-white">
          {notifications.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              onClick={handleRowClick}
              trailingAction={
                activeTab === "archived" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void handleRestore(notification.id)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : notification.readAt ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void handleArchive(notification.id)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                ) : null
              }
            />
          ))}
        </div>
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
    </>
  );
}
