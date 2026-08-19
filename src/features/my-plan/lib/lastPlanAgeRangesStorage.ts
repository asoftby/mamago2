const STORAGE_KEY = "mamago:myPlan:lastAgeRanges";

/**
 * Ответ на вопрос needs-age (возраст детей, когда в профиле нет ни одной персоны-ребёнка).
 * Отдельный ключ от lastPlanParticipantsStorage — это два разных типа «последнего состава»,
 * применимых в разных ветках резолвера (см. resolveDefaultParticipants).
 */
export function readLastPlanAgeRanges(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}

export function writeLastPlanAgeRanges(ageRanges: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ageRanges));
  } catch {
    /* ignore */
  }
}
