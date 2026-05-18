"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { resolveHasBusinessProfile } from "@/lib/account/isBusinessAccountRole";
import { notifyAuthStateChanged } from "@/lib/auth/client";
import { navigateToSurface } from "@/lib/routing/clientNavigation";
import type { AccountMenuUser } from "@/lib/account/types";

export type ProfileDropdownHandlers = {
  onGoToHome: () => void;
  onGoToPersonalAccount: () => void;
  onGoToPersonalIdeas: () => void;
  onGoToPersonalPlan: () => void;
  onGoToPersonalBookings: () => void;
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
  onSwitchMode: (next: "personal" | "business") => void;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
};

/**
 * Единый хук обработчиков для ProfileDropdown.
 * Используется в HeaderAccountMenu, BusinessHeader, MobileProfileSheet.
 */
export function useProfileDropdownHandlers(input: {
  user: AccountMenuUser | null | undefined;
  loggingOut: boolean;
  setLoggingOut: (v: boolean) => void;
  closeMenu: () => void;
}): ProfileDropdownHandlers {
  const { user, loggingOut, setLoggingOut, closeMenu } = input;
  const router = useRouter();
  const { mode, goToBusinessAccount, goToPersonalAccount } = useAccountMode();

  const isBusinessPartner = resolveHasBusinessProfile({
    role: user?.role ?? "",
    hasApprovedBusinessProfile: user?.hasApprovedBusinessProfile,
  });

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok || res.redirected) {
        closeMenu();
        notifyAuthStateChanged();
        navigateToSurface(router, {
          targetSurface: "public",
          targetPath: "/",
          replace: true,
        });
      }
    } finally {
      setLoggingOut(false);
    }
  }, [router, closeMenu, setLoggingOut]);

  const onGoToHome = useCallback(() => {
    navigateToSurface(router, { targetSurface: "public", targetPath: "/" });
  }, [router]);

  const onGoToPersonalAccount = useCallback(() => {
    navigateToSurface(router, { targetSurface: "public", targetPath: "/me" });
  }, [router]);

  const onGoToPersonalIdeas = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "public",
      targetPath: "/me/ideas",
    });
  }, [router]);

  const onGoToPersonalPlan = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "public",
      targetPath: "/me/plan",
    });
  }, [router]);

  const onGoToPersonalBookings = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "public",
      targetPath: "/me/bookings",
    });
  }, [router]);

  const onGoToPersonalRoutes = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "public",
      targetPath: "/me/routes",
    });
  }, [router]);

  const onGoToSettings = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: mode === "business" ? "business" : "public",
      targetPath: mode === "business" ? "/settings" : "/me/settings",
    });
  }, [router, mode]);

  const onGoToAdminAccount = useCallback(() => {
    navigateToSurface(router, { targetSurface: "admin", targetPath: "/" });
  }, [router]);

  const onGoToBusinessAccount = useCallback(() => {
    goToBusinessAccount(isBusinessPartner);
  }, [goToBusinessAccount, isBusinessPartner]);

  const onGoToBusinessDashboard = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/dashboard",
    });
  }, [router]);

  const onGoToBusinessRoot = useCallback(() => {
    navigateToSurface(router, { targetSurface: "business", targetPath: "/" });
  }, [router]);

  const onGoToBusinessPublications = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/events",
    });
  }, [router]);

  const onGoToBusinessBookings = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/bookings",
    });
  }, [router]);

  const onGoToBusinessClients = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/team",
    });
  }, [router]);

  const onGoToBusinessAnalytics = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/dashboard",
    });
  }, [router]);

  const onGoToBusinessPromotion = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/promotion",
    });
  }, [router]);

  const onGoToBusinessBilling = useCallback(() => {
    navigateToSurface(router, {
      targetSurface: "business",
      targetPath: "/billing/transactions",
    });
  }, [router]);

  const onSwitchMode = useCallback(
    (next: "personal" | "business") => {
      if (next === "business") {
        goToBusinessAccount(isBusinessPartner);
      } else {
        goToPersonalAccount();
      }
    },
    [goToBusinessAccount, goToPersonalAccount, isBusinessPartner],
  );

  return {
    onGoToHome,
    onGoToPersonalAccount,
    onGoToPersonalIdeas,
    onGoToPersonalPlan,
    onGoToPersonalBookings,
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
    onLogout,
    loggingOut,
  };
}
