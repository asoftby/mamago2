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
import {
  buildBusinessPath,
  buildPublicPath,
  BUSINESS_PATH_PREFIX,
} from "@/lib/routing/surface";

export type AccountMode = "personal" | "business";

const STORAGE_KEY = "mamago.accountMode";

type AccountModeContextValue = {
  mode: AccountMode;
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
  const [mode, setModeState] = useState<AccountMode>("personal");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    let next: AccountMode = "personal";
    if (raw === "business" || raw === "personal") {
      next = raw;
    } else {
      const path =
        typeof window !== "undefined" ? window.location.pathname : "";
      if (
        path.startsWith(BUSINESS_PATH_PREFIX) &&
        shouldRedirectPersonalModeAwayFromBusiness(path)
      ) {
        next = "business";
      }
      localStorage.setItem(STORAGE_KEY, next);
    }
    setModeState(next);
    setHydrated(true);
  }, []);

  const setMode = useCallback((next: AccountMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const goToBusinessAccount = useCallback(
    (isBusinessPartner: boolean) => {
      setMode("business");
      router.push(
        isBusinessPartner
          ? buildBusinessPath("/dashboard")
          : buildBusinessPath("/onboarding"),
      );
    },
    [router, setMode],
  );

  const goToPersonalAccount = useCallback(() => {
    setMode("personal");
    router.push(buildPublicPath("/me"));
  }, [router, setMode]);

  useEffect(() => {
    if (!hydrated) return;
    if (mode !== "personal") return;
    if (!shouldRedirectPersonalModeAwayFromBusiness(pathname)) return;
    router.replace(buildPublicPath("/me"));
  }, [hydrated, mode, pathname, router]);

  const value = useMemo(
    () => ({
      mode,
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
