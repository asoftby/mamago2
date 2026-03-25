"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { NavIconButton } from "@/components/mobile/NavIconButton";
import { MobileProfileSheet } from "@/components/mobile/MobileProfileSheet";
import { PlanPillNavButton } from "@/components/mobile/PlanPillNavButton";
import { useCity } from "@/contexts/CityContext";

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
 * Один inbox уведомлений; счётчик непрочитанных с API.
 */
export function MobileBottomNav({
  hasPlannedEvents,
  planBadgeCount = 0,
  profileBadgeCount = 0,
  profileAvatarUrl,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const { citySlug } = useCity();
  const { unreadCount } = useUnreadNotificationCount();

  const resolvedProfileAvatar = profileAvatarUrl ? profileAvatarUrl : undefined;

  const homeHref = `/${citySlug}`;
  const planHref = "/me/plan";
  const notificationsHref = "/notifications";

  const isHomeActive = pathname === homeHref;
  const isPlanActive =
    pathname.startsWith("/me/plan") || pathname.startsWith("/me/day");
  const isNotificationsActive =
    pathname === "/notifications" || pathname.startsWith("/notifications/");
  const isMeHubOrProfileSection =
    pathname === "/me" ||
    (pathname.startsWith("/me/") &&
      !pathname.startsWith("/me/plan") &&
      !pathname.startsWith("/me/day"));
  const isProfileActive =
    isMeHubOrProfileSection ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/admin");

  /** Пульс на колокольчике: есть непрочитанные и пользователь не на экране уведомлений */
  const showNotificationsUnreadPulse =
    unreadCount > 0 && !isNotificationsActive;

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-40"
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
            badgeCount={planBadgeCount}
            hasPlannedEvents={hasPlannedEvents ?? false}
            className="min-w-0 flex-1"
            chrome="dark"
          />

          <NavIconButton
            href={notificationsHref}
            isActive={isNotificationsActive}
            ariaLabel="Уведомления"
            badgeCount={unreadCount}
            size={NAV_ICON_SIZE}
            chrome="dark"
          >
            <span
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                unreadCount > 0 && "animate-nav-notify-pulse",
                isNotificationsActive
                  ? "bg-[#EF8759]/22"
                  : unreadCount > 0
                    ? "bg-[#EF8759]/24"
                    : "bg-neutral-600/45",
              )}
            >
              <Bell
                className={cn(
                  "h-[22px] w-[22px] transition-colors duration-200",
                  isNotificationsActive || unreadCount > 0
                    ? "text-[#FFB090]"
                    : "text-neutral-300",
                )}
                strokeWidth={
                  isNotificationsActive || unreadCount > 0 ? 1.35 : 1.2
                }
                absoluteStrokeWidth
              />
            </span>
          </NavIconButton>

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
