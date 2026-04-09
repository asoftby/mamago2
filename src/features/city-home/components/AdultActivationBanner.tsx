"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { AdultActivationOverlay } from "./AdultActivationOverlay";

// Cooldown: не показывать снова 3 сессии (localStorage-счётчик)
const LS_DISMISS_KEY = "mamago:adultBannerDismissCount";
const MAX_DISMISS = 3;

function getDismissCount(): number {
  if (typeof window === "undefined") return 0;
  try { return parseInt(localStorage.getItem(LS_DISMISS_KEY) ?? "0", 10) || 0; }
  catch { return 0; }
}

const dismissListeners = new Set<() => void>();
function subscribeDismiss(cb: () => void) {
  dismissListeners.add(cb);
  return () => { dismissListeners.delete(cb); };
}
function getDismissSnapshot() { return getDismissCount(); }

export function AdultActivationBanner() {
  const family = useFamilyPersona();
  const dismissCount = useSyncExternalStore(subscribeDismiss, getDismissSnapshot, () => 0);
  const [open, setOpen] = useState(false);

  const loading = family?.loading ?? true;
  const menuUser = family?.menuUser ?? null;
  const hasChildren = (family?.childPersonasForFilter.length ?? 0) > 0;
  const isAdultComplete = !!(
    menuUser?.familyRole ||
    (menuUser?.preferenceSignalIds?.length ?? 0) > 0
  );

  const shouldShow =
    !loading &&
    !!menuUser &&
    hasChildren &&
    !isAdultComplete &&
    dismissCount < MAX_DISMISS;

  const handleDismiss = useCallback(() => {
    try {
      const next = getDismissCount() + 1;
      localStorage.setItem(LS_DISMISS_KEY, String(next));
    } catch { /* ignore */ }
    dismissListeners.forEach((fn) => fn());
  }, []);

  const handleSuccess = useCallback(async () => {
    await family?.refresh();
  }, [family]);

  if (!shouldShow) return null;

  return (
    <>
      <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 pr-11 sm:px-5 sm:py-4">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
          aria-label="Скрыть"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-2.5 pr-1">
          <p className="text-sm font-semibold text-neutral-900">
            Сделаем рекомендации ещё точнее
          </p>
          <p className="text-xs leading-relaxed text-neutral-500">
            Добавьте информацию о себе — учтём формат отдыха и интересы
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            onClick={() => setOpen(true)}
          >
            Настроить
          </Button>
        </div>
      </div>

      <AdultActivationOverlay
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
