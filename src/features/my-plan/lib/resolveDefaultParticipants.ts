import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { computeWholeFamilyPresetIds } from "@/lib/family/wholeFamilyPreset";

export type DefaultParticipantsSource = "last-used" | "profile" | "needs-age";

export type DefaultAudienceMode = "family" | "child" | "adult" | "free";

export type ResolveDefaultParticipantsResult =
  | {
      source: "last-used" | "profile";
      participants: string[];
      mode: DefaultAudienceMode;
    }
  | {
      source: "needs-age";
    };

export interface ResolveDefaultParticipantsInput {
  /**
   * Явно сохранённый ранее состав для быстрого подбора (см. lastPlanParticipantsStorage),
   * или null, если пользователь ещё ни разу не сохранял состав явно.
   * Пустой массив — валидное явное значение («Сама решу» без персонализации).
   */
  lastUsedPersonaIds: string[] | null;
  /** Все персоны пользователя: взрослый первым, затем дети. */
  personas: FamilyPersona[];
  primaryAdultPersonaId: string | null;
}

function deriveMode(participantIds: string[], personas: FamilyPersona[]): DefaultAudienceMode {
  if (participantIds.length === 0) return "free";
  const selected = personas.filter((p) => participantIds.includes(p.id));
  const hasAdult = selected.some((p) => p.kind === "adult");
  const hasChild = selected.some((p) => p.kind === "child");
  if (hasAdult && hasChild) return "family";
  if (hasChild) return "child";
  if (hasAdult) return "adult";
  return "free";
}

/**
 * Резолвит состав участников для слоя 0 модалки «Мой план» (без вопроса к пользователю),
 * по приоритету: последний использованный состав → все дети из профиля + «Я» →
 * `needs-age`, если состава ещё нет и в профиле нет ни одного ребёнка (единственный
 * случай, требующий одного уточняющего вопроса о возрасте).
 */
export function resolveDefaultParticipants(
  input: ResolveDefaultParticipantsInput,
): ResolveDefaultParticipantsResult {
  const { lastUsedPersonaIds, personas, primaryAdultPersonaId } = input;
  const allowedIds = new Set(personas.map((p) => p.id));
  const childPersonas = personas.filter((p) => p.kind === "child");

  if (lastUsedPersonaIds !== null) {
    const sanitized = lastUsedPersonaIds.filter((id) => allowedIds.has(id));
    const isStale = lastUsedPersonaIds.length > 0 && sanitized.length === 0;
    if (!isStale) {
      return {
        source: "last-used",
        participants: sanitized,
        mode: deriveMode(sanitized, personas),
      };
    }
  }

  if (childPersonas.length > 0) {
    const participants = computeWholeFamilyPresetIds(personas, primaryAdultPersonaId);
    return {
      source: "profile",
      participants,
      mode: deriveMode(participants, personas),
    };
  }

  return { source: "needs-age" };
}
