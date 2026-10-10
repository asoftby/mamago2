"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Intent } from "@/lib/intent";

type PublicationIntentContextValue = {
  intent: Intent | null;
  setPublicationIntent: (intent: Intent | null) => void;
  /** Id публикации, для которой мобильный хедер показывает «♡» (локальное избранное). */
  favoriteTargetId: string | null;
  setFavoriteTargetId: (id: string | null) => void;
};

const PublicationIntentContext =
  createContext<PublicationIntentContextValue | null>(null);

export function PublicationIntentProvider({ children }: { children: ReactNode }) {
  const [intent, setPublicationIntent] = useState<Intent | null>(null);
  const [favoriteTargetId, setFavoriteTargetId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ intent, setPublicationIntent, favoriteTargetId, setFavoriteTargetId }),
    [intent, favoriteTargetId],
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

export function useHeaderFavoriteTargetId(): string | null {
  return useContext(PublicationIntentContext)?.favoriteTargetId ?? null;
}

/** Страница публикации регистрирует свой id, чтобы хедер показал «♡». На unmount — сбрасывает. */
export function useRegisterHeaderFavoriteTarget(id: string | null) {
  const ctx = useContext(PublicationIntentContext);
  const setFavoriteTargetId = ctx?.setFavoriteTargetId;
  useEffect(() => {
    if (!setFavoriteTargetId || !id) return;
    setFavoriteTargetId(id);
    return () => setFavoriteTargetId(null);
  }, [id, setFavoriteTargetId]);
}
