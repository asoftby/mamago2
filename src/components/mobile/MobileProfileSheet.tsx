"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import type { AccountMenuUser } from "@/components/site/header/AccountMenuBody";
import { DefaultAuthModal } from "@/components/auth/DefaultAuthModal";
import { ProfileDropdown } from "@/components/site/header/ProfileDropdown";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { notifyAuthStateChanged } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import {
  getNavIconButtonClassName,
  type NavIconChrome,
} from "@/components/mobile/NavIconButton";

export type MobileProfileSheetProps = {
  isProfileActive: boolean;
  profileBadgeCount?: number;
  profileAvatarUrl?: string | null;
  /** Совпадает с размером иконок в bottom bar (5 пунктов) */
  compact?: boolean;
  /** Тёмный стеклянный бар (MobileBottomNav) */
  chrome?: NavIconChrome;
};

export function MobileProfileSheet({
  isProfileActive,
  profileBadgeCount = 0,
  profileAvatarUrl,
  compact = false,
  chrome = "light",
}: MobileProfileSheetProps) {
  const router = useRouter();
  const { mode, goToBusinessAccount, goToPersonalAccount, hydrated } =
    useAccountMode();
  const family = useFamilyPersona();
  const user: AccountMenuUser | null | undefined = family
    ? family.loading
      ? undefined
      : family.menuUser
    : undefined;

  const [menuOpen, setMenuOpen] = useState(false);
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok || res.redirected) {
        setMenuOpen(false);
        notifyAuthStateChanged();
        router.replace("/");
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const resolvedProfileAvatar =
    profileAvatarUrl ?? user?.avatarUrl ?? undefined;
  const showBadge = profileBadgeCount > 0;
  const size = compact ? "compact" : "default";

  const inner = resolvedProfileAvatar ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs may be arbitrary
    <img
      src={resolvedProfileAvatar}
      alt=""
      className={cn(
        "rounded-full object-cover ring-1",
        chrome === "dark" ? "ring-neutral-500/30" : "ring-black/[0.06]",
        compact ? "h-8 w-8" : "h-[37px] w-[37px]",
      )}
    />
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors duration-200",
        compact ? "h-9 w-9" : "h-[41px] w-[41px]",
        chrome === "dark"
          ? isProfileActive
            ? "bg-[#EF8759]/22"
            : "bg-neutral-600/45"
          : isProfileActive
            ? "bg-[#EF8759]/12"
            : "bg-neutral-100/95",
      )}
    >
      <User
        className={cn(
          "transition-colors duration-200",
          compact ? "h-[22px] w-[22px]" : "h-[26px] w-[26px]",
          chrome === "dark"
            ? isProfileActive
              ? "text-[#FFB090]"
              : "text-neutral-300"
            : isProfileActive
              ? "text-[#EF8759]"
              : "text-neutral-500",
        )}
        strokeWidth={isProfileActive ? 1.35 : 1.2}
        absoluteStrokeWidth
      />
    </span>
  );

  const triggerClass = getNavIconButtonClassName({
    isActive: isProfileActive,
    size,
    chrome,
  });

  if (user === undefined) {
    return (
      <div className={triggerClass} aria-hidden>
        <span
          className={cn(
            "flex items-center justify-center rounded-full",
            chrome === "dark" ? "bg-neutral-600/40" : "bg-neutral-100/80",
            compact ? "h-9 w-9" : "h-[41px] w-[41px]",
          )}
        >
          <span
            className={cn(
              "animate-pulse rounded-full",
              chrome === "dark" ? "bg-neutral-400/35" : "bg-neutral-200/90",
              compact ? "h-4 w-4" : "h-5 w-5",
            )}
          />
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex shrink-0 items-center justify-center">
        <button
          type="button"
          aria-label="Войти или зарегистрироваться"
          aria-haspopup="dialog"
          aria-expanded={guestAuthOpen}
          className={triggerClass}
          onClick={() => setGuestAuthOpen(true)}
        >
          {inner}
          {showBadge && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2",
                chrome === "dark" ? "ring-neutral-900/95" : "ring-white/90",
              )}
              aria-hidden
            >
              {profileBadgeCount > 9 ? "9+" : profileBadgeCount}
            </span>
          )}
        </button>
        <DefaultAuthModal
          open={guestAuthOpen}
          onOpenChange={setGuestAuthOpen}
          nextHref="/me"
          authEntryPoint="profile"
          dialogTitle="Вход в mamaGo"
          title="Вход в mamaGo"
          subtitle="Планируйте лучшее время с детьми"
          onAuthSuccess={() => {
            setGuestAuthOpen(false);
            notifyAuthStateChanged();
          }}
        />
      </div>
    );
  }

  const isBusinessPartner = user.role === "BUSINESS_OWNER";

  return (
    <ProfileDropdown
      mode={hydrated ? mode : "personal"}
      user={user}
      open={menuOpen}
      onOpenChange={setMenuOpen}
      narrow
      trigger={
        <button
          type="button"
          aria-label="Профиль"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          className={triggerClass}
        >
          {inner}
          {showBadge && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2",
                chrome === "dark" ? "ring-neutral-900/95" : "ring-white/90",
              )}
              aria-hidden
            >
              {profileBadgeCount > 9 ? "9+" : profileBadgeCount}
            </span>
          )}
        </button>
      }
      loggingOut={loggingOut}
      onLogout={handleLogout}
      onNavigate={() => setMenuOpen(false)}
      onGoToBusinessAccount={() => goToBusinessAccount(isBusinessPartner)}
      onGoToPersonalAccount={goToPersonalAccount}
    />
  );
}
