"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Intent } from "@/lib/intent";

type PublicationIntentContextValue = {
  intent: Intent | null;
  setPublicationIntent: (intent: Intent | null) => void;
  /** Действие «сохранить» страницы публикации: мобильный хедер показывает вместо 🔔/👤 «поделиться» и «сохранить». */
  saveAction: HeaderSaveAction | null;
  setSaveAction: (action: HeaderSaveAction | null) => void;
};

export type HeaderSaveAction = { saved: boolean; onSave: () => void; shareTitle: string };

const PublicationIntentContext =
  createContext<PublicationIntentContextValue | null>(null);

export function PublicationIntentProvider({ children }: { children: ReactNode }) {
  const [intent, setPublicationIntent] = useState<Intent | null>(null);
  const [saveAction, setSaveAction] = useState<HeaderSaveAction | null>(null);
  const value = useMemo(
    () => ({ intent, setPublicationIntent, saveAction, setSaveAction }),
    [intent, saveAction],
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

export function useHeaderSaveAction(): HeaderSaveAction | null {
  return useContext(PublicationIntentContext)?.saveAction ?? null;
}

/** Страница публикации регистрирует «сохранить» для мобильного хедера; на unmount сбрасывает. */
export function useRegisterHeaderSaveAction(saved: boolean, onSave: () => void, shareTitle: string) {
  const setSaveAction = useContext(PublicationIntentContext)?.setSaveAction;
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });
  useEffect(() => {
    if (!setSaveAction) return;
    setSaveAction({ saved, shareTitle, onSave: () => onSaveRef.current() });
    return () => setSaveAction(null);
  }, [saved, shareTitle, setSaveAction]);
}
