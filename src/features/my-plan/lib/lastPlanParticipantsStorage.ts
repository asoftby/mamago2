const STORAGE_KEY = "mamago:myPlan:lastParticipants";

/**
 * Отдельный от FamilyPersonaContext ключ: пишется только явным пользовательским
 * действием (правка состава после выдачи, M3), поэтому «last-used» здесь означает
 * реальное намерение, а не автоматически вычисленный дефолт шапки поиска.
 */
export function readLastPlanParticipants(): string[] | null {
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

export function writeLastPlanParticipants(participantIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(participantIds));
  } catch {
    /* ignore */
  }
}
