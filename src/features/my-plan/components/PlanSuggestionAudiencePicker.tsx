"use client";

import { cn } from "@/lib/utils";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import {
  MAX_ACTIVE_FAMILY_PERSONAS,
  FAMILY_SELECTION_LIMIT_MESSAGE,
} from "@/lib/family/wholeFamilyPreset";
import { toast } from "@/lib/toast";

interface PlanSuggestionAudiencePickerProps {
  personas: FamilyPersona[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

/** Explicit, per-plan recommendation audience. Does not change global discovery filters. */
export function PlanSuggestionAudiencePicker({
  personas,
  selectedIds,
  onChange,
  disabled = false,
}: PlanSuggestionAudiencePickerProps) {
  if (personas.length === 0) return null;

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id];
    if (next.length > MAX_ACTIVE_FAMILY_PERSONAS) {
      toast(FAMILY_SELECTION_LIMIT_MESSAGE);
      return;
    }
    onChange(next);
  };

  return (
    <section className="space-y-3 rounded-[20px] border border-[var(--mp-line)] bg-[var(--mp-card)] p-4" aria-label="Для кого подбираем события">
      <div>
        <h3 className="text-[16px] font-bold leading-6 text-[var(--mp-tx)]">
          Для кого ищем?
        </h3>
        <p className="mt-0.5 text-[13px] leading-5 text-[var(--mp-tx2)]">
          Выберите участников. Возраст детей возьмём из профиля.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {personas.map((persona) => {
          const selected = selectedIds.includes(persona.id);
          const label = persona.kind === "adult" ? "Я" : persona.displayName.trim() || "Ребёнок";
          return (
            <button
              key={persona.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(persona.id)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-ac)] disabled:opacity-60",
                selected
                  ? "border-[var(--mp-ac)] bg-[var(--mp-ac-soft)] text-[var(--mp-tx)]"
                  : "border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx2)] hover:border-[var(--mp-ac)]",
              )}
            >
              <span>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={selectedIds.length === 0}
          disabled={disabled}
          onClick={() => onChange([])}
          className={cn(
            "min-h-11 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mp-ac)] disabled:opacity-60",
            selectedIds.length === 0
              ? "border-[var(--mp-ac)] bg-[var(--mp-ac-soft)] text-[var(--mp-tx)]"
              : "border-[var(--mp-line-strong)] bg-white text-[var(--mp-tx2)] hover:border-[var(--mp-ac)]",
          )}
        >
          Свободный поиск
        </button>
      </div>
    </section>
  );
}
