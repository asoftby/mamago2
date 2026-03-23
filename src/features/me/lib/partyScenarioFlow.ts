import type {
  ScenarioFlowStep,
  ScenarioSlotKey,
  UserBirthdayParty,
} from "@/features/me/types/userBirthdayParty";

/** Короткие подписи слотов (не названия офферов) */
export const SCENARIO_SLOT_LABEL: Record<ScenarioSlotKey, string> = {
  place: "Место",
  animator: "Аниматор",
  decor: "Декор",
  cake: "Торт",
  photo: "Фото",
  masterclass: "Мастер-класс",
  food: "Еда",
  games: "Игры",
  other: "Другое",
};

/** Порядок проверки: более специфичные шаблоны выше */
const SLOT_RULES: Array<{ slot: ScenarioSlotKey; test: (s: string) => boolean }> = [
  {
    slot: "cake",
    test: (s) =>
      /торт|тортик|бенто|капкейк|десерт|сладк/i.test(s),
  },
  {
    slot: "photo",
    test: (s) =>
      /фото|фотограф|съёмк|съемк|photograph/i.test(s),
  },
  {
    slot: "animator",
    test: (s) =>
      /аниматор|клоун|персонаж|герой|шоу-программ|шоу программ|ведущ/i.test(s),
  },
  {
    slot: "decor",
    test: (s) =>
      /декор|оформлен|шарик|balloon|гирлянд|фотозон|фотозона/i.test(s),
  },
  {
    slot: "masterclass",
    test: (s) =>
      /мастер[\s-]?класс|\bмк\b|воркшоп|workshop/i.test(s),
  },
  {
    slot: "food",
    test: (s) =>
      /кейтеринг|фуршет|банкет|еда|закуск|пицц|сет\b/i.test(s),
  },
  {
    slot: "games",
    test: (s) =>
      /квест|игров|игры|развлечен/i.test(s),
  },
  {
    slot: "place",
    test: (s) =>
      /игров(ая|ой|ую)|комнат|площадк|место|зал\b|кафе|заведен|аренд|лофт|студи/i.test(s),
  },
];

export function detectScenarioSlotFromText(raw: string): ScenarioSlotKey {
  const s = raw.trim().toLowerCase();
  if (!s) return "other";
  for (const { slot, test } of SLOT_RULES) {
    if (test(s)) return slot;
  }
  return "other";
}

function dedupeStepsPreserveOrder(steps: ScenarioFlowStep[]): ScenarioFlowStep[] {
  const bySlot = new Map<ScenarioSlotKey, ScenarioFlowStep>();
  for (const step of steps) {
    const prev = bySlot.get(step.slot);
    if (!prev) {
      bySlot.set(step.slot, { ...step });
    } else {
      bySlot.set(step.slot, {
        slot: step.slot,
        confirmed: prev.confirmed || step.confirmed,
      });
    }
  }
  const order: ScenarioSlotKey[] = [];
  const seen = new Set<ScenarioSlotKey>();
  for (const step of steps) {
    if (!seen.has(step.slot)) {
      seen.add(step.slot);
      order.push(step.slot);
    }
  }
  return order.map((slot) => bySlot.get(slot)!);
}

function inferStepsFromPreview(previewItems: string[]): ScenarioFlowStep[] {
  const out: ScenarioFlowStep[] = [];
  const seen = new Set<ScenarioSlotKey>();
  for (const line of previewItems) {
    const slot = detectScenarioSlotFromText(line);
    if (seen.has(slot)) continue;
    seen.add(slot);
    out.push({ slot, confirmed: false });
  }
  return out;
}

export type PartyScenarioFlowSegment = {
  label: string;
  confirmed: boolean;
};

export type PartyScenarioFlowUi = {
  /** Уже обрезано под лимит отображения */
  visible: PartyScenarioFlowSegment[];
  /** Сколько слотов скрыто за «+ ещё N» */
  overflowCount: number;
};

/** До 4 слотов показываем все; если больше — первые 3 и «+ ещё N» */
const MAX_SHOW_ALL = 4;
const MAX_WHEN_COLLAPSING = 3;

function toSegments(steps: ScenarioFlowStep[]): PartyScenarioFlowSegment[] {
  return steps.map((s) => ({
    label: SCENARIO_SLOT_LABEL[s.slot],
    confirmed: s.confirmed,
  }));
}

/**
 * Компактный сценарный flow для карточки ЛК.
 * Приоритет: `scenarioFlow` с бэка → эвристика по `previewItems`.
 */
export function getPartyScenarioFlowUi(party: UserBirthdayParty): PartyScenarioFlowUi | null {
  let steps: ScenarioFlowStep[] = [];

  if (party.scenarioFlow?.length) {
    steps = dedupeStepsPreserveOrder(party.scenarioFlow);
  } else if (party.previewItems?.length) {
    steps = inferStepsFromPreview(party.previewItems);
  }

  if (steps.length === 0) return null;

  const segments = toSegments(steps);

  if (segments.length <= MAX_SHOW_ALL) {
    return { visible: segments, overflowCount: 0 };
  }

  return {
    visible: segments.slice(0, MAX_WHEN_COLLAPSING),
    overflowCount: segments.length - MAX_WHEN_COLLAPSING,
  };
}
