"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Intent } from "@/lib/intent";

type PublicationIntentContextValue = {
  intent: Intent | null;
  setPublicationIntent: (intent: Intent | null) => void;
};

const PublicationIntentContext =
  createContext<PublicationIntentContextValue | null>(null);

export function PublicationIntentProvider({ children }: { children: ReactNode }) {
  const [intent, setPublicationIntent] = useState<Intent | null>(null);
  const value = useMemo(
    () => ({ intent, setPublicationIntent }),
    [intent],
  );
  return (
    <PublicationIntentContext.Provider value={value}>
      {children}
    </PublicationIntentContext.Provider>
  );
}

export function usePublicationIntent(): Intent | null {
  return useContext(PublicationIntentContext)?.intent ?? null;
}

export function useSetPublicationIntent() {
  const ctx = useContext(PublicationIntentContext);
  return useCallback(
    (intent: Intent | null) => {
      ctx?.setPublicationIntent(intent);
    },
    [ctx],
  );
}
