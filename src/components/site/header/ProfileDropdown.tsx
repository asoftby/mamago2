"use client";

import type { ReactNode } from "react";
import { AccountDropdown } from "@/components/account/AccountDropdown";
import type { AccountMenuUser } from "@/lib/account/types";
import type { AccountMode } from "@/contexts/AccountModeContext";
import {
  buildPublicSiteAccountModel,
  buildBusinessAccountModel,
} from "@/lib/account/accountMenuBuilders";
import { userInitialsFromEmail } from "@/lib/account/userInitials";

export type ProfileDropdownProps = {
  mode: AccountMode;
  user: AccountMenuUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrow: boolean;
  trigger: ReactNode;
  loggingOut: boolean;
  onLogout: () => void | Promise<void>;
  onNavigate: () => void;
  onGoToPersonalAccount: () => void;
  onGoToPersonalIdeas: () => void;
  onGoToPersonalPlan: () => void;
  onGoToPersonalRoutes: () => void;
  onGoToSettings: () => void;
  onGoToAdminAccount: () => void;
  onGoToBusinessAccount: () => void;
  onGoToBusinessDashboard: () => void;
  onGoToBusinessRoot: () => void;
  onGoToBusinessPublications: () => void;
  onGoToBusinessBookings: () => void;
  onGoToBusinessClients: () => void;
  onGoToBusinessAnalytics: () => void;
  onGoToBusinessPromotion: () => void;
  onGoToBusinessBilling: () => void;
  onSwitchMode: (next: AccountMode) => void;
  onGoToHome: () => void;
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
  onGoToPersonalAccount,
  onGoToPersonalIdeas,
  onGoToPersonalPlan,
  onGoToPersonalRoutes,
  onGoToSettings,
  onGoToAdminAccount,
  onGoToBusinessAccount,
  onGoToBusinessDashboard,
  onGoToBusinessRoot,
  onGoToBusinessPublications,
  onGoToBusinessBookings,
  onGoToBusinessClients,
  onGoToBusinessAnalytics,
  onGoToBusinessPromotion,
  onGoToBusinessBilling,
  onSwitchMode,
  onGoToHome,
  hasBusinessProfile,
  businessBalanceBYN,
}: ProfileDropdownProps) {
  const initials = userInitialsFromEmail(user.email);
  const builderInput = {
    user,
    initials,
    onNavigate,
    onGoToPersonalAccount,
    onGoToPersonalIdeas,
    onGoToPersonalPlan,
    onGoToPersonalRoutes,
    onGoToSettings,
    onGoToAdminAccount,
    onGoToBusinessAccount,
    onGoToBusinessDashboard,
    onGoToBusinessRoot,
    onGoToBusinessPublications,
    onGoToBusinessBookings,
    onGoToBusinessClients,
    onGoToBusinessAnalytics,
    onGoToBusinessPromotion,
    onGoToBusinessBilling,
    onSwitchMode,
    onGoToHome,
    hasBusinessProfile,
    businessBalanceBYN,
    onLogout,
    loggingOut,
  };

  const model =
    mode === "business"
      ? buildBusinessAccountModel(builderInput)
      : buildPublicSiteAccountModel({ ...builderInput, mode });

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
