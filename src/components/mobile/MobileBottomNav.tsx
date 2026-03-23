"use client";

import { User } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCity } from "@/contexts/CityContext";
import { NavIconButton } from "@/components/mobile/NavIconButton";
import { PlanPillNavButton } from "@/components/mobile/PlanPillNavButton";

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

/**
 * Premium floating glass bottom bar: Home (logo) · «Мой план» (core) · Profile.
 * Routing matches previous 4-tab nav minus Ideas — Ideas stay reachable from header.
 */
export function MobileBottomNav({
  hasPlannedEvents,
  planBadgeCount = 0,
  profileBadgeCount = 0,
  profileAvatarUrl,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const { citySlug } = useCity();

  const resolvedProfileAvatar = profileAvatarUrl ? profileAvatarUrl : undefined;

  const homeHref = `/${citySlug}`;
  const planHref = "/me";
  const profileHref = "/profile";

  const isHomeActive = pathname === homeHref;
  const isPlanActive =
    pathname.startsWith("/me") && !pathname.startsWith("/me/profile");
  const isProfileActive =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/me/profile") ||
    pathname.startsWith("/business") ||
    pathname.startsWith("/admin");

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-40"
      aria-label="Основная навигация"
    >
      {/* Safe area: bar floats above home indicator */}
      <div
        className={cn(
          "pointer-events-auto mx-3 mb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-[28px] p-2 pl-2 pr-2",
            /* Liquid glass: blur + translucency + thin edge + soft lift */
            "border border-white/80 bg-white/65 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl backdrop-saturate-150",
          )}
        >
          <NavIconButton
            href={homeHref}
            isActive={isHomeActive}
            ariaLabel="Главная"
            isHomeLogo
          />

          <PlanPillNavButton
            href={planHref}
            isActive={isPlanActive}
            badgeCount={planBadgeCount}
            hasPlannedEvents={hasPlannedEvents ?? false}
          />

          <NavIconButton
            href={profileHref}
            isActive={isProfileActive}
            ariaLabel="Профиль"
            avatarUrl={resolvedProfileAvatar}
            badgeCount={profileBadgeCount}
          >
            <span
              className={cn(
                "flex h-[41px] w-[41px] shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                isProfileActive
                  ? "bg-[#EF8759]/12"
                  : "bg-neutral-100/95",
              )}
            >
              <User
                className={cn(
                  "h-[26px] w-[26px] transition-colors duration-200",
                  isProfileActive ? "text-[#EF8759]" : "text-neutral-500",
                )}
                strokeWidth={isProfileActive ? 1.35 : 1.2}
                absoluteStrokeWidth
              />
            </span>
          </NavIconButton>
        </div>
      </div>
    </nav>
  );
}
