"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  getNotificationHref,
  getNotificationStreamFromType,
} from "@/lib/notifications/routing";
import type { NotificationApiRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

interface NotificationListProps {
  onNotificationRead?: () => void;
  onClose?: () => void;
  showViewAll?: boolean;
  viewAllHref?: string;
  /** Фильтр по потоку (личные / бизнес); без значения — все типы */
  stream?: "user" | "business";
  /** Разделы «Для вас» / «Бизнес» (только при stream не задан и grouped) */
  grouped?: boolean;
  /** Встроенный заголовок «Уведомления» (для полноэкранной страницы — false) */
  showHeader?: boolean;
  /** Ограничение высоты списка (например на странице /notifications) */
  listClassName?: string;
}

function isBusinessNotificationRow(row: NotificationApiRow): boolean {
  return getNotificationStreamFromType(row.type) === "BUSINESS";
}

export function NotificationList({
  onNotificationRead,
  onClose,
  showViewAll = true,
  viewAllHref = "/business/notifications",
  stream,
  grouped = false,
  showHeader = true,
  listClassName,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<NotificationApiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [stream]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "20" });
      if (stream) params.set("stream", stream);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Не удалось загрузить уведомления");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n,
          ),
        );
        onNotificationRead?.();
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleNotificationClick = (notification: NotificationApiRow) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    onClose?.();
  };

  const getNotificationIcon = (type: string): string => {
    switch (type) {
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
      default:
        return "📢";
    }
  };

  const renderRow = (notification: NotificationApiRow) => {
    const link = getNotificationHref(notification);
    const icon = getNotificationIcon(notification.type);

    return (
      <div
        key={notification.id}
        className={`p-4 hover:bg-gray-50 transition-colors ${
          !notification.isRead ? "bg-blue-50" : "bg-white"
        }`}
      >
        {link ? (
          <Link
            href={link}
            onClick={() => handleNotificationClick(notification)}
            className="block"
          >
            <NotificationContent notification={notification} icon={icon} />
          </Link>
        ) : (
          <div onClick={() => handleNotificationClick(notification)}>
            <NotificationContent notification={notification} icon={icon} />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">Загрузка...</div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center bg-white">
        <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Пока нет уведомлений</p>
      </div>
    );
  }

  const userSection =
    grouped && !stream
      ? notifications.filter((n) => !isBusinessNotificationRow(n))
      : notifications;
  const businessSection =
    grouped && !stream
      ? notifications.filter((n) => isBusinessNotificationRow(n))
      : [];

  return (
    <div
      className={cn(
        "flex flex-col max-h-[500px] bg-white",
        listClassName,
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <h3 className="font-semibold text-gray-900">Уведомления</h3>
          {showViewAll && (
            <Link
              href={viewAllHref}
              className="text-xs text-blue-600 hover:text-blue-700"
              onClick={onClose}
            >
              Все уведомления
            </Link>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 bg-white">
        {grouped && !stream ? (
          <div className="divide-y divide-gray-100">
            <div>
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Для вас
              </p>
              {userSection.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-gray-400">Пока пусто</p>
              ) : (
                userSection.map((n) => renderRow(n))
              )}
            </div>
            <div>
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Бизнес
              </p>
              {businessSection.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-gray-400">Пока пусто</p>
              ) : (
                businessSection.map((n) => renderRow(n))
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y bg-white">
            {notifications.map((n) => renderRow(n))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function NotificationContent({
  notification,
  icon,
}: {
  notification: NotificationApiRow;
  icon: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 text-2xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-gray-900">
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
            locale: ru,
          })}
        </p>
      </div>
    </div>
  );
}
