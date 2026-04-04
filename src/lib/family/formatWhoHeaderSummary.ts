import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

export function formatAgeLabels(fallbackAgeValues: string[]): string {
  const ageLabels = fallbackAgeValues.map((ageValue) => {
    const group = AGE_GROUPS.find((g) => g.value === ageValue);
    return group ? group.label : ageValue;
  });
  if (ageLabels.length === 1) return ageLabels[0];
  if (ageLabels.length === 2) return `${ageLabels[0]}, ${ageLabels[1]}`;
  return `${ageLabels[0]} +${ageLabels.length - 1}`;
}

function formatPersonaNames(names: string[]): string {
  if (names.length === 0) return "Выберите возраст";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} и ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} и ${names[2]}`;
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2}`;
}

/**
 * Строка «Для кого?» в хедере (именительный падеж).
 * Без детей-персон: приоритет у выбранного возраста; иначе — имена (например только взрослый).
 */
export function formatWhoHeaderSummary(params: {
  /** Выбрана хотя бы одна child persona */
  hasSelectedChildren: boolean;
  selectedPersonaIds: string[];
  personas: FamilyPersona[];
  /** Значения age из discovery (URL), в manual-режиме — самостоятельный фильтр */
  fallbackAgeValues: string[];
}): string {
  const {
    hasSelectedChildren,
    selectedPersonaIds,
    personas,
    fallbackAgeValues,
  } = params;

  if (selectedPersonaIds.length === 0 && personas.length > 0) {
    return "Для всех";
  }

  const byId = new Map(personas.map((p) => [p.id, p] as const));
  const names = selectedPersonaIds
    .map((id) => byId.get(id))
    .filter((p): p is FamilyPersona => !!p)
    .map((p) => p.displayName.trim() || "…")
    .filter(Boolean);

  if (hasSelectedChildren) {
    return formatPersonaNames(names);
  }

  if (fallbackAgeValues.length > 0) {
    return formatAgeLabels(fallbackAgeValues);
  }

  return formatPersonaNames(names);
}
