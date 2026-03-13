"use client";

import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CheckCircle, FileText, UserPlus, AlertCircle } from "lucide-react";
import type { AdminNotification } from "@/lib/mocks/adminNotifications";

interface AdminNotificationItemProps {
  notification: AdminNotification;
  onRead: (id: string) => void;
}

const typeConfig = {
  MODERATION: {
    icon: FileText,
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  B2B: {
    icon: UserPlus,
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  PAYMENT: {
    icon: CheckCircle,
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
  },
  SYSTEM: {
    icon: AlertCircle,
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
  },
};

export function AdminNotificationItem({
  notification,
  onRead,
}: AdminNotificationItemProps) {
  const config = typeConfig[notification.type];
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-3 py-3 md:px-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
    >
      <div className="flex gap-3">
        {/* Icon Badge */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", config.bgColor)}>
            <Icon className={cn("w-4 h-4", config.iconColor)} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm font-medium text-gray-900">
            {notification.title}
          </p>

          {/* Description */}
          {notification.description && (
            <p className="text-xs text-gray-600 mt-0.5">
              {notification.description}
            </p>
          )}

          {/* Time */}
          <p className="text-xs text-gray-500 mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: ru,
            })}
          </p>
        </div>
      </div>
    </button>
  );
}
