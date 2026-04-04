import {
  FAMILY_SELECTION_LIMIT_MESSAGE,
  MAX_ACTIVE_FAMILY_PERSONAS,
} from "@/lib/family/wholeFamilyPreset";

/** Добавить/убрать id; при переполнении — next: null и сообщение. */
export function togglePersonaId(
  current: string[],
  personaId: string,
  allowed: Set<string>,
): { next: string[] | null; limitMessage?: string } {
  if (!allowed.has(personaId)) return { next: current };
  if (current.includes(personaId)) {
    return { next: current.filter((id) => id !== personaId) };
  }
  if (current.length >= MAX_ACTIVE_FAMILY_PERSONAS) {
    return { next: null, limitMessage: FAMILY_SELECTION_LIMIT_MESSAGE };
  }
  return { next: [...current, personaId] };
}
