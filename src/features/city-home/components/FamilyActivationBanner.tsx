"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FamilyActivationAddChildOverlay } from "./FamilyActivationAddChildOverlay";

const SESSION_DISMISS_KEY = "mamago:session:familyActivationDismissed";

const dismissListeners = new Set<() => void>();

function subscribeSessionDismiss(onStoreChange: () => void) {
  dismissListeners.add(onStoreChange);
  return () => {
    dismissListeners.delete(onStoreChange);
  };
}

function getSessionDismissedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function notifySessionDismissChanged() {
  dismissListeners.forEach((fn) => {
    fn();
  });
}

export function FamilyActivationBanner() {
  /** Без Required: при SSR / границе RSC контекст может быть ещё null — не бросаем. */
  const family = useFamilyPersona();
  const sessionDismissed = useSyncExternalStore(
    subscribeSessionDismiss,
    getSessionDismissedSnapshot,
    () => false,
  );
  const [addOpen, setAddOpen] = useState(false);

  const loading = family?.loading ?? true;
  const menuUser = family?.menuUser ?? null;
  const childPersonasForFilter = family?.childPersonasForFilter ?? [];

  const preferenceCount = menuUser?.preferenceSignalIds?.length ?? 0;

  const shouldShow = useMemo(() => {
    if (!family) return false;
    if (loading || !menuUser) return false;
    if (childPersonasForFilter.length > 0) return false;
    if (sessionDismissed) return false;
    return true;
  }, [
    family,
    loading,
    menuUser,
    childPersonasForFilter.length,
    sessionDismissed,
  ]);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    notifySessionDismissChanged();
  }, []);

  const handleAddSuccess = useCallback(async () => {
    await family?.refresh();
  }, [family]);

  if (!shouldShow) return null;

  return (
    <>
      <div
        className={cn(
          "relative rounded-2xl border border-neutral-100 bg-white p-4 pr-11 shadow-md sm:p-5 sm:pr-12",
        )}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Скрыть на сессию"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-3 pr-1">
          <h2 className="text-base leading-snug text-neutral-900 sm:text-lg" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
            Подберём идеи для вашей семьи
          </h2>
          <p className="text-sm leading-relaxed text-neutral-600">
            Добавьте ребёнка и интересы — получите персональные рекомендации и
            готовые планы
          </p>
          <Button
            type="button"
            className="h-11 w-full bg-[#EF8759] text-white hover:bg-[#e07848] sm:w-auto sm:min-w-[200px]"
            onClick={() => setAddOpen(true)}
          >
            Добавить ребёнка
          </Button>
        </div>
      </div>

      <FamilyActivationAddChildOverlay
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleAddSuccess}
      />
    </>
  );
}
