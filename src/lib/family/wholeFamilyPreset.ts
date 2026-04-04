import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";

/** Максимум активных участников в контексте «Для кого» */
export const MAX_ACTIVE_FAMILY_PERSONAS = 3;

export const FAMILY_SELECTION_LIMIT_MESSAGE =
  "Можно выбрать до 3 человек, чтобы рекомендации оставались точными";

/** Две «младших» по дате рождения (самые поздние даты рождения = младшие дети). */
export function pickYoungestChildIds(
  children: Array<{ id: string; birthDate?: string | null }>,
  take: number,
): string[] {
  if (take <= 0 || children.length === 0) return [];
  const withDates = children.map((c) => ({
    id: c.id,
    t: c.birthDate ? new Date(c.birthDate).getTime() : NaN,
  }));
  withDates.sort((a, b) => {
    if (Number.isNaN(a.t) && Number.isNaN(b.t)) return 0;
    if (Number.isNaN(a.t)) return 1;
    if (Number.isNaN(b.t)) return -1;
    return b.t - a.t;
  });
  return withDates.slice(0, take).map((x) => x.id);
}

/**
 * Пресет «Всей семьи»: при ≤3 участниках — все; иначе primary adult + до 2 младших детей.
 */
export function computeWholeFamilyPresetIds(
  personas: FamilyPersona[],
  primaryAdultPersonaId: string | null,
): string[] {
  if (!primaryAdultPersonaId || personas.length === 0) return [];

  if (personas.length <= MAX_ACTIVE_FAMILY_PERSONAS) {
    return personas.map((p) => p.id);
  }

  const childPersonas = personas.filter((p) => p.kind === "child");
  const youngestTwo = pickYoungestChildIds(
    childPersonas.map((c) => ({ id: c.id, birthDate: c.birthDate })),
    2,
  );
  return [primaryAdultPersonaId, ...youngestTwo];
}

export function selectionSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join("\0");
  const sb = [...b].sort().join("\0");
  return sa === sb;
}
