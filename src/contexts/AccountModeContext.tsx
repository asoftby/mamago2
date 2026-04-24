"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { shouldRedirectPersonalModeAwayFromBusiness } from "@/lib/accountModePaths";
import { BUSINESS_PATH_PREFIX } from "@/lib/routing/surface";
import { navigateToSurface } from "@/lib/routing/clientNavigation";

export type AccountMode = "personal" | "business";
export type AppMode = "USER" | "BUSINESS";

const STORAGE_KEY = "mamago.accountMode";
const COOKIE_KEY = "mamago_mode";

type AccountModeContextValue = {
  mode: AccountMode;
  appMode: AppMode;
  /** Синхронная установка режима + localStorage */
  setMode: (next: AccountMode) => void;
  /** Переключить в бизнес-режим и перейти в кабинет / онбординг */
  goToBusinessAccount: (isBusinessPartner: boolean) => void;
  /** Личный режим и переход в /me */
  goToPersonalAccount: () => void;
  /** После гидрации из localStorage */
  hydrated: boolean;
};

const AccountModeContext = createContext<AccountModeContextValue | null>(null);

export function AccountModeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setModeState] = useState<AccountMode>(() => {
    if (typeof window === "undefined") {
      return "personal";
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "business" || raw === "personal") {
      return raw;
    }
    const path = window.location.pathname;
    if (
      path.startsWith(BUSINESS_PATH_PREFIX) &&
      shouldRedirectPersonalModeAwayFromBusiness(path)
    ) {
      return "business";
    }
    localStorage.setItem(STORAGE_KEY, "personal");
    return "personal";
  });
  const [hydrated, setHydrated] = useState(true);

  const setMode = useCallback((next: AccountMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const goToBusinessAccount = useCallback(
    (isBusinessPartner: boolean) => {
      setMode("business");
      navigateToSurface(router, {
        targetSurface: "business",
        targetPath: isBusinessPartner ? "/dashboard" : "/onboarding",
      });
    },
    [router, setMode],
  );

  const goToPersonalAccount = useCallback(() => {
    setMode("personal");
    navigateToSurface(router, {
      targetSurface: "public",
      targetPath: "/me",
    });
  }, [router, setMode]);

  // Личный режим + URL кабинета `/business/*` (кроме онбординга и т.д.) — синхронизируем режим,
  // иначе навигация по сайдбару (например /business/events) уводила на /me.
  useEffect(() => {
    if (!hydrated) return;
    if (mode !== "personal") return;
    if (!shouldRedirectPersonalModeAwayFromBusiness(pathname)) return;
    queueMicrotask(() => setMode("business"));
  }, [hydrated, mode, pathname, setMode]);

  const value = useMemo(
    () => ({
      mode,
      appMode: (mode === "business" ? "BUSINESS" : "USER") as AppMode,
      setMode,
      goToBusinessAccount,
      goToPersonalAccount,
      hydrated,
    }),
    [mode, setMode, goToBusinessAccount, goToPersonalAccount, hydrated],
  );

  return (
    <AccountModeContext.Provider value={value}>
      {children}
    </AccountModeContext.Provider>
  );
}

export function useAccountMode(): AccountModeContextValue {
  const ctx = useContext(AccountModeContext);
  if (!ctx) {
    throw new Error("useAccountMode must be used within AccountModeProvider");
  }
  return ctx;
}

export function useAppMode() {
  const { mode, appMode, setMode, hydrated } = useAccountMode();
  return {
    mode: appMode,
    rawMode: mode,
    hydrated,
    setMode: (next: AppMode) =>
      setMode(next === "BUSINESS" ? "business" : "personal"),
  };
}
