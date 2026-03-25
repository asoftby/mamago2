"use client";

import { useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { cn } from "@/lib/utils";
import { AdminNotificationsDropdown } from "./notifications/AdminNotificationsDropdown";
import { AdminSidebar } from "./AdminSidebar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ModerationNavCounts } from "@/lib/admin/moderationSidebarConfig";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { AccountDropdown } from "@/components/account/AccountDropdown";
import { buildAdminAccountModel } from "@/lib/account/accountMenuBuilders";
import { userInitialsFromEmail } from "@/lib/account/userInitials";

interface AdminHeaderProps {
  userEmail?: string;
  moderationCounts: ModerationNavCounts;
  b2bPendingVerificationCount?: number;
}

export function AdminHeader({
  userEmail,
  moderationCounts,
  b2bPendingVerificationCount = 0,
}: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const { goToPersonalAccount } = useAccountMode();

  const profileInitials = userInitialsFromEmail(userEmail);

  const profileModel = useMemo(
    () =>
      buildAdminAccountModel({
        userEmail: userEmail ?? "",
        initials: profileInitials,
        goToPersonalAccount,
        onNavigate: () => setProfileOpen(false),
      }),
    [userEmail, profileInitials, goToPersonalAccount],
  );

  const profileTrigger = (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-neutral-500 text-[11px] font-semibold text-white">
      {profileInitials}
    </span>
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
        <div className="flex h-16 lg:h-16 items-center gap-3 sm:gap-4 px-4 lg:px-6 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden shrink-0 p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-gray-600" />
            ) : (
              <Menu className="h-5 w-5 text-gray-600" />
            )}
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-base lg:text-lg font-semibold text-gray-900">
              <span className="hidden sm:inline">mamaGo Admin</span>
              <span className="sm:hidden">Admin</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <CreatePublicationQuickMenu />
            <AdminNotificationsDropdown
              b2bPendingVerificationCount={b2bPendingVerificationCount}
            />

            <AccountDropdown
              open={profileOpen}
              onOpenChange={setProfileOpen}
              narrow={!!isMobile}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    HEADER_CHROME_ICON_BUTTON_CLASS,
                    "overflow-hidden p-0",
                  )}
                  aria-label="Профиль"
                  aria-expanded={profileOpen}
                  aria-haspopup="dialog"
                >
                  {profileTrigger}
                </Button>
              }
              {...profileModel}
            />
          </div>
        </div>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900">Навигация</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminSidebar
                moderationCounts={moderationCounts}
                b2bPendingVerificationCount={b2bPendingVerificationCount}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
