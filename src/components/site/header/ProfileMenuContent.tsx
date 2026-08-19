"use client";

import { AccountDropdownContent } from "@/components/account/AccountDropdownContent";
import type { AccountDropdownContentProps } from "@/components/account/AccountDropdownContent";
import type { ProfileDropdownProps } from "@/components/site/header/ProfileDropdown";
import {
  buildBusinessAccountModel,
  buildPublicSiteAccountModel,
} from "@/lib/account/accountMenuBuilders";
import { userInitialsFromEmail } from "@/lib/account/userInitials";

export type ProfileMenuContentProps = Omit<
  ProfileDropdownProps,
  "open" | "onOpenChange" | "narrow" | "trigger"
> & {
  sheetLayout?: boolean;
};

function toContentProps(
  model: ReturnType<typeof buildBusinessAccountModel>,
  sheetLayout: boolean,
): AccountDropdownContentProps {
  return {
    ...model,
    sheetLayout,
  };
}

export function ProfileMenuContent({
  mode,
  user,
  loggingOut,
  onLogout,
  onNavigate,
  onGoToPersonalAccount,
  onGoToPersonalIdeas,
  onGoToPersonalPlan,
  onGoToPersonalBookings,
  onGoToPersonalDirect,
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
  sheetLayout = false,
}: ProfileMenuContentProps) {
  const initials = userInitialsFromEmail(user.email);
  const builderInput = {
    user,
    initials,
    onNavigate,
    onGoToPersonalAccount,
    onGoToPersonalIdeas,
    onGoToPersonalPlan,
    onGoToPersonalBookings,
    onGoToPersonalDirect,
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
    <AccountDropdownContent
      {...toContentProps(model, sheetLayout)}
      chromeTone={mode === "business" ? "business" : "user"}
    />
  );
}
