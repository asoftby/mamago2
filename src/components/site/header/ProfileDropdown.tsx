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
  onGoToSettings: () => void;
  onSwitchMode: (next: AccountMode) => void;
  onGoToHome: () => void;
  onGoToPersonalProfile: () => void;
  onGoToPersonalIdeas: () => void;
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onGoToPersonalPlan: () => void;
  onGoToPersonalNotifications: () => void;
  onGoToBusinessDashboard: () => void;
  onGoToBusinessRoot: () => void;
  onGoToBusinessPublications: () => void;
  onGoToBusinessBookings: () => void;
  onGoToBusinessClients: () => void;
  onGoToBusinessAnalytics: () => void;
  onGoToBusinessPromotion: () => void;
  onGoToBusinessBilling: () => void;
  hasBusinessProfile: boolean;
  businessBalanceBYN?: number;
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
  onGoToSettings,
  onSwitchMode,
  onGoToHome,
  onGoToPersonalProfile,
  onGoToPersonalIdeas,
  onGoToAdminAccount,
  onGoToBusinessAccount,
  onGoToPersonalPlan,
  onGoToPersonalNotifications,
  onGoToBusinessDashboard,
  onGoToBusinessRoot,
  onGoToBusinessPublications,
  onGoToBusinessBookings,
  onGoToBusinessClients,
  onGoToBusinessAnalytics,
  onGoToBusinessPromotion,
  onGoToBusinessBilling,
  hasBusinessProfile,
  businessBalanceBYN,
}: ProfileDropdownProps) {
  const initials = userInitialsFromEmail(user.email);
  const model = buildPublicSiteAccountModel({
    user,
    mode,
    initials,
    onNavigate,
    onGoToSettings,
    onSwitchMode,
    onGoToHome,
    onGoToPersonalProfile,
    onGoToPersonalIdeas,
    onGoToAdminAccount,
    onGoToBusinessAccount,
    onGoToPersonalPlan,
    onGoToPersonalNotifications,
    onGoToBusinessDashboard,
    onGoToBusinessRoot,
    onGoToBusinessPublications,
    onGoToBusinessBookings,
    onGoToBusinessClients,
    onGoToBusinessAnalytics,
    onGoToBusinessPromotion,
    onGoToBusinessBilling,
    hasBusinessProfile,
    businessBalanceBYN,
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
