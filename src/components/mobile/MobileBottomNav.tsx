"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationsModal } from "@/components/business/notifications/NotificationsModal";
import {
  getNavIconButtonClassName,
  NavIconButton,
} from "@/components/mobile/NavIconButton";
import { MobileProfileSheet } from "@/components/mobile/MobileProfileSheet";
import { PlanPillNavButton } from "@/components/mobile/PlanPillNavButton";
import { useCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useUserNotificationBadgeCount } from "@/features/notifications/hooks/useUserNotificationBadgeCount";
import { requestOpenMyPlan } from "@/lib/my-plan/myPlanOpenIntent";
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

const NAV_ICON_SIZE = "compact" as const;

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
  const { displayUnreadCount, refreshUnreadCount } = useUserNotificationBadgeCount();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const resolvedProfileAvatar =
    profileAvatarUrl ?? family?.menuUser?.avatarUrl ?? undefined;

  const homeHref = `/${citySlug}`;
  const planHref = "/me/plan";

  const isHomeActive = pathname === homeHref;
  const isPlanActive =
    pathname.startsWith("/me/plan") || pathname.startsWith("/me/day");
  const isNotificationsActive = notificationsOpen;
  const isMeHubOrProfileSection =
    pathname === "/me" ||
    (pathname.startsWith("/me/") &&
      !pathname.startsWith("/me/plan") &&
      !pathname.startsWith("/me/day"));
  const isProfileActive =
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
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-[28px] p-2 pl-2 pr-2",
            "border border-neutral-600/35",
            "bg-gradient-to-b from-neutral-800/[0.96] to-neutral-900/[0.98]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_36px_rgba(0,0,0,0.4)]",
            "backdrop-blur-xl backdrop-saturate-100",
          )}
        >
          <NavIconButton
            href={homeHref}
            isActive={isHomeActive}
            ariaLabel="Главная"
            isHomeLogo
            size={NAV_ICON_SIZE}
            chrome="dark"
          />

          <PlanPillNavButton
            href={planHref}
            isActive={isPlanActive}
            onOpenMyPlan={requestOpenMyPlan}
            badgeCount={planBadgeCount}
            hasPlannedEvents={hasPlannedEvents ?? false}
            className="min-w-0 flex-1"
            chrome="dark"
          />

          {isAuthenticated && (
            <button
              type="button"
              aria-label="Уведомления"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen(true)}
              className={getNavIconButtonClassName({
                isActive: isNotificationsActive,
                size: NAV_ICON_SIZE,
                chrome: "dark",
              })}
            >
              <span
                className={cn(
                  "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                  displayUnreadCount > 0 && "animate-nav-notify-pulse",
                  isNotificationsActive
                    ? "bg-[#EF8759]/22"
                    : displayUnreadCount > 0
                      ? "bg-[#EF8759]/24"
                      : "bg-neutral-600/45",
                )}
              >
                <Bell
                  className={cn(
                    "h-[22px] w-[22px] transition-colors duration-200",
                    isNotificationsActive || displayUnreadCount > 0
                      ? "text-[#FFB090]"
                      : "text-neutral-300",
                  )}
                  strokeWidth={
                    isNotificationsActive || displayUnreadCount > 0 ? 1.35 : 1.2
                  }
                  absoluteStrokeWidth
                />
              </span>
              {displayUnreadCount > 0 && (
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-neutral-900/95",
                  )}
                  aria-hidden
                >
                  {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
                </span>
              )}
            </button>
          )}
          {isAuthenticated && (
            <NotificationsModal
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              stream="user"
              onNotificationRead={() => {
                void refreshUnreadCount();
              }}
            />
          )}

          <MobileProfileSheet
            isProfileActive={isProfileActive}
            profileBadgeCount={profileBadgeCount}
            profileAvatarUrl={resolvedProfileAvatar}
            compact
            chrome="dark"
          />
        </div>
      </div>
    </nav>
  );
}
