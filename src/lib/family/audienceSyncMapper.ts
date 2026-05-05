/**
 * Маппер для синхронизации между:
 * - My Plan: selectedPersonaIds (персональные участники)
 * - Header: age filters (возрастные группы)
 *
 * Правила приоритета:
 * 1. Если selectedPersonaIds пусто → age должен быть пусто (свободный поиск)
 * 2. Если selectedPersonaIds содержит взрослого → добавить "18+"
 * 3. Если selectedPersonaIds содержит детей → добавить соответствующие возрастные группы
 */

import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

/** Возраст в годах */
function getAgeYears(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Найти возрастную группу по возрасту в годах
 * Например: 2 года → "1-3", 5 лет → "3-5", 18 лет → "18+"
 */
function findAgeGroupByYears(ageYears: number): string | null {
  // Ищем группу, в которую попадает этот возраст
  for (const group of AGE_GROUPS) {
    // Парсим диапазон из label: "0–1 год", "1–3 года", "18+"
    const label = group.label;

    if (label === "18+") {
      if (ageYears >= 18) return group.value;
    } else {
      // Парсим "X–Y" формат
      const match = label.match(/(\d+)–(\d+)/);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);
        if (ageYears >= min && ageYears <= max) {
          return group.value;
        }
      }
    }
  }

  return null;
}

/**
 * Преобразовать выбранные персоны в возрастные группы для Header
 *
 * Правила:
 * - Если selectedPersonaIds пусто → вернуть []
 * - Если есть взрослый → добавить "18+"
 * - Если есть дети → добавить их возрастные группы
 */
export function mapPlanParticipantsToAudience(
  selectedPersonaIds: string[],
  personas: FamilyPersona[]
): string[] {
  if (selectedPersonaIds.length === 0) {
    return [];
  }

  const ageGroups = new Set<string>();

  for (const personaId of selectedPersonaIds) {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) continue;

    if (persona.kind === "adult") {
      // Взрослый → ключ как в URL / discovery (`AGE_GROUPS[].value`)
      ageGroups.add("18+");
    } else if (persona.kind === "child") {
      // Ребёнок → его возрастная группа
      const ageYears = getAgeYears(persona.birthDate);
      if (ageYears !== null) {
        const groupValue = findAgeGroupByYears(ageYears);
        if (groupValue) {
          ageGroups.add(groupValue);
        }
      }
    }
  }

  return Array.from(ageGroups);
}

/**
 * Определить режим My Plan на основе выбранных возрастных групп в Header
 *
 * Возвращает:
 * - "free" если audience пусто (свободный поиск)
 * - "age_filter" если audience не пусто (выбраны возрастные группы)
 */
export function mapAudienceToMode(
  audience: string[]
): "free" | "age_filter" {
  return audience.length === 0 ? "free" : "age_filter";
}

/**
 * Проверить, соответствует ли текущий выбор персон выбранным возрастным группам
 *
 * Используется для определения, нужно ли синхронизировать Header при изменении My Plan
 */
export function isPersonaSelectionMatchingAudience(
  selectedPersonaIds: string[],
  personas: FamilyPersona[],
  audience: string[]
): boolean {
  const derivedAudience = mapPlanParticipantsToAudience(
    selectedPersonaIds,
    personas
  );

  // Сравниваем как множества
  if (derivedAudience.length !== audience.length) {
    return false;
  }

  const derivedSet = new Set(derivedAudience);
  for (const ageGroup of audience) {
    if (!derivedSet.has(ageGroup)) {
      return false;
    }
  }

  return true;
}
