"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavBellIcon } from "@/components/icons/NavBellIcon";
import { getNavIconButtonClassName } from "@/components/mobile/NavIconButton";
import { MobileMenuSheet } from "@/components/mobile/MobileMenuSheet";
import { MobileProfileSheet } from "@/components/mobile/MobileProfileSheet";
import { NotificationsMenuContent } from "@/components/site/header/NotificationsMenuContent";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useUserNotificationBadgeCount } from "@/features/notifications/hooks/useUserNotificationBadgeCount";
import { cn } from "@/lib/utils";

/**
 * Сервисные действия нижней панели: 🔔 уведомления + 👤 профиль (белые круги 52px, как плашка поиска).
 * Колокольчик — только для авторизованных (у гостя нет уведомлений).
 */
export function MobileHeaderActions() {
  const pathname = usePathname();
  const family = useFamilyPersona();
  const isAuthenticated = !family?.loading && !!family?.menuUser;
  const { displayUnreadCount, refreshUnreadCount } = useUserNotificationBadgeCount();
  const [activeSheet, setActiveSheet] = useState<null | "notifications" | "profile">(null);

  const isNotificationsActive = activeSheet === "notifications";
  const isMeHubOrProfileSection =
    pathname === "/me" ||
    (pathname.startsWith("/me/") &&
      !pathname.startsWith("/me/plan") &&
      !pathname.startsWith("/me/day"));
  const isProfileActive =
    activeSheet === "profile" ||
    isMeHubOrProfileSection ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/admin");

  return (
    <div className="pointer-events-auto flex shrink-0 items-center gap-2">
      {isAuthenticated && (
        <button
          type="button"
          aria-label="Уведомления"
          aria-expanded={isNotificationsActive}
          onClick={() => setActiveSheet("notifications")}
          className={getNavIconButtonClassName({
            isActive: isNotificationsActive,
            chrome: "dark",
          })}
        >
          <NavBellIcon
            className={cn(
              "h-5 w-5 transition-colors duration-200",
              isNotificationsActive || displayUnreadCount > 0 ? "text-[#C24E22]" : "text-gray-400",
            )}
          />
          {displayUnreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white"
              aria-hidden
            >
              {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
            </span>
          )}
        </button>
      )}
      {isAuthenticated && (
        <MobileMenuSheet
          open={isNotificationsActive}
          onOpenChange={(open) => setActiveSheet(open ? "notifications" : null)}
          title="Уведомления"
          showTitleBar={false}
          bodyClassName="pb-0"
        >
          <NotificationsMenuContent
            open={isNotificationsActive}
            stream="user"
            onNotificationRead={() => {
              void refreshUnreadCount();
            }}
            onClose={() => setActiveSheet(null)}
          />
        </MobileMenuSheet>
      )}
      <MobileProfileSheet
        open={activeSheet === "profile"}
        onOpenChange={(open) => setActiveSheet(open ? "profile" : null)}
        isProfileActive={isProfileActive}
        chrome="dark"
      />
    </div>
  );
}
