/**
 * Конфиг подбора «Для вашей семьи». Веса и лимиты живут здесь (а не в логике),
 * алгоритм читает их через normalizeFamilyPicksConfig — значения можно менять без правки кода ранжирования.
 * Это политика поверхности HOME поверх общего движка (planSuggestions.service), не отдельный engine.
 */
export const FAMILY_PICKS_ALGORITHM_VERSION = "family-picks-v1";

export type FamilyPicksWeights = {
  age: number;
  interests: number;
  date: number;
  territory: number;
  history: number;
  /** Бюджета семьи в профиле нет — вес 0 (решение владельца). */
  budget: number;
};

export type FamilyPicksConfig = {
  weights: FamilyPicksWeights;
  /** Сколько карточек отдать. */
  resultCount: number;
  /** Меньше — блок скрывается (ничего не показываем вместо слабой выдачи). */
  minResultCount: number;
  maxPerCategory: number;
  maxPerBusiness: number;
  /** Слоты «Попробуйте новое» (категория, которой нет в истории семьи). */
  noveltySlots: number;
  /** Сколько карточек с неизвестным возрастом можно добавить после подходящих по возрасту. */
  maxUnknownAgeItems: number;
  /** Сколько дней смотрим вперёд вне выходных (пн–ср). */
  weekHorizonDays: number;
  /** Сколько отрицательных DISMISS-сигналов хранится в исключениях (дней). */
  dismissCooldownDays: number;
};

export const DEFAULT_FAMILY_PICKS_CONFIG: FamilyPicksConfig = {
  weights: { age: 25, interests: 25, date: 30, territory: 10, history: 10, budget: 0 },
  resultCount: 6,
  minResultCount: 3,
  maxPerCategory: 2,
  maxPerBusiness: 1,
  noveltySlots: 1,
  maxUnknownAgeItems: 2,
  weekHorizonDays: 7,
  dismissCooldownDays: 60,
};

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(num(value, fallback, min, max));
}

export function normalizeFamilyPicksConfig(value?: unknown): FamilyPicksConfig {
  const d = DEFAULT_FAMILY_PICKS_CONFIG;
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const w = input.weights && typeof input.weights === "object" ? (input.weights as Record<string, unknown>) : {};
  const resultCount = int(input.resultCount, d.resultCount, 1, 12);
  return {
    weights: {
      age: num(w.age, d.weights.age, 0, 100),
      interests: num(w.interests, d.weights.interests, 0, 100),
      date: num(w.date, d.weights.date, 0, 100),
      territory: num(w.territory, d.weights.territory, 0, 100),
      history: num(w.history, d.weights.history, 0, 100),
      budget: num(w.budget, d.weights.budget, 0, 100),
    },
    resultCount,
    minResultCount: int(input.minResultCount, d.minResultCount, 1, resultCount),
    maxPerCategory: int(input.maxPerCategory, d.maxPerCategory, 1, 12),
    maxPerBusiness: int(input.maxPerBusiness, d.maxPerBusiness, 1, 12),
    noveltySlots: int(input.noveltySlots, d.noveltySlots, 0, 3),
    maxUnknownAgeItems: int(input.maxUnknownAgeItems, d.maxUnknownAgeItems, 0, 12),
    weekHorizonDays: int(input.weekHorizonDays, d.weekHorizonDays, 1, 14),
    dismissCooldownDays: int(input.dismissCooldownDays, d.dismissCooldownDays, 1, 365),
  };
}
