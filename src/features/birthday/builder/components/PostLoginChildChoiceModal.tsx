"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProfileChildPayload } from "../hooks/useBirthdayBuilder";
import { ageYearsFromBirthDate, formatYearsRu } from "../lib/partyChildUtils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childrenList: ProfileChildPayload[];
  /** Текущий возраст в сценарии (чип / подпись) */
  currentAgeLabel: string | null;
  onChooseChild: (child: ProfileChildPayload) => void;
  onKeepManual: () => void;
};

export function PostLoginChildChoiceModal({
  open,
  onOpenChange,
  childrenList,
  currentAgeLabel,
  onChooseChild,
  onKeepManual,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (childrenList.length === 1) {
      return childrenList[0].id;
    }
    return childrenList[0]?.id ?? null;
  });
  const single = childrenList.length === 1;
  const first = childrenList[0];

  const handleUseChild = () => {
    if (single && first) {
      onChooseChild(first);
      return;
    }
    const c = childrenList.find((x) => x.id === selectedId);
    if (c) onChooseChild(c);
  };

  const handleKeepManual = () => {
    onKeepManual();
  };

  if (!open || childrenList.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/60 bg-white" showCloseButton>
        {single && first ? (
          <>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-lg font-semibold leading-snug text-foreground">
                Собираем праздник для {first.name},{" "}
                {formatYearsRu(ageYearsFromBirthDate(first.birthDate.slice(0, 10)))}?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                В профиле есть этот ребёнок — можно подставить возраст и интересы для сценария.
                {currentAgeLabel ? (
                  <>
                    {" "}
                    Сейчас в сценарии: {currentAgeLabel}.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="order-2 sm:order-1"
                onClick={handleKeepManual}
              >
                Оставить текущие параметры
              </Button>
              <Button
                type="button"
                className="order-1 sm:order-2 bg-[#EF8759] hover:bg-[#e07848]"
                onClick={handleUseChild}
              >
                Использовать данные ребёнка
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-lg font-semibold leading-snug text-foreground">
                Для кого собираем праздник?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    В вашем профиле есть дети. Можно использовать их возраст и интересы,
                    чтобы уточнить сценарий праздника.
                  </p>
                  {currentAgeLabel ? (
                    <p className="text-foreground/85">
                      Сейчас сценарий собран с параметрами:{" "}
                      <span className="font-medium">{currentAgeLabel}</span>. Можно обновить
                      его под данные ребёнка из профиля.
                    </p>
                  ) : null}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2" role="radiogroup" aria-label="Выбор ребёнка">
              {childrenList.map((c) => {
                const years = ageYearsFromBirthDate(c.birthDate.slice(0, 10));
                const label = `${c.name} — ${formatYearsRu(years)}`;
                const on = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                      on
                        ? "border-[#EF8759]/70 bg-orange-50/50 ring-1 ring-[#EF8759]/25"
                        : "border-border/70 bg-white hover:border-[#EF8759]/35",
                    )}
                  >
                    <span className="font-medium text-foreground">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between sm:items-center">
              <button
                type="button"
                onClick={handleKeepManual}
                className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline text-left"
              >
                Оставить текущие параметры
              </button>
              <Button
                type="button"
                disabled={!selectedId}
                className="bg-[#EF8759] hover:bg-[#e07848] sm:min-w-[140px]"
                onClick={handleUseChild}
              >
                Использовать
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
