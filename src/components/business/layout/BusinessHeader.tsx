"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import { NotificationsDropdown } from "@/components/site/header/NotificationsDropdown";
import { ProfileDropdown } from "@/components/site/header/ProfileDropdown";
import type { AccountMenuUser } from "@/components/site/header/AccountMenuBody";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { cn } from "@/lib/utils";

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

interface BusinessHeaderProps {
  user: AccountMenuUser;
}

export function BusinessHeader({ user }: BusinessHeaderProps) {
  const router = useRouter();
  const narrow = useNarrowViewport();
  const { mode, goToBusinessAccount, goToPersonalAccount, hydrated } =
    useAccountMode();
  const [menuOpen, setMenuOpen] = useState(false);
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
        router.replace("/");
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = userInitials(user.email);
  const isBusinessPartner = user.role === "BUSINESS_OWNER";
  const notificationContext =
    !hydrated
      ? "business"
      : mode === "personal"
        ? "user"
        : "business";

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(HEADER_CHROME_ICON_BUTTON_CLASS, "overflow-hidden p-0")}
      aria-label="Меню аккаунта"
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
    >
      <span className="flex h-full w-full items-center justify-center rounded-full bg-neutral-500 text-[11px] font-semibold text-white">
        {initials}
      </span>
    </Button>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-4 px-6">
        <div className="flex min-w-[200px] items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">
            mamaGo Business
          </span>
        </div>

        <div className="max-w-md flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              placeholder="Поиск..."
              className="h-9 border-gray-200 bg-gray-50 pl-9 focus:bg-white"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <CreatePublicationQuickMenu />
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
            mode={!hydrated ? "business" : mode}
            user={user}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            narrow={narrow}
            trigger={trigger}
            loggingOut={loggingOut}
            onLogout={handleLogout}
            onNavigate={() => setMenuOpen(false)}
            onGoToBusinessAccount={() =>
              goToBusinessAccount(isBusinessPartner)
            }
            onGoToPersonalAccount={goToPersonalAccount}
          />
        </div>
      </div>
    </header>
  );
}
