"use client";

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { AdminNotificationItem } from "./AdminNotificationItem";
import { mockNotifications } from "@/lib/mocks/adminNotifications";
import type { AdminNotification } from "@/lib/mocks/adminNotifications";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { adminPath } from "@/components/admin/AdminNav";
import { pluralRu } from "@/lib/i18n/pluralRu";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { cn } from "@/lib/utils";

const B2B_SYS_ID = "sys-b2b-pending";

interface AdminNotificationsDropdownProps {
  /** Реальное число заявок PENDING в БД — в списке уведомлений; на колокольчике — точка при непрочитанных */
  b2bPendingVerificationCount?: number;
}

export function AdminNotificationsDropdown({
  b2bPendingVerificationCount = 0,
}: AdminNotificationsDropdownProps) {
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const notifications = useMemo(() => {
    let base: AdminNotification[] = [...mockNotifications];
    if (b2bPendingVerificationCount > 0) {
      // Убираем демо-B2B из мока, чтобы не дублировать с реальным счётчиком
      base = base.filter((n) => n.id !== "2");
      const word = pluralRu(
        b2bPendingVerificationCount,
        "заявка",
        "заявки",
        "заявок"
      );
      base.unshift({
        id: B2B_SYS_ID,
        type: "B2B",
        title: "Заявки на верификацию",
        description: `${b2bPendingVerificationCount} ${word} на проверке`,
        link: `${adminPath("/b2b/requests")}?status=PENDING`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    return base;
  }, [b2bPendingVerificationCount]);

  const isRead = (n: AdminNotification) => readMap[n.id] ?? n.read;
  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  const displayNotifications = notifications.slice(0, 8);

  const handleMarkAsRead = (id: string) => {
    setReadMap((prev) => ({ ...prev, [id]: true }));
  };

  const triggerClass = cn(
    "relative",
    HEADER_CHROME_ICON_BUTTON_CLASS,
  );

  const notificationIcon = (
    <>
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </>
  );

  const notificationContent = (
    <>
      <div className="px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Уведомления</h3>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {displayNotifications.length > 0 ? (
          displayNotifications.map((notification) => (
            <AdminNotificationItem
              key={notification.id}
              notification={{ ...notification, read: isRead(notification) }}
              onRead={handleMarkAsRead}
            />
          ))
        ) : (
          <div className="px-3 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">Нет уведомлений</p>
          </div>
        )}
      </div>

      {notifications.length > 8 && (
        <div className="px-3 py-2 border-t border-gray-200">
          <a
            href="/admin/notifications"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Посмотреть все →
          </a>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClass}
          onClick={() => setSheetOpen(true)}
          aria-label="Уведомления"
        >
          {notificationIcon}
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[70vh] p-0 rounded-t-2xl">
            <SheetTitle className="sr-only">Уведомления</SheetTitle>

            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  Уведомления
                </h3>
              </div>
            </div>

            <div className="max-h-[calc(70vh-60px)] overflow-y-auto">
              {displayNotifications.length > 0 ? (
                displayNotifications.map((notification) => (
                  <AdminNotificationItem
                    key={notification.id}
                    notification={{
                      ...notification,
                      read: isRead(notification),
                    }}
                    onRead={handleMarkAsRead}
                  />
                ))
              ) : (
                <div className="px-4 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600">Нет уведомлений</p>
                </div>
              )}
            </div>

            {notifications.length > 8 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <a
                  href="/admin/notifications"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium block text-center"
                >
                  Посмотреть все →
                </a>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClass}
          aria-label="Уведомления"
        >
          {notificationIcon}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[300px] p-0 bg-white"
        sideOffset={8}
        style={{ maxWidth: "300px" }}
      >
        {notificationContent}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
