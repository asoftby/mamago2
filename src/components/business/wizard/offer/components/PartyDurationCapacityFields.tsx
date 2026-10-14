"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { OfferFormData } from "../types";

export const PARTY_DURATION_PRESETS = [60, 90, 120, 180, 240] as const;

type BirthdayDetails = OfferFormData["birthdayDetails"];

interface PartyDurationCapacityFieldsProps {
  details: BirthdayDetails;
  onChange: (patch: Partial<BirthdayDetails>) => void;
  isEditable: boolean;
  idPrefix: string;
}

function parseOptionalPositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Shared for individual services and ready-made birthday packages. */
export function PartyDurationCapacityFields({
  details,
  onChange,
  isEditable,
  idPrefix,
}: PartyDurationCapacityFieldsProps) {
  const [customDuration, setCustomDuration] = useState(false);
  const isPreset = PARTY_DURATION_PRESETS.some((duration) => duration === details.durationMinutes);
  const isCustom = customDuration || (details.durationMinutes !== null && !isPreset);
  const childrenRangeInvalid =
    details.minChildren !== null &&
    details.maxChildren !== null &&
    details.minChildren > details.maxChildren;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p id={`${idPrefix}-duration-label`} className="text-sm font-medium text-foreground">
          Продолжительность
        </p>
        <div
          role="group"
          aria-labelledby={`${idPrefix}-duration-label`}
          className="flex flex-wrap gap-2"
        >
          {PARTY_DURATION_PRESETS.map((duration) => {
            const selected = !isCustom && details.durationMinutes === duration;
            return (
              <button
                type="button"
                key={duration}
                aria-pressed={selected}
                disabled={!isEditable}
                onClick={() => {
                  setCustomDuration(false);
                  onChange({ durationMinutes: duration });
                }}
                className={cn(
                  "min-h-10 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-white text-foreground hover:border-primary/70",
                )}
              >
                {duration} мин
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={isCustom}
            disabled={!isEditable}
            onClick={() => {
              setCustomDuration(true);
              if (isPreset) onChange({ durationMinutes: null });
            }}
            className={cn(
              "min-h-10 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-60",
              isCustom
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-white text-foreground hover:border-primary/70",
            )}
          >
            Своя
          </button>
        </div>
        {isCustom && (
          <div className="max-w-56 space-y-2">
            <Label htmlFor={`${idPrefix}-custom-duration`}>Сколько минут?</Label>
            <Input
              id={`${idPrefix}-custom-duration`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="Например, 150"
              value={details.durationMinutes ?? ""}
              onChange={(event) =>
                onChange({ durationMinutes: parseOptionalPositiveInteger(event.target.value) })
              }
              disabled={!isEditable}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Длительность одной программы, не время начала.
        </p>
      </div>

      <div className="space-y-2">
        <p id={`${idPrefix}-children-label`} className="text-sm font-medium text-foreground">
          Количество детей
        </p>
        <div
          role="group"
          aria-labelledby={`${idPrefix}-children-label`}
          className="grid grid-cols-2 gap-3"
        >
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${idPrefix}-min-children`} className="text-xs text-muted-foreground">
              От
            </Label>
            <Input
              id={`${idPrefix}-min-children`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="Минимум"
              value={details.minChildren ?? ""}
              onChange={(event) =>
                onChange({ minChildren: parseOptionalPositiveInteger(event.target.value) })
              }
              aria-invalid={childrenRangeInvalid}
              disabled={!isEditable}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${idPrefix}-max-children`} className="text-xs text-muted-foreground">
              До
            </Label>
            <Input
              id={`${idPrefix}-max-children`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="Максимум"
              value={details.maxChildren ?? ""}
              onChange={(event) =>
                onChange({ maxChildren: parseOptionalPositiveInteger(event.target.value) })
              }
              aria-invalid={childrenRangeInvalid}
              disabled={!isEditable}
            />
          </div>
        </div>
        {childrenRangeInvalid && (
          <p role="alert" className="text-sm text-destructive">
            Минимальное количество не должно превышать максимальное.
          </p>
        )}
      </div>
    </div>
  );
}
