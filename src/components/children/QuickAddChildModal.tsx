"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export interface QuickAddChildModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (childId: string) => void;
}

export function QuickAddChildModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickAddChildModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setBirthMonth("");
      setBirthYear("");
      setError(null);
    }
  }, [open]);

  const canSave = name.trim().length >= 1 && birthMonth !== "" && birthYear !== "";

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
      systemInterests: [],
      customInterests: [],
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
      const childId = data?.child?.id;
      onOpenChange(false);
      onSuccess?.(childId);
      notifyFamilyPersonasChanged();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,520px)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:w-full",
          "max-sm:fixed max-sm:bottom-4 max-sm:left-1/2 max-sm:top-auto max-sm:translate-x-[-50%] max-sm:translate-y-0",
        )}
      >
        <DialogTitle className="sr-only">Добавить ребёнка</DialogTitle>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center border-b border-neutral-100 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-neutral-900">Добавить ребёнка</h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                Будем подбирать события точнее
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quick-child-name">Имя</Label>
                <Input
                  id="quick-child-name"
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
                  <Label htmlFor="quick-birth-month">Месяц рождения</Label>
                  <FilterSelect
                    id="quick-birth-month"
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
                  <Label htmlFor="quick-birth-year">Год рождения</Label>
                  <FilterSelect
                    id="quick-birth-year"
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
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-neutral-100 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="h-11 flex-1"
                disabled={!canSave || isLoading}
              >
                {isLoading ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
