"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountMenuUser } from "@/components/site/header/AccountMenuBody";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { NotificationsDropdown } from "@/components/site/header/NotificationsDropdown";
import { ProfileDropdown } from "@/components/site/header/ProfileDropdown";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { cn } from "@/lib/utils";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

function userInitials(email: string): string {
  const local = email.split("@")[0] ?? "?";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0];
    const b = parts[parts.length - 1]![0];
    return (a + b).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || "?";
}

export function HeaderAccountMenu() {
  const router = useRouter();
  const narrow = useNarrowViewport();
  const { mode, goToBusinessAccount, goToPersonalAccount, hydrated } =
    useAccountMode();
  const [user, setUser] = useState<AccountMenuUser | null | undefined>(
    undefined,
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as AccountMenuUser;
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok || res.redirected) {
        setUser(null);
        setUserMenuOpen(false);
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
        <Button variant="ghost" size="icon" className={HEADER_CHROME_ICON_BUTTON_CLASS} asChild>
          <Link href="/login" aria-label="Войти или зарегистрироваться">
            <CircleUser className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  const initials = userInitials(user.email);
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
      <span className="flex h-full w-full items-center justify-center rounded-full bg-neutral-500 text-[11px] font-semibold text-white">
        {initials}
      </span>
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
