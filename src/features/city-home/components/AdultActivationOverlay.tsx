"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FAMILY_ROLES = [
  { value: "MOM", label: "Мама" },
  { value: "DAD", label: "Папа" },
  { value: "GRANDMA", label: "Бабушка" },
  { value: "GRANDPA", label: "Дедушка" },
  { value: "ADULT", label: "Другой" },
];

const AGE_BANDS = [
  { value: "20-29", label: "20–29" },
  { value: "30-39", label: "30–39" },
  { value: "40-49", label: "40–49" },
  { value: "50+", label: "50+" },
];

type Signal = { id: string; slug: string; title: string; order: number };

function useAdultSignals() {
  const [preferenceSignals, setPreferenceSignals] = useState<Signal[]>([]);
  const [formatSignals, setFormatSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/signals/adult-persona")
      .then((r) => r.json())
      .then((d) => {
        setPreferenceSignals(d.preferenceSignals ?? []);
        setFormatSignals(d.formatSignals ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { preferenceSignals, formatSignals, loading };
}

function AdultActivationForm({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { preferenceSignals, formatSignals, loading: signalsLoading } = useAdultSignals();
  const [familyRole, setFamilyRole] = useState(() => "");
  const [ageBand, setAgeBand] = useState(() => "");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>(() => []);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(() => null);
  const [saving, setSaving] = useState(false);

  const togglePref = useCallback((id: string) => {
    setSelectedPrefs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          familyRole: familyRole || null,
          ageBandLabel: ageBand || null,
          preferenceSignalIds: selectedPrefs,
          leisureFormatSignalId: selectedFormat || null,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      toast.success("Теперь учитываем ваши предпочтения 🎯");
      await onSuccess();
      onClose();
      router.refresh();
    } catch {
      toast.error("Не удалось сохранить. Попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!(familyRole || ageBand || selectedPrefs.length > 0 || selectedFormat);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Роль */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Кто вы в семье?</p>
          <div className="flex flex-wrap gap-2">
            {FAMILY_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setFamilyRole(r.value === familyRole ? "" : r.value)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all",
                  familyRole === r.value
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Возраст */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Ваш возраст</p>
          <div className="flex flex-wrap gap-2">
            {AGE_BANDS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAgeBand(a.value === ageBand ? "" : a.value)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all",
                  ageBand === a.value
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Интересы */}
        {!signalsLoading && preferenceSignals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">Что вам интересно?</p>
            <div className="flex flex-wrap gap-2">
              {preferenceSignals.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => togglePref(s.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-all",
                    selectedPrefs.includes(s.id)
                      ? "bg-[#EF8759] text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                  )}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Формат досуга */}
        {!signalsLoading && formatSignals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700">Формат отдыха</p>
            <div className="flex flex-wrap gap-2">
              {formatSignals.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedFormat(s.id === selectedFormat ? null : s.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-all",
                    selectedFormat === s.id
                      ? "bg-[#EF8759] text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                  )}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose} disabled={saving}>
            Пропустить
          </Button>
          <Button
            className="flex-1 rounded-2xl bg-[#EF8759] text-white hover:bg-[#e07848]"
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function useClientMounted() {
  const [mounted, setMounted] = useState(() => {
    if (typeof window === "undefined") return false;
    return true;
  });
  return mounted;
}

export function AdultActivationOverlay({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void | Promise<void>;
}) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const mounted = useClientMounted();
  const handleClose = () => onOpenChange(false);

  if (!mounted) return null;

  const form = <AdultActivationForm open={open} onClose={handleClose} onSuccess={onSuccess} />;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="flex max-h-[min(92vh,600px)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="shrink-0 border-b border-neutral-100 px-5 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-neutral-900">
              Расскажите о себе
            </DialogTitle>
            <p className="text-sm text-neutral-500 pt-0.5">
              Сделаем рекомендации точнее
            </p>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[100dvh] min-h-[80dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-neutral-100 bg-white p-0 pb-safe"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <SheetTitle className="sr-only">Расскажите о себе</SheetTitle>
        <div className="flex shrink-0 flex-col border-b border-neutral-100 px-5 pb-4 pt-1">
          <h2 className="text-lg font-semibold text-neutral-900">Расскажите о себе</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Сделаем рекомендации точнее</p>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{form}</div>
      </SheetContent>
    </Sheet>
  );
}
