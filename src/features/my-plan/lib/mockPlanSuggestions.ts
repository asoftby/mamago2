import { ActivityType } from "@prisma/client";
import type { MyPlanIdea } from "../hooks/useMyPlan";

type Activity = NonNullable<MyPlanIdea["activity"]>;

const MOCK_ID_PREFIX = "__plan_mock__";

/** Примеры для блока «Рекомендации» (не привязаны к БД; «В план» ведёт в каталог). */
const MOCK_PLAN_SUGGESTION_ACTIVITIES: Activity[] = [
  {
    id: `${MOCK_ID_PREFIX}1`,
    slug: null,
    title: "Семейный театр: интерактивная сказка",
    type: ActivityType.EVENT,
    coverImageUrl: null,
    ageLabel: "3–7 лет",
    eventCategory: { nameRu: "Театр" },
    priceFrom: 25,
    priceText: null,
    currency: "BYN",
    status: "PUBLISHED",
    owner: { business: { operationalStatus: "ACTIVE" } },
    place: {
      shortAddress: "пр. Независимости",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
    },
    venue: null,
    scheduleJson: null,
  },
  {
    id: `${MOCK_ID_PREFIX}2`,
    slug: null,
    title: "Мастер-класс: лепка из глины",
    type: ActivityType.EVENT,
    coverImageUrl: null,
    ageLabel: "5–10 лет",
    eventCategory: { nameRu: "Мастер-класс" },
    priceFrom: 35,
    priceText: null,
    currency: "BYN",
    status: "PUBLISHED",
    owner: { business: { operationalStatus: "ACTIVE" } },
    place: {
      shortAddress: "Центр",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
    },
    venue: null,
    scheduleJson: null,
  },
  {
    id: `${MOCK_ID_PREFIX}3`,
    slug: null,
    title: "Прогулка с квестом по парку",
    type: ActivityType.EVENT,
    coverImageUrl: null,
    ageLabel: "6–12 лет",
    eventCategory: { nameRu: "На улице" },
    priceFrom: 0,
    priceText: null,
    currency: "BYN",
    status: "PUBLISHED",
    owner: { business: { operationalStatus: "ACTIVE" } },
    place: {
      shortAddress: "Парк Горького",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
    },
    venue: null,
    scheduleJson: null,
  },
];

export function isPlanSuggestionMockId(id: string): boolean {
  return id.startsWith(MOCK_ID_PREFIX);
}

/**
 * Реальные события с API — приоритет: если есть хоть одна подборка, показываем только их
 * (иначе пользователь кликает по мокам и видит toast вместо добавления в план).
 * Примеры из MOCK_* только когда API ничего не вернул — как иллюстрация пустого состояния.
 */
export function mergePlanSuggestionsWithMocks(
  fromApi: Activity[],
  maxItems = 5,
): Activity[] {
  const seen = new Set<string>();
  const deduped: Activity[] = [];
  for (const a of fromApi) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    deduped.push(a);
    if (deduped.length >= maxItems) break;
  }

  if (deduped.length > 0) {
    return deduped;
  }

  const out: Activity[] = [];
  for (const a of MOCK_PLAN_SUGGESTION_ACTIVITIES) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
    if (out.length >= maxItems) break;
  }
  return out;
}
