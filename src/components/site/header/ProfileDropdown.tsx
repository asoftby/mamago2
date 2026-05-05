"use client";

import type { ReactNode } from "react";
import { AccountDropdownSurface } from "@/components/account/AccountDropdownSurface";
import { ProfileMenuContent } from "@/components/site/header/ProfileMenuContent";
import type { AccountMenuUser } from "@/lib/account/types";
import type { AccountMode } from "@/contexts/AccountModeContext";

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
  return (
    <AccountDropdownSurface
      open={open}
      onOpenChange={onOpenChange}
      narrow={narrow}
      trigger={trigger}
      sheetTitle={mode === "business" ? "Бизнес-аккаунт" : "Профиль"}
    >
      <ProfileMenuContent
        mode={mode}
        user={user}
        loggingOut={loggingOut}
        onLogout={onLogout}
        onNavigate={onNavigate}
        onGoToPersonalAccount={onGoToPersonalAccount}
        onGoToPersonalIdeas={onGoToPersonalIdeas}
        onGoToPersonalPlan={onGoToPersonalPlan}
        onGoToPersonalRoutes={onGoToPersonalRoutes}
        onGoToSettings={onGoToSettings}
        onGoToAdminAccount={onGoToAdminAccount}
        onGoToBusinessAccount={onGoToBusinessAccount}
        onGoToBusinessDashboard={onGoToBusinessDashboard}
        onGoToBusinessRoot={onGoToBusinessRoot}
        onGoToBusinessPublications={onGoToBusinessPublications}
        onGoToBusinessBookings={onGoToBusinessBookings}
        onGoToBusinessClients={onGoToBusinessClients}
        onGoToBusinessAnalytics={onGoToBusinessAnalytics}
        onGoToBusinessPromotion={onGoToBusinessPromotion}
        onGoToBusinessBilling={onGoToBusinessBilling}
        onSwitchMode={onSwitchMode}
        onGoToHome={onGoToHome}
        hasBusinessProfile={hasBusinessProfile}
        businessBalanceBYN={businessBalanceBYN}
        sheetLayout={narrow}
      />
    </AccountDropdownSurface>
  );
}
