"use client";

import { createContext, useContext } from "react";

type BrandingContextValue = {
  logoUrl: string | null;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({
  logoUrl,
  children,
}: {
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <BrandingContext.Provider value={{ logoUrl }}>
      {children}
    </BrandingContext.Provider>
  );
}

/** Fallback `{ logoUrl: null }` вне `BrandingProvider` — вызывающая сторона сама решает дефолт логотипа. */
export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext) ?? { logoUrl: null };
}
