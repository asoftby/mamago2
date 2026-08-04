import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { computeWholeFamilyPresetIds } from "@/lib/family/wholeFamilyPreset";

export type DefaultParticipantsSource =
  | "last-used"
  | "profile"
  | "last-used-age-ranges"
  | "needs-age";

export type DefaultAudienceMode = "family" | "child" | "adult" | "free";

/** Значение из AGE_GROUPS (@/features/filters/age/ageGroups), напр. "3-5". Не новая шкала диапазонов. */
export type AgeRangeValue = string;

/** Сколько возрастов можно держать выбранными одновременно в шаге needs-age (FIFO при превышении). */
export const MAX_SELECTED_AGE_RANGES = 3;

export type ResolveDefaultParticipantsResult =
  | {
      source: "last-used" | "profile";
      participants: string[];
      mode: DefaultAudienceMode;
    }
  | {
      /** Нет персон-детей в профиле, но ранее уже отвечали на вопрос о возрасте — не переспрашиваем. */
      source: "last-used-age-ranges";
      ageRanges: AgeRangeValue[];
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
  /**
   * Явно сохранённый ранее ответ на вопрос о возрасте (см. lastPlanAgeRangesStorage),
   * актуален только когда в профиле нет ни одной персоны-ребёнка. null — ещё не отвечали.
   */
  lastUsedAgeRanges: AgeRangeValue[] | null;
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
 * по приоритету: последний использованный состав (персоны, затем — если персон-детей нет —
 * ранее отвеченные диапазоны возраста) → все дети из профиля + «Я» → `needs-age`, если
 * ничего из вышеперечисленного нет (единственный случай, требующий вопроса о возрасте).
 */
export function resolveDefaultParticipants(
  input: ResolveDefaultParticipantsInput,
): ResolveDefaultParticipantsResult {
  const { lastUsedPersonaIds, lastUsedAgeRanges, personas, primaryAdultPersonaId } = input;
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

  if (lastUsedAgeRanges !== null && lastUsedAgeRanges.length > 0) {
    return {
      source: "last-used-age-ranges",
      ageRanges: lastUsedAgeRanges.slice(0, MAX_SELECTED_AGE_RANGES),
    };
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
