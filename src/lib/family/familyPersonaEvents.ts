export const FAMILY_PERSONAS_CHANGED_EVENT = "mamago:family-personas-changed";

export function notifyFamilyPersonasChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FAMILY_PERSONAS_CHANGED_EVENT));
}
