"use client";

import type { ReactNode } from "react";
import { AccountDropdown } from "@/components/account/AccountDropdown";
import type { AccountMenuUser } from "@/lib/account/types";
import type { AccountMode } from "@/contexts/AccountModeContext";
import { buildPublicSiteAccountModel } from "@/lib/account/accountMenuBuilders";
import { userInitialsFromEmail } from "@/lib/account/userInitials";

export type ProfileDropdownProps = {
  mode: AccountMode;
  user: AccountMenuUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrow: boolean;
  trigger: ReactNode;
  loggingOut: boolean;
  onLogout: () => void;
  onNavigate: () => void;
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onGoToPersonalProfile: () => void;
  onGoToPersonalAccount: () => void;
  onGoToPersonalPlan: () => void;
  onGoToBusinessDashboard: () => void;
  onGoToBusinessPlaces: () => void;
  onGoToBusinessCommercial: () => void;
};

export function ProfileDropdown({
  mode,
  user,
  open,
  onOpenChange,
  narrow,
  trigger,
  loggingOut,
  onLogout,
  onNavigate,
  onGoToAdminAccount,
  onGoToBusinessAccount,
  onGoToPersonalProfile,
  onGoToPersonalAccount,
  onGoToPersonalPlan,
  onGoToBusinessDashboard,
  onGoToBusinessPlaces,
  onGoToBusinessCommercial,
}: ProfileDropdownProps) {
  const initials = userInitialsFromEmail(user.email);
  const model = buildPublicSiteAccountModel({
    user,
    mode,
    initials,
    onNavigate,
    onGoToAdminAccount,
    onGoToBusinessAccount,
    onGoToPersonalAccount,
    onGoToPersonalProfile,
    onGoToPersonalPlan,
    onGoToBusinessDashboard,
    onGoToBusinessPlaces,
    onGoToBusinessCommercial,
    onLogout,
    loggingOut,
  });

  return (
    <AccountDropdown
      open={open}
      onOpenChange={onOpenChange}
      narrow={narrow}
      trigger={trigger}
      {...model}
    />
  );
}
