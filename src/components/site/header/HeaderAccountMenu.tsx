"use client";

import { useEffect, useState } from "react";
import { CircleUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DefaultAuthModal } from "@/components/auth/DefaultAuthModal";
import type { AccountMenuUser } from "@/lib/account/types";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { NotificationsDropdown } from "@/components/site/header/NotificationsDropdown";
import { ProfileDropdown } from "@/components/site/header/ProfileDropdown";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { cn } from "@/lib/utils";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { useHydrated } from "@/hooks/use-hydrated";
import { notifyAuthStateChanged } from "@/lib/auth/client";
import { resolveHasBusinessProfile } from "@/lib/account/isBusinessAccountRole";
import { useProfileDropdownHandlers } from "@/lib/account/useProfileDropdownHandlers";

export function HeaderAccountMenu() {
  const narrow = useNarrowViewport();
  const { mode, hydrated } = useAccountMode();
  const family = useFamilyPersona();
  const user: AccountMenuUser | null | undefined = family
    ? family.loading
      ? undefined
      : family.menuUser
    : undefined;

  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [guestAuthOpen, setGuestAuthOpen] = useState(false);
  const headerHydrated = useHydrated();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[HeaderAccountMenu] auth state", {
        isLoading: !headerHydrated || user === undefined,
        userId: user?.id ?? null,
        source: "FamilyPersonaContext.menuUser",
      });
    }
  }, [headerHydrated, user]);

  const handlers = useProfileDropdownHandlers({
    user,
    loggingOut,
    setLoggingOut,
    closeMenu: () => setUserMenuOpen(false),
  });

  if (!headerHydrated || user === undefined) {
    return (
      <div className="flex items-center gap-1.5 md:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled
          className={cn(HEADER_CHROME_ICON_BUTTON_CLASS, "pointer-events-none opacity-60")}
          aria-label="Загрузка профиля"
          aria-busy="true"
        >
          <span className="h-4 w-4 rounded-full bg-gray-100" aria-hidden />
        </Button>
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
        <DefaultAuthModal
          open={guestAuthOpen}
          onOpenChange={setGuestAuthOpen}
          nextHref="/me"
          authEntryPoint="profile"
          dialogTitle="Вход в mamaGo"
          title="Вход в mamaGo"
          subtitle="Планируйте лучшее время с детьми"
          onAuthSuccess={() => {
            if (process.env.NODE_ENV !== "production") {
              console.debug("[HeaderAccountMenu] auth modal success", {
                source: "DefaultAuthModal.onAuthSuccess",
              });
            }
            setGuestAuthOpen(false);
            notifyAuthStateChanged();
          }}
        />
      </div>
    );
  }

  const displayName = user.displayName?.trim() || user.email?.split("@")[0] || "?";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const isBusinessPartner = resolveHasBusinessProfile({
    role: user.role,
    hasApprovedBusinessProfile: user.hasApprovedBusinessProfile,
  });
  const notificationContext = hydrated && mode === "business" ? "business" : "user";

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
        <img src={user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {avatarLetter}
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5 md:gap-2">
      {user && (
        <NotificationsDropdown
          context={notificationContext}
          triggerClassName={cn("inline-flex", HEADER_CHROME_ICON_BUTTON_CLASS)}
        />
      )}
      <ProfileDropdown
        mode={hydrated ? mode : "personal"}
        user={user}
        open={userMenuOpen}
        onOpenChange={setUserMenuOpen}
        narrow={narrow}
        trigger={userTrigger}
        onNavigate={() => setUserMenuOpen(false)}
        hasBusinessProfile={isBusinessPartner}
        businessBalanceBYN={user.businessBalanceBYN}
        {...handlers}
      />
    </div>
  );
}
