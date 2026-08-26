/**
 * Metric Dictionary — one formal definition per /admin dashboard KPI:
 * business meaning, exact formula, source, window, exclusions, and an
 * explicit `verifiable` flag. `verifiable: false` means this metric can
 * never be shown as VERIFIED with today's infrastructure, no matter how
 * fresh/complete its last MetricSample is — every visitor-derived KPI
 * (anything built on canonicalAudience/planningActivity identities) is
 * `verifiable: false` until GA4/Yandex server-side reconciliation ships
 * (see docs/engineering/backlog.md); flipping that flag is the ONLY change
 * needed to promote those metrics once reconciliation lands.
 */

export type MetricStatus = "VERIFIED" | "PROVISIONAL" | "NO_DATA" | "STALE" | "DATA_QUALITY_WARNING";

export interface MetricDictionaryEntry {
  metricKey: string;
  displayName: string;
  businessMeaning: string;
  formula: string;
  source: string;
  window: string;
  exclusions: string;
  version: string;
  /** Set only when the metric's identity unit is a stand-in for something else not yet modeled. */
  identityModel?: string;
  verifiable: boolean;
}

const EXCLUDES_STAFF = "Исключены роли ADMIN и MODERATOR";

export const METRIC_DICTIONARY: Record<string, MetricDictionaryEntry> = {
  "audience.dau": {
    metricKey: "audience.dau",
    displayName: "DAU",
    businessMeaning: "Уникальные пользователи/визиты продукта за сутки",
    formula: "DISTINCT canonical visitor (см. canonicalAudience.ts) за окно",
    source: "UserEvent (PAGE_VIEW)",
    window: "Скользящие 24 часа",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
  },
  "audience.wau": {
    metricKey: "audience.wau",
    displayName: "WAU",
    businessMeaning: "Уникальные пользователи/визиты продукта за 7 дней",
    formula: "DISTINCT canonical visitor за окно",
    source: "UserEvent (PAGE_VIEW)",
    window: "Скользящие 7 дней",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
  },
  "audience.mau": {
    metricKey: "audience.mau",
    displayName: "MAU",
    businessMeaning: "Уникальные пользователи/визиты продукта за 30 дней",
    formula: "DISTINCT canonical visitor за окно",
    source: "UserEvent (PAGE_VIEW)",
    window: "Скользящие 30 дней",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
  },
  "planning.wpf": {
    metricKey: "planning.wpf",
    displayName: "Weekly Planning Families",
    businessMeaning:
      "North Star: сколько уникальных аккаунтов совершили хотя бы одно значимое действие планирования за последние 7 дней",
    formula:
      "DISTINCT userId по объединению: UserEvent(SAVE|PLAN_ADD) ∪ RouteIdea.createdAt ∪ DayScenario.createdAt|updatedAt ∪ PlanItem(routeId IS NOT NULL).createdAt",
    source: "UserEvent, RouteIdea, DayScenario, PlanItem — см. planningActivity.ts",
    window: "Скользящие 7 дней",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    identityModel: "ACCOUNT_AS_FAMILY_PROXY",
    verifiable: false,
  },
  "retention.w1": {
    metricKey: "retention.w1",
    displayName: "W1 Retention",
    businessMeaning:
      "Доля новых аккаунтов, вернувшихся со значимым действием планирования на 2–7 день после регистрации (НЕ same-day/next-day-only)",
    formula: "|{u ∈ cohort(D): qualifying action в [D+2, D+7]}| / |cohort(D)|",
    source: "User.createdAt (когорта) + planningActivity.ts",
    window: "Когорта зарегистрированных ровно 7 дней назад; окно проверки [D+2, D+7]",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
  },
  "retention.w4": {
    metricKey: "retention.w4",
    displayName: "W4 Retention",
    businessMeaning: "Доля новых аккаунтов, вернувшихся со значимым действием планирования на 22–30 день",
    formula: "|{u ∈ cohort(D): qualifying action в [D+22, D+30]}| / |cohort(D)|",
    source: "User.createdAt (когорта) + planningActivity.ts",
    window: "Когорта зарегистрированных ровно 30 дней назад; окно проверки [D+22, D+30]",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
  },
  "habit.3of4week": {
    metricKey: "habit.3of4week",
    displayName: "3/4 Week Habit",
    businessMeaning:
      "Доля уже активированных планирующих аккаунтов, повторявших значимое действие планирования минимум в 3 из последних 4 недель",
    formula:
      "|{u ∈ eligible: активен в ≥3 из 4 недельных бакетов}| / |eligible|, где eligible = аккаунты с первым qualifying action до начала 4-недельного окна",
    source: "planningActivity.ts (getEligiblePlanningFamilies + getPlanningActiveUserWeekBuckets)",
    window: "Трейлинг 4 недели (28 дней); сравнение co сдвигом на 7 дней (не на 28)",
    exclusions: `${EXCLUDES_STAFF}; из знаменателя исключены аккаунты без первого qualifying action до начала окна`,
    version: "1.0.0",
    identityModel: "ACCOUNT_AS_FAMILY_PROXY",
    verifiable: false,
  },
  "funnel.engaged_users": {
    metricKey: "funnel.engaged_users",
    displayName: "Engaged content users",
    businessMeaning: "Уникальные пользователи, открывшие карточку контента (DETAIL_OPEN)",
    formula: "DISTINCT userId с DETAIL_OPEN за окно",
    source: "UserEvent (DETAIL_OPEN)",
    window: "Скользящие 30 дней",
    exclusions: "Нет (совпадает с существующей UserEvent-инструментацией)",
    version: "1.0.0",
    verifiable: true,
  },
  "funnel.save_rate": {
    metricKey: "funnel.save_rate",
    displayName: "Save rate",
    businessMeaning: "Доля engaged-пользователей, сохранивших контент ПОСЛЕ своего первого открытия",
    formula: "|Engaged ∩ {SAVE at/after first DETAIL_OPEN в этом же окне}| / |Engaged|",
    source: "UserEvent (DETAIL_OPEN, SAVE)",
    window: "Скользящие 30 дней",
    exclusions: "Упорядочено по времени относительно первого открытия — не независимая ставка по всем пользователям",
    version: "1.0.0",
    verifiable: true,
  },
  "funnel.plan_rate": {
    metricKey: "funnel.plan_rate",
    displayName: "Plan rate",
    businessMeaning: "Доля engaged-пользователей, добавивших контент в план ПОСЛЕ своего первого открытия",
    formula: "|Engaged ∩ {PLAN_ADD at/after first DETAIL_OPEN}| / |Engaged|",
    source: "UserEvent (DETAIL_OPEN, PLAN_ADD)",
    window: "Скользящие 30 дней",
    exclusions: "Не требует предварительного SAVE — считается независимо от save rate",
    version: "1.0.0",
    verifiable: true,
  },
  "funnel.cta_rate": {
    metricKey: "funnel.cta_rate",
    displayName: "CTA rate",
    businessMeaning: "Доля engaged-пользователей, кликнувших CTA ПОСЛЕ своего первого открытия",
    formula: "|Engaged ∩ {CTA_CLICK at/after first DETAIL_OPEN}| / |Engaged|",
    source: "UserEvent (DETAIL_OPEN, CTA_CLICK)",
    window: "Скользящие 30 дней",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "supply.active_events": {
    metricKey: "supply.active_events",
    displayName: "Active Events",
    businessMeaning: "Опубликованные события, релевантные пользователю прямо сейчас",
    formula: "COUNT(Activity WHERE type='EVENT' AND status='PUBLISHED' AND релевантная дата не в прошлом)",
    source: "Activity",
    window: "Текущий момент",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "supply.active_places": {
    metricKey: "supply.active_places",
    displayName: "Active Places",
    businessMeaning: "Опубликованные места, доступные пользователю",
    formula: "COUNT(Place WHERE status='PUBLISHED')",
    source: "Place",
    window: "Текущий момент",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "supply.active_offers": {
    metricKey: "supply.active_offers",
    displayName: "Active Offers",
    businessMeaning: "Опубликованные предложения/классы, доступные пользователю",
    formula: "COUNT(Offer WHERE status='PUBLISHED')",
    source: "Offer",
    window: "Текущий момент",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "supply.content_freshness_pct": {
    metricKey: "supply.content_freshness_pct",
    displayName: "Content freshness",
    businessMeaning: "Доля активного инвентаря, технически изменённого за последние 7 дней",
    formula: "COUNT(active WHERE updatedAt >= now - 7d) / COUNT(active)",
    source: "Activity, Place, Offer",
    window: "updatedAt за последние 7 дней",
    exclusions:
      "PROVISIONAL прокси: updatedAt — техническая метка изменения записи, не гарантия актуальности информации о событии",
    version: "1.0.0",
    verifiable: false,
  },
  "b2b.active_businesses": {
    metricKey: "b2b.active_businesses",
    displayName: "Active Businesses",
    businessMeaning: "Бизнесы с operationalStatus=ACTIVE и хотя бы одной опубликованной публикацией",
    formula: "COUNT(Business WHERE operationalStatus='ACTIVE' AND ≥1 published Place/Activity/Offer)",
    source: "Business, Place, Activity, Offer",
    window: "Текущий момент",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "b2b.new_businesses_30d": {
    metricKey: "b2b.new_businesses_30d",
    displayName: "New Businesses / 30d",
    businessMeaning: "Новые бизнес-аккаунты за последние 30 дней",
    formula: "COUNT(Business WHERE createdAt >= now - 30d)",
    source: "Business",
    window: "Скользящие 30 дней",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "b2b.meaningful_action_rate": {
    metricKey: "b2b.meaningful_action_rate",
    displayName: "Businesses receiving meaningful actions",
    businessMeaning: "Доля активных бизнесов с публикациями, получивших реальный интерес за 30 дней",
    formula:
      "(active businesses с публикациями, получившими ≥1 SAVE/PLAN_ADD/CTA_CLICK за 30д) / (active businesses с ≥1 published публикацией)",
    source: "Business + UserEvent (SAVE, PLAN_ADD, CTA_CLICK) сгруппированные по владеющему бизнесу",
    window: "Скользящие 30 дней",
    exclusions: "Бизнесы без опубликованного инвентаря исключены из числителя и знаменателя",
    version: "1.0.0",
    verifiable: true,
  },
  "search.queries_total": {
    metricKey: "search.queries_total",
    displayName: "Searches",
    businessMeaning: "Количество поисковых запросов",
    formula: "COUNT(SearchQueryLog)",
    source: "SearchQueryLog",
    window: "Скользящие 15 минут (окно коллектора)",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
  "search.zero_result_rate": {
    metricKey: "search.zero_result_rate",
    displayName: "Zero Result Rate",
    businessMeaning: "Доля поисковых запросов без результатов",
    formula: "COUNT(resultsCount=0) / COUNT(*)",
    source: "SearchQueryLog",
    window: "Скользящие 15 минут (окно коллектора)",
    exclusions: "Не определено (null) при нулевом количестве запросов",
    version: "1.0.0",
    verifiable: true,
  },
  "search.action_rate": {
    metricKey: "search.action_rate",
    displayName: "Search → meaningful action",
    businessMeaning: "Доля поисковых сессий, приведших к open/save/plan add",
    formula: "COUNT(поисковые сессии с последующим DETAIL_OPEN|SAVE|PLAN_ADD) / COUNT(поисковые сессии)",
    source: "SearchQueryLog + UserEvent",
    window: "Скользящие 15 минут (окно коллектора)",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
  },
};

export function getMetricDictionaryEntry(metricKey: string): MetricDictionaryEntry | null {
  return METRIC_DICTIONARY[metricKey] ?? null;
}

export function resolveMetricStatus(
  value: number | null,
  entry: MetricDictionaryEntry | null,
  opts: { stale?: boolean; dataQualityWarning?: boolean } = {},
): MetricStatus {
  if (opts.dataQualityWarning) return "DATA_QUALITY_WARNING";
  if (value === null) return "NO_DATA";
  if (opts.stale) return "STALE";
  return entry?.verifiable ? "VERIFIED" : "PROVISIONAL";
}
