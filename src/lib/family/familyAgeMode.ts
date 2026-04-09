/**
 * Модель «Для кого» / «Возраст детей»:
 * - Personas primary (`selectedPersonaIds` в FamilyPersonaContext).
 * - Возраст в discovery — fallback, пока не выбраны персоны; иначе только derived от персон.
 *
 * `ageMode`:
 * - free — «Свободный поиск»: никого не выбрано; возраст можно выбрать вручную.
 * - derived — выбраны персоны (взрослый и/или дети): возраст производный, чипы неактивны.
 * - manual — нет детей в профиле: возраст задаётся вручную.
 */
export type FamilyAgeMode = "derived" | "manual" | "free";

export function hasSelectedChildren(
  selectedPersonaIds: string[],
  profileChildIds: string[],
): boolean {
  if (profileChildIds.length === 0) return false;
  const set = new Set(profileChildIds);
  return selectedPersonaIds.some((id) => set.has(id));
}

export function resolveFamilyAgeMode(params: {
  /** В профиле есть дети (показываем блок «Для кого») */
  hasProfileChildren: boolean;
  selectedPersonaIds: string[];
  profileChildIds: string[];
}): FamilyAgeMode {
  const { hasProfileChildren, selectedPersonaIds, profileChildIds } = params;
  
  // Если нет детей в профиле — всегда manual (возраст вручную)
  if (!hasProfileChildren || profileChildIds.length === 0) return "manual";
  
  // Если никто не выбран — режим "Свободный поиск" (free)
  if (selectedPersonaIds.length === 0) {
    return "free";
  }
  
  // Если выбраны любые персоны (взрослый и/или дети) — derived (возраст неактивен)
  return "derived";
}
