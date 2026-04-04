/**
 * Модель «Для кого» / «Возраст детей»:
 * - Personas primary (`selectedPersonaIds` в FamilyPersonaContext).
 * - Возраст в discovery — fallback, пока не выбраны дети-персоны; иначе только derived от детей.
 *
 * `ageMode`:
 * - free — «Для всех»: никого не выбрано при наличии детей в профиле; при переключении на таб сбрасывается возраст, затем можно выбрать вручную.
 * - derived — выбраны дети-персоны: возраст производный от их дат рождения.
 * - manual — выбран только взрослый (или нет детей в профиле): возраст задаётся вручную / 18+ по правилам синка.
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
  if (
    hasProfileChildren &&
    profileChildIds.length > 0 &&
    selectedPersonaIds.length === 0
  ) {
    return "free";
  }
  if (!hasProfileChildren || profileChildIds.length === 0) return "manual";
  return hasSelectedChildren(selectedPersonaIds, profileChildIds)
    ? "derived"
    : "manual";
}
