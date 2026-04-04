"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteAuthModal } from "@/components/auth/SiteAuthModal";
import type { AccountMenuUser } from "@/components/site/header/AccountMenuBody";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { NotificationsDropdown } from "@/components/site/header/NotificationsDropdown";
import { ProfileDropdown } from "@/components/site/header/ProfileDropdown";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { cn } from "@/lib/utils";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { notifyAuthStateChanged } from "@/lib/auth/client";

/**
 * Меню профиля: только отображение primary adult persona из FamilyPersonaContext
 * (единый источник с блоком «Моя семья»), без отдельного fetch / редактирования персоны здесь.
 */
export function HeaderAccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const narrow = useNarrowViewport();
  const { mode, goToBusinessAccount, goToPersonalAccount, hydrated } =
    useAccountMode();
  const family = useFamilyPersona();
  const user: AccountMenuUser | null | undefined = family
    ? family.loading
      ? undefined
      : family.menuUser
    : undefined;

  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok || res.redirected) {
        setUserMenuOpen(false);
        notifyAuthStateChanged();
        router.replace("/");
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  };

  if (user === undefined) {
    return (
      <div className="flex items-center gap-1.5 md:gap-2">
        <span
          className={cn(
            HEADER_CHROME_ICON_BUTTON_CLASS,
            "pointer-events-none inline-flex items-center justify-center opacity-60",
          )}
          aria-hidden
        >
          <span className="h-4 w-4 rounded-full bg-gray-100" />
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={HEADER_CHROME_ICON_BUTTON_CLASS}
          aria-label="Войти или зарегистрироваться"
          aria-haspopup="dialog"
          aria-expanded={guestAuthOpen}
          onClick={() => setGuestAuthOpen(true)}
        >
          <CircleUser className="h-4 w-4" aria-hidden />
        </Button>
        <SiteAuthModal
          open={guestAuthOpen}
          onOpenChange={setGuestAuthOpen}
          nextHref={pathname || "/"}
          dialogTitle="Вход в mamaGo"
          title="Вход в mamaGo"
          subtitle="Планируйте лучшее время с детьми"
          onAuthSuccess={() => {
            setGuestAuthOpen(false);
            notifyAuthStateChanged();
            router.refresh();
          }}
        />
      </div>
    );
  }

  const displayName = user.displayName?.trim() || user.email.split("@")[0] || "?";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isBusinessPartner = user.role === "BUSINESS_OWNER";
  const notificationContext =
    hydrated && mode === "business" ? "business" : "user";

  const userTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(HEADER_CHROME_ICON_BUTTON_CLASS, "overflow-hidden p-0")}
      aria-label="Меню аккаунта"
      aria-haspopup="dialog"
      aria-expanded={userMenuOpen}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {avatarLetter}
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5 md:gap-2">
      <NotificationsDropdown
        context={notificationContext}
        narrow={narrow}
        viewAllHref={
          notificationContext === "business"
            ? "/business/notifications"
            : "/notifications"
        }
        triggerClassName={cn("inline-flex", HEADER_CHROME_ICON_BUTTON_CLASS)}
      />

      <ProfileDropdown
        mode={hydrated ? mode : "personal"}
        user={user}
        open={userMenuOpen}
        onOpenChange={setUserMenuOpen}
        narrow={narrow}
        trigger={userTrigger}
        loggingOut={loggingOut}
        onLogout={handleLogout}
        onNavigate={() => setUserMenuOpen(false)}
        onGoToBusinessAccount={() =>
          goToBusinessAccount(isBusinessPartner)
        }
        onGoToPersonalAccount={goToPersonalAccount}
      />
    </div>
  );
}
