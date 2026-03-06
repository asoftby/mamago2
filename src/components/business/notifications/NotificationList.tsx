"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationListProps {
  onNotificationRead?: () => void;
  onClose?: () => void;
  showViewAll?: boolean;
}

export function NotificationList({
  onNotificationRead,
  onClose,
  showViewAll = true,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=10");
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
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
        onNotificationRead?.();
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    onClose?.();
  };

  const getNotificationLink = (notification: Notification): string | null => {
    if (notification.entityType === "PLACE" && notification.entityId) {
      return `/business/places/${notification.entityId}/edit`;
    }
    return null;
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

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="p-8 text-center bg-white">
        <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Нет уведомлений</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[500px] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <h3 className="font-semibold text-gray-900">Уведомления</h3>
        {showViewAll && (
          <Link
            href="/business/notifications"
            className="text-xs text-blue-600 hover:text-blue-700"
            onClick={onClose}
          >
            Все уведомления
          </Link>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1 bg-white">
        <div className="divide-y bg-white">{notifications.map((notification) => {
            const link = getNotificationLink(notification);
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
                    <NotificationContent
                      notification={notification}
                      icon={icon}
                    />
                  </Link>
                ) : (
                  <div onClick={() => handleNotificationClick(notification)}>
                    <NotificationContent
                      notification={notification}
                      icon={icon}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function NotificationContent({
  notification,
  icon,
}: {
  notification: Notification;
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

// Import Bell icon for empty state
import { Bell } from "lucide-react";
