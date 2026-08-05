"use client";

import { useState } from "react";
import { NavBellIcon } from "@/components/icons/NavBellIcon";
import { usePathname } from "next/navigation";
import {
  getNavIconButtonClassName,
  NavIconButton,
} from "@/components/mobile/NavIconButton";
import { MobileMenuSheet } from "@/components/mobile/MobileMenuSheet";
import { MobileProfileSheet } from "@/components/mobile/MobileProfileSheet";
import { PlanPillNavButton } from "@/components/mobile/PlanPillNavButton";
import { NotificationsMenuContent } from "@/components/site/header/NotificationsMenuContent";
import { useCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useUserNotificationBadgeCount } from "@/features/notifications/hooks/useUserNotificationBadgeCount";
import { requestOpenMyPlan } from "@/lib/my-plan/myPlanOpenIntent";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { cn } from "@/lib/utils";

export type MobileBottomNavProps = {
  /** true — в pill «Мой план» скрыть строку про пустой план (подключить из API) */
  hasPlannedEvents?: boolean;
  /** Planning / recommendations / confirmations — shown on «Мой план» */
  planBadgeCount?: number;
  /** Account / system — shown on profile */
  profileBadgeCount?: number;
  /** undefined / null = иконка профиля; string = фото из URL */
  profileAvatarUrl?: string | null;
};

const NAV_ICON_SIZE = "default" as const;

/**
 * Bottom bar: Главная · «Мой план» · Уведомления · Профиль.
 * Уведомления — только через NotificationsModal (sheet на мобилке).
 */
export function MobileBottomNav({
  hasPlannedEvents,
  planBadgeCount = 0,
  profileBadgeCount = 0,
  profileAvatarUrl,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const { citySlug } = useCity();
  const family = useFamilyPersona();
  const isAuthenticated = !family?.loading && !!family?.menuUser;
  const guestPlanPromo = !family?.loading && !family?.menuUser;
  const { displayUnreadCount, refreshUnreadCount } = useUserNotificationBadgeCount();
  const [activeSheet, setActiveSheet] = useState<null | "notifications" | "profile">(null);

  // Все хуки вызваны — теперь можно делать ранний выход
  if (shouldHideMobileBottomNav(pathname)) return null;

  const resolvedProfileAvatar =
    profileAvatarUrl ?? family?.menuUser?.avatarUrl ?? undefined;

  const homeHref = `/${citySlug}`;
  const planHref = "/me/plan";

  const isHomeActive = pathname === homeHref;
  const isPlanActive =
    pathname.startsWith("/me/plan") || pathname.startsWith("/me/day");
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
    <nav
      className="pointer-events-none left-0 right-0 z-40"
      aria-label="Основная навигация"
    >
      <div
        className={cn(
          "pointer-events-auto mx-3 mb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex items-center gap-1.5 rounded-[28px] border border-[#EBEBEB] bg-[#F6F2EA] p-2 pl-2 pr-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
          <NavIconButton
            href={homeHref}
            isActive={isHomeActive}
            ariaLabel="Главная"
            isHomeLogo
            size={NAV_ICON_SIZE}
            chrome="dark"
            className="border-2 border-white bg-white shadow-[0_4px_14px_rgba(0,0,0,0.14)]"
          />

          <PlanPillNavButton
            href={planHref}
            isActive={isPlanActive}
            onOpenMyPlan={requestOpenMyPlan}
            badgeCount={planBadgeCount}
            hasPlannedEvents={hasPlannedEvents ?? false}
            guestPlanPromo={guestPlanPromo}
            className="min-w-0 flex-1"
            chrome="dark"
          />

          {isAuthenticated && (
            <button
              type="button"
              aria-label="Уведомления"
              aria-expanded={activeSheet === "notifications"}
              onClick={() => setActiveSheet("notifications")}
              className={getNavIconButtonClassName({
                isActive: isNotificationsActive,
                size: NAV_ICON_SIZE,
                chrome: "dark",
              })}
            >
              <NavBellIcon
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  isNotificationsActive || displayUnreadCount > 0
                    ? "text-[#C24E22]"
                    : "text-gray-400",
                )}
              />
              {displayUnreadCount > 0 && (
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-semibold leading-none text-white animate-nav-notify-pulse",
                  )}
                  aria-hidden
                >
                  {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
                </span>
              )}
            </button>
          )}
          {isAuthenticated && (
            <MobileMenuSheet
              open={activeSheet === "notifications"}
              onOpenChange={(open) => setActiveSheet(open ? "notifications" : null)}
              title="Уведомления"
              showTitleBar={false}
              bodyClassName="pb-0"
            >
              <NotificationsMenuContent
                open={activeSheet === "notifications"}
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
            profileBadgeCount={profileBadgeCount}
            profileAvatarUrl={resolvedProfileAvatar}
            chrome="dark"
          />
        </div>
      </div>
    </nav>
  );
}
