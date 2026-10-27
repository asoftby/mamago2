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
  /** Dated definition changes (ТЗ «Аналитика админки»: каждое изменённое определение — с датой). */
  changes?: { date: string; note: string }[];
}

const DETAIL_OPEN_CLIENT_CHANGE = {
  date: "2026-10-27",
  note: "DETAIL_OPEN пишется с клиента (одно на загрузку страницы сущности), боты по User-Agent и анонимы без sessionId отсекаются; до релиза открытия завышены ботами",
};

const EXCLUDES_STAFF = "Исключены роли ADMIN и MODERATOR";
const INTERNAL_TRAFFIC_EXCLUDED_CHANGE = {
  date: "2026-10-27",
  note: "Исключён внутренний трафик: роли ADMIN/MODERATOR (раньше коллектор не исключал роли)",
};

const ANALYTICS_EXCLUSIONS =
  "Исключены роли ADMIN и MODERATOR и tainted-сессии (сессия, связанная в окне с такой ролью, исключается целиком, включая события до логина) — canonicalAudience.ts";
const ANALYTICS_WINDOW = "Выбранный период в минских сутках: с 00:00 по Минску первого дня до текущего момента";
const ANALYTICS_B_CHANGE = {
  date: "2026-10-27",
  note: "Единые определения (metricDefinitions.ts): сутки по Минску вместо UTC, исключён внутренний трафик",
};

const TELEMETRY_WINDOW_NOTE = "Знаменатель — все клиентские запросы к /api/analytics/events за окно (принятые + отсеянные)";

export const METRIC_DICTIONARY: Record<string, MetricDictionaryEntry> = {
  "external_analytics.ga4_coverage": {
    metricKey: "external_analytics.ga4_coverage",
    displayName: "External Analytics Coverage",
    businessMeaning: "Доля фактического трафика mamaGo, наблюдаемая в GA4",
    formula: "observed GA4 traffic / first-party mamaGo traffic за одинаковое окно и сопоставимую единицу",
    source: "GA4 reporting export/API + UserEvent (PAGE_VIEW); GA4 источник пока не подключён",
    window: "Одинаковое явно заданное окно для числителя и знаменателя",
    exclusions: "Не вычисляется без внешнего GA4-наблюдения; sessions нельзя выводить из UserEvent",
    version: "1.0.0",
    verifiable: false,
  },
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
    exclusions: EXCLUDES_STAFF,
    version: "1.2.0",
    verifiable: true,
    changes: [DETAIL_OPEN_CLIENT_CHANGE, INTERNAL_TRAFFIC_EXCLUDED_CHANGE],
  },
  "funnel.save_rate": {
    metricKey: "funnel.save_rate",
    displayName: "Save rate",
    businessMeaning: "Доля engaged-пользователей, сохранивших контент ПОСЛЕ своего первого открытия",
    formula: "|Engaged ∩ {SAVE at/after first DETAIL_OPEN в этом же окне}| / |Engaged|",
    source: "UserEvent (DETAIL_OPEN, SAVE)",
    window: "Скользящие 30 дней",
    exclusions: "Упорядочено по времени относительно первого открытия — не независимая ставка по всем пользователям",
    version: "1.2.0",
    verifiable: true,
    changes: [DETAIL_OPEN_CLIENT_CHANGE, INTERNAL_TRAFFIC_EXCLUDED_CHANGE],
  },
  "funnel.plan_rate": {
    metricKey: "funnel.plan_rate",
    displayName: "Plan rate",
    businessMeaning: "Доля engaged-пользователей, добавивших контент в план ПОСЛЕ своего первого открытия",
    formula: "|Engaged ∩ {PLAN_ADD at/after first DETAIL_OPEN}| / |Engaged|",
    source: "UserEvent (DETAIL_OPEN, PLAN_ADD)",
    window: "Скользящие 30 дней",
    exclusions: "Не требует предварительного SAVE — считается независимо от save rate",
    version: "1.2.0",
    verifiable: true,
    changes: [DETAIL_OPEN_CLIENT_CHANGE, INTERNAL_TRAFFIC_EXCLUDED_CHANGE],
  },
  "funnel.cta_rate": {
    metricKey: "funnel.cta_rate",
    displayName: "CTA rate",
    businessMeaning: "Доля engaged-пользователей, кликнувших CTA ПОСЛЕ своего первого открытия",
    formula: "|Engaged ∩ {CTA_CLICK at/after first DETAIL_OPEN}| / |Engaged|",
    source: "UserEvent (DETAIL_OPEN, CTA_CLICK)",
    window: "Скользящие 30 дней",
    exclusions: "—",
    version: "1.2.0",
    verifiable: true,
    changes: [DETAIL_OPEN_CLIENT_CHANGE, INTERNAL_TRAFFIC_EXCLUDED_CHANGE],
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
  "telemetry.bot_rejected_share_24h": {
    metricKey: "telemetry.bot_rejected_share_24h",
    displayName: "Отсеяно ботов · 24 ч",
    businessMeaning: "Какая доля входящей клиентской телеметрии пришла от ботов и превью мессенджеров",
    formula: "отсеянные ботами запросы / (принятые + боты + без идентичности)",
    source: "MetricSample telemetry.ingest_*_delta (счётчики /api/analytics/events, isbot по User-Agent)",
    window: "Скользящие 24 часа",
    exclusions: TELEMETRY_WINDOW_NOTE,
    version: "1.0.0",
    verifiable: true,
    changes: [{ date: "2026-10-27", note: "Новая метрика (ТЗ A3)" }],
  },
  "telemetry.bot_rejected_share_7d": {
    metricKey: "telemetry.bot_rejected_share_7d",
    displayName: "Отсеяно ботов · 7 дней",
    businessMeaning: "То же за неделю",
    formula: "отсеянные ботами запросы / (принятые + боты + без идентичности)",
    source: "MetricSample telemetry.ingest_*_delta",
    window: "Скользящие 7 дней",
    exclusions: TELEMETRY_WINDOW_NOTE,
    version: "1.0.0",
    verifiable: true,
    changes: [{ date: "2026-10-27", note: "Новая метрика (ТЗ A3)" }],
  },
  "telemetry.no_identity_rejected_share_24h": {
    metricKey: "telemetry.no_identity_rejected_share_24h",
    displayName: "Запросы без идентичности · 24 ч",
    businessMeaning: "Доля клиентских запросов от анонимов без sessionId (не записываются)",
    formula: "отсеянные без идентичности / (принятые + боты + без идентичности)",
    source: "MetricSample telemetry.ingest_*_delta",
    window: "Скользящие 24 часа",
    exclusions: TELEMETRY_WINDOW_NOTE,
    version: "1.0.0",
    verifiable: true,
    changes: [{ date: "2026-10-27", note: "Новая метрика (ТЗ A3)" }],
  },
  "telemetry.stored_without_identity_share_24h": {
    metricKey: "telemetry.stored_without_identity_share_24h",
    displayName: "События без идентичности · 24 ч",
    businessMeaning: "Доля записанных событий, которые нельзя отнести ни к пользователю, ни к устройству",
    formula: "COUNT(UserEvent без userId, sessionId и anonymousId) / COUNT(UserEvent)",
    source: "UserEvent",
    window: "Скользящие 24 часа",
    exclusions: "—",
    version: "1.0.0",
    verifiable: true,
    changes: [{ date: "2026-10-27", note: "Новая метрика (ТЗ A3)" }],
  },
  "analytics.visitors": {
    metricKey: "analytics.visitors",
    displayName: "Визиторы",
    businessMeaning: "Уникальные посетители за период — то же определение, что DAU/WAU/MAU на /admin",
    formula: "computeCanonicalAudience().visitors: DISTINCT eligible userId + DISTINCT sessionId, ни разу не связанный в окне с userId",
    source: "UserEvent (PAGE_VIEW) — canonicalAudience.ts",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "2.0.0",
    verifiable: false,
    changes: [{ date: "2026-10-27", note: "Раньше: distinct userId и distinct sessionId по всем событиям раздельно («Active users»)" }],
  },
  "analytics.devices": {
    metricKey: "analytics.devices",
    displayName: "Устройства",
    businessMeaning: "Сколько браузеров/устройств открывали сайт. Это не сессии (BACKLOG-211)",
    formula: "computeCanonicalAudience().devices: DISTINCT sessionId среди учтённых PAGE_VIEW",
    source: "UserEvent (PAGE_VIEW); sessionId = mg_analytics_sid (вечный id браузера)",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "2.0.0",
    verifiable: false,
    changes: [{ date: "2026-10-27", note: "Переименовано из «Sessions»; раньше — distinct sessionId по всем типам событий" }],
  },
  "analytics.page_views": {
    metricKey: "analytics.page_views",
    displayName: "Просмотры страниц",
    businessMeaning: "Сколько страниц открыли посетители",
    formula: "computeCanonicalAudience().pageViews: PAGE_VIEW строки учтённых визиторов",
    source: "UserEvent (PAGE_VIEW)",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "2.0.0",
    verifiable: false,
    changes: [{ date: "2026-10-27", note: "Раньше PAGE_VIEW + CARD_VIEW («Views»); показы карточек вынесены отдельно" }],
  },
  "analytics.feed_impressions": {
    metricKey: "analytics.feed_impressions",
    displayName: "Показы в ленте",
    businessMeaning: "Сколько раз карточки показывались в лентах и подборках",
    formula: "COUNT(UserEvent WHERE eventType = CARD_VIEW)",
    source: "UserEvent (CARD_VIEW)",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "1.0.0",
    verifiable: true,
    changes: [ANALYTICS_B_CHANGE],
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
