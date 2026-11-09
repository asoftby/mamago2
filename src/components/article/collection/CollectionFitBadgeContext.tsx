"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Local presentation-only label. Selection and ranking remain in CollectionPersonalList. */
const CollectionFitBadgeContext = createContext<string | null>(null);

export function CollectionFitBadgeProvider({ label, children }: { label: string | null; children: ReactNode }) {
  return <CollectionFitBadgeContext.Provider value={label}>{children}</CollectionFitBadgeContext.Provider>;
}

export function useCollectionFitBadge() {
  return useContext(CollectionFitBadgeContext);
}
