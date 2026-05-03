"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useChildInterests } from "@/hooks/useChildInterests";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FilterSelect,
  type FilterSelectOption,
} from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { notifyFamilyPersonasChanged } from "@/lib/family/familyPersonaEvents";

const MONTHS_RU = [
  { m: 0, label: "Январь" },
  { m: 1, label: "Февраль" },
  { m: 2, label: "Март" },
  { m: 3, label: "Апрель" },
  { m: 4, label: "Май" },
  { m: 5, label: "Июнь" },
  { m: 6, label: "Июль" },
  { m: 7, label: "Август" },
  { m: 8, label: "Сентябрь" },
  { m: 9, label: "Октябрь" },
  { m: 10, label: "Ноябрь" },
  { m: 11, label: "Декабрь" },
];

const BIRTH_MONTH_FILTER_OPTIONS: FilterSelectOption[] = MONTHS_RU.map(
  ({ m, label }) => ({ value: String(m), label }),
);

function birthYearOptions(): number[] {
  const y = new Date().getFullYear();
  return Array.from({ length: 26 }, (_, i) => y - i);
}

function birthYearFilterOptions(): FilterSelectOption[] {
  return birthYearOptions().map((year) => ({
    value: String(year),
    label: String(year),
  }));
}

function toBirthIso(month: number | "", year: number | ""): string | null {
  if (month === "" || year === "") return null;
  const d = new Date(year, month, 15, 12, 0, 0, 0);
  return d.toISOString();
}

export type FamilyActivationAddChildOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
};

function FamilyActivationAddChildForm({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const router = useRouter();
  const { interests: interestOptions, isLoading: interestsLoading } =
    useChildInterests();
  const [name, setName] = useState("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBirthMonth("");
    setBirthYear("");
    setSelectedSlugs([]);
    setError(null);
  }, [open]);

  const toggleSlug = useCallback((slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const canSave =
    name.trim().length >= 1 && birthMonth !== "" && birthYear !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      setError("Укажите имя, месяц и год рождения");
      return;
    }

    setIsLoading(true);
    setError(null);
    const birthIso = toBirthIso(birthMonth, birthYear);
    const body = {
      name: name.trim(),
      birthDate: birthIso,
      systemInterests: selectedSlugs,
      customInterests: [] as string[],
    };

    try {
      const res = await fetch("/api/children", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Не удалось сохранить");
      }
      onClose();
      notifyFamilyPersonasChanged();
      router.refresh();
      await onSuccess();
      toast.success(
        "Готово! Теперь показываем рекомендации для вашей семьи 🎉",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  const activeInterests = interestOptions.filter((o) => o.active);

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fam-act-child-name">Имя ребёнка</Label>
            <Input
              id="fam-act-child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как зовут"
              className="h-11"
              autoComplete="given-name"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="fam-act-birth-month">Месяц</Label>
              <FilterSelect
                id="fam-act-birth-month"
                value={birthMonth === "" ? "" : String(birthMonth)}
                placeholder="Месяц"
                options={BIRTH_MONTH_FILTER_OPTIONS}
                onChange={(v) =>
                  setBirthMonth(v === "" ? "" : Number(v))
                }
                selectClassName="h-11"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="fam-act-birth-year">Год</Label>
              <FilterSelect
                id="fam-act-birth-year"
                value={birthYear === "" ? "" : String(birthYear)}
                placeholder="Год"
                options={birthYearFilterOptions()}
                onChange={(v) =>
                  setBirthYear(v === "" ? "" : Number(v))
                }
                selectClassName="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-neutral-900">
              Интересы{" "}
              <span className="font-normal text-neutral-500">(по желанию)</span>
            </span>
            {interestsLoading ? (
              <p className="text-sm text-neutral-500">Загрузка…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeInterests.map((it) => {
                  const on = selectedSlugs.includes(it.value);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => toggleSlug(it.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-[#EF8759] bg-[#EF8759]/10 text-neutral-900"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                      )}
                    >
                      {it.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="submit"
          className="h-11 w-full bg-[#EF8759] text-white hover:bg-[#e07848]"
          disabled={!canSave || isLoading}
        >
          {isLoading ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function FamilyActivationAddChildOverlay({
  open,
  onOpenChange,
  onSuccess,
}: FamilyActivationAddChildOverlayProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const mounted = useClientMounted();

  const handleClose = () => onOpenChange(false);

  if (!mounted) return null;

  const form = (
    <FamilyActivationAddChildForm
      open={open}
      onClose={handleClose}
      onSuccess={onSuccess}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className={cn(
            "flex max-h-[min(92vh,560px)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-neutral-100 px-5 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-neutral-900">
              Добавить ребёнка
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-500 pt-0.5">
              Будем подбирать события точнее
            </DialogDescription>
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
        className="flex max-h-[100dvh] min-h-[100dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-neutral-100 bg-white p-0 pb-safe"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <SheetTitle className="sr-only">Добавить ребёнка</SheetTitle>
        <div className="flex shrink-0 flex-col border-b border-neutral-100 px-5 pb-4 pt-1">
          <h2 className="text-lg font-semibold text-neutral-900">
            Добавить ребёнка
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Будем подбирать события точнее
          </p>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{form}</div>
      </SheetContent>
    </Sheet>
  );
}
