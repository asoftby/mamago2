/**
 * После регистрации из флоу «Мой план» с созданием ребёнка — id для авто-выбора в FamilyPersona.
 * Читается один раз в FamilyPersonaProvider, затем ключ удаляется из sessionStorage.
 */
export const MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY = "mamago:myPlanRegFocusChildId";

export function setMyPlanRegistrationFocusChildId(childId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(MY_PLAN_REG_FOCUS_CHILD_SESSION_KEY, childId);
  } catch {
    /* ignore */
  }
}
