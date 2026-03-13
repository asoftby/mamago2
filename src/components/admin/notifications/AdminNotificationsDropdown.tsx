"use client";

import { useState } from "react";
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

export function AdminNotificationsDropdown() {
  const [notifications, setNotifications] = useState<AdminNotification[]>(mockNotifications);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayNotifications = notifications.slice(0, 5);

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const notificationIcon = (
    <div className="relative flex flex-col items-center">
      {unreadCount > 0 && (
        <span className="mb-[3px] w-1 h-1 bg-red-500 rounded-full"></span>
      )}
      <Bell className="w-5 h-5 text-gray-600" />
    </div>
  );

  const notificationContent = (
    <>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Уведомления</h3>
      </div>

      {/* Notifications List */}
      <div className="max-h-[420px] overflow-y-auto">
        {displayNotifications.length > 0 ? (
          displayNotifications.map((notification) => (
            <AdminNotificationItem
              key={notification.id}
              notification={notification}
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

      {/* Footer */}
      {notifications.length > 5 && (
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

  // Mobile: Bottom Sheet
  if (isMobile) {
    return (
      <>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2"
          onClick={() => setSheetOpen(true)}
        >
          {notificationIcon}
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[70vh] p-0 rounded-t-2xl">
            <SheetTitle className="sr-only">Уведомления</SheetTitle>
            
            {/* Header with close button */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Уведомления</h3>
                <button 
                  onClick={() => setSheetOpen(false)}
                  className="p-1"
                >
                  <Bell className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[calc(70vh-60px)] overflow-y-auto">
              {displayNotifications.length > 0 ? (
                displayNotifications.map((notification) => (
                  <AdminNotificationItem
                    key={notification.id}
                    notification={notification}
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

            {/* Footer */}
            {notifications.length > 5 && (
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

  // Desktop: Dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative p-2">
          {notificationIcon}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="end" 
        className="w-[300px] p-0 bg-white"
        sideOffset={8}
        style={{ maxWidth: '300px' }}
      >
        {notificationContent}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
