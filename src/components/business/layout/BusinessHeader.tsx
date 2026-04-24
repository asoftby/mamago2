"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import { NotificationsDropdown } from "@/components/site/header/NotificationsDropdown";
import { ProfileDropdown } from "@/components/site/header/ProfileDropdown";
import type { AccountMenuUser } from "@/components/site/header/AccountMenuBody";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { cn } from "@/lib/utils";
import { navigateToSurface } from "@/lib/routing/clientNavigation";
import { resolveHasBusinessProfile } from "@/lib/account/isBusinessAccountRole";
import { BusinessSidebar } from "./BusinessSidebar";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
        navigateToSurface(router, {
          targetSurface: "public",
          targetPath: "/",
          replace: true,
        });
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = userInitials(user.email);
  const isBusinessPartner = resolveHasBusinessProfile({
    role: user.role,
    hasApprovedBusinessProfile: user.hasApprovedBusinessProfile,
  });
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
    <>
      <header className="sticky top-0 z-50 w-full border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden shrink-0 p-2 -ml-2 hover:bg-stone-100 rounded-lg"
          >
            {mobileNavOpen ? (
              <X className="h-5 w-5 text-stone-600" />
            ) : (
              <Menu className="h-5 w-5 text-stone-600" />
            )}
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-base lg:text-lg font-semibold tracking-tight text-stone-950">
              <span className="hidden sm:inline">mamaGo Business</span>
              <span className="sm:hidden">Business</span>
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <CreatePublicationQuickMenu publicationMode="business" />
            <NotificationsDropdown
              context={notificationContext}
              triggerClassName={cn("inline-flex", HEADER_CHROME_ICON_BUTTON_CLASS)}
            />
            <ProfileDropdown
              mode="business"
              user={user}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              narrow={narrow}
              trigger={trigger}
              loggingOut={loggingOut}
              onLogout={handleLogout}
              onNavigate={() => setMenuOpen(false)}
              onGoToSettings={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/settings",
                })
              }
              onSwitchMode={(next) => {
                if (next === "business") {
                  goToBusinessAccount(isBusinessPartner);
                  return;
                }
                goToPersonalAccount();
              }}
              onGoToHome={() =>
                navigateToSurface(router, {
                  targetSurface: "public",
                  targetPath: "/",
                })
              }
              onGoToPersonalProfile={() =>
                navigateToSurface(router, {
                  targetSurface: "public",
                  targetPath: "/me",
                })
              }
              onGoToPersonalIdeas={() =>
                navigateToSurface(router, {
                  targetSurface: "public",
                  targetPath: "/me/ideas",
                })
              }
              onGoToAdminAccount={() =>
                navigateToSurface(router, {
                  targetSurface: "admin",
                  targetPath: "/",
                })
              }
              onGoToBusinessAccount={() =>
                goToBusinessAccount(isBusinessPartner)
              }
              onGoToPersonalPlan={() =>
                navigateToSurface(router, {
                  targetSurface: "public",
                  targetPath: "/me/plan",
                })
              }
              onGoToPersonalNotifications={() =>
                navigateToSurface(router, {
                  targetSurface: "public",
                  targetPath: "/settings/notifications",
                })
              }
              onGoToBusinessDashboard={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/dashboard",
                })
              }
              onGoToBusinessRoot={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/",
                })
              }
              onGoToBusinessPublications={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/events",
                })
              }
              onGoToBusinessBookings={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/inbox",
                })
              }
              onGoToBusinessClients={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/team",
                })
              }
              onGoToBusinessAnalytics={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/dashboard",
                })
              }
              onGoToBusinessPromotion={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/promotion",
                })
              }
              onGoToBusinessBilling={() =>
                navigateToSurface(router, {
                  targetSurface: "business",
                  targetPath: "/billing/transactions",
                })
              }
              hasBusinessProfile={isBusinessPartner}
              businessBalanceBYN={user.businessBalanceBYN}
            />
          </div>
        </div>
      </header>

      <BottomSheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="Навигация"
        showCloseButton={true}
      >
        <BusinessSidebar variant="sheet" onNavigate={() => setMobileNavOpen(false)} />
      </BottomSheet>
    </>
  );
}
