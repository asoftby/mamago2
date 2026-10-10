"use client";

import { cn } from "@/lib/utils";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import {
  MAX_ACTIVE_FAMILY_PERSONAS,
  FAMILY_SELECTION_LIMIT_MESSAGE,
} from "@/lib/family/wholeFamilyPreset";
import { toast } from "@/lib/toast";
import { PLAN_CHIP, PLAN_CHIP_DISABLED, PLAN_CHIP_OFF, PLAN_CHIP_ON } from "./v3/planChipStyles";

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
        <h3 className="mp-font-ui text-[16px] font-bold leading-6 text-[var(--mp-tx)]">
          Для кого
        </h3>
        <p className="mp-font-ui mt-0.5 text-[13px] leading-5 text-[var(--mp-tx2)]">
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
              className={cn(PLAN_CHIP, selected ? PLAN_CHIP_ON : PLAN_CHIP_OFF, PLAN_CHIP_DISABLED)}
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
          className={cn(PLAN_CHIP, selectedIds.length === 0 ? PLAN_CHIP_ON : PLAN_CHIP_OFF, PLAN_CHIP_DISABLED)}
        >
          Свободный поиск
        </button>
      </div>
    </section>
  );
}
