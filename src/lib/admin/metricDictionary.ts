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

const HONEST_GROWTH_CHANGE = {
  date: "2026-10-27",
  note: "Рост WoW/MoM считается по завершённым окнам (последние N полных минских суток против предыдущих N); раньше текущее окно с неполным днём сравнивалось с полным предыдущим, и рост занижался в начале недели",
};
const PLANNING_ACTION_CHANGE = {
  date: "2026-10-27",
  note: "«Плановое действие»: учитываются все создания PlanItem (бот, ручные записи, статьи), а не только с маршрутом; SAVE больше не плановое действие (остаётся отдельной метрикой «Сохранения»). WPF, возврат и привычка могли измениться",
};
const PUBLIC_VISIBILITY_CHANGE = {
  date: "2026-10-27",
  note: "Считается то, что видно на публичном сайте (publicContentVisibility.ts): без архивных, без контента отключённых бизнесов, без прошедших событий; раньше — только status = PUBLISHED",
};
const SAMPLE_TTL_CHANGE = {
  date: "2026-10-27",
  note: "Значение показывается, только если сэмпл свежее 3 интервалов коллектора; иначе «Нет данных»",
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
    window: "Скользящие 7 минских суток до текущего момента (включая неполные сегодняшние) — «на сейчас»; рост считается по завершённым окнам, см. audience.wau_completed",
    exclusions: EXCLUDES_STAFF,
    version: "1.1.0",
    changes: [HONEST_GROWTH_CHANGE, SAMPLE_TTL_CHANGE],
    verifiable: false,
  },
  "audience.mau": {
    metricKey: "audience.mau",
    displayName: "MAU",
    businessMeaning: "Уникальные пользователи/визиты продукта за 30 дней",
    formula: "DISTINCT canonical visitor за окно",
    source: "UserEvent (PAGE_VIEW)",
    window: "Скользящие 30 минских суток до текущего момента (включая неполные сегодняшние) — «на сейчас»; рост считается по завершённым окнам, см. audience.mau_completed",
    exclusions: EXCLUDES_STAFF,
    version: "1.1.0",
    changes: [HONEST_GROWTH_CHANGE, SAMPLE_TTL_CHANGE],
    verifiable: false,
  },
  "audience.wau_completed": {
    metricKey: "audience.wau_completed",
    displayName: "Рост WAU (WoW)",
    businessMeaning: "Изменение недельной аудитории: последние 7 завершённых минских суток против предыдущих 7",
    formula:
      "(WAU[последние 7 полных суток] − WAU[7 суток до них]) / WAU[7 суток до них]; метрики audience.wau_completed и audience.wau_completed_prev; при знаменателе 0 процента нет",
    source: "UserEvent (PAGE_VIEW) — canonicalAudience.ts",
    window: "Два соседних окна из 7 полных минских суток, заканчивающихся последней полночью по Минску",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
    changes: [HONEST_GROWTH_CHANGE],
  },
  "audience.mau_completed": {
    metricKey: "audience.mau_completed",
    displayName: "Рост MAU (MoM)",
    businessMeaning: "Изменение месячной аудитории: последние 30 завершённых минских суток против предыдущих 30",
    formula:
      "(MAU[последние 30 полных суток] − MAU[30 суток до них]) / MAU[30 суток до них]; метрики audience.mau_completed и audience.mau_completed_prev; при знаменателе 0 процента нет",
    source: "UserEvent (PAGE_VIEW) — canonicalAudience.ts",
    window: "Два соседних окна из 30 полных минских суток, заканчивающихся последней полночью по Минску",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    verifiable: false,
    changes: [HONEST_GROWTH_CHANGE],
  },
  "planning.wpf_completed": {
    metricKey: "planning.wpf_completed",
    displayName: "Рост WPF (WoW)",
    businessMeaning: "Изменение числа семей, планировавших за неделю: последние 7 завершённых минских суток против предыдущих 7",
    formula:
      "(WPF[последние 7 полных суток] − WPF[7 суток до них]) / WPF[7 суток до них]; метрики planning.wpf_completed и planning.wpf_completed_prev; при знаменателе 0 процента нет",
    source: "planningActivity.ts",
    window: "Два соседних окна из 7 полных минских суток, заканчивающихся последней полночью по Минску",
    exclusions: EXCLUDES_STAFF,
    version: "1.0.0",
    identityModel: "ACCOUNT_AS_FAMILY_PROXY",
    verifiable: false,
    changes: [HONEST_GROWTH_CHANGE],
  },
  "planning.wpf": {
    metricKey: "planning.wpf",
    displayName: "Weekly Planning Families",
    businessMeaning:
      "North Star: сколько уникальных аккаунтов совершили хотя бы одно значимое действие планирования за последние 7 дней",
    formula:
      "DISTINCT userId по объединению: UserEvent(PLAN_ADD) ∪ RouteIdea.createdAt ∪ DayScenario.createdAt|updatedAt ∪ PlanItem.createdAt (любое создание записи в плане: каталог, бот, ручная запись, статья); SAVE не входит; PLAN_ADD с последующим удалением продолжает считаться",
    source: "UserEvent, RouteIdea, DayScenario, PlanItem — см. planningActivity.ts",
    window: "Скользящие 7 минских суток до текущего момента — «на сейчас»; WoW считается по завершённым окнам, см. planning.wpf_completed",
    exclusions: EXCLUDES_STAFF,
    version: "1.2.0",
    changes: [PLANNING_ACTION_CHANGE, HONEST_GROWTH_CHANGE, SAMPLE_TTL_CHANGE],
    identityModel: "ACCOUNT_AS_FAMILY_PROXY",
    verifiable: false,
  },
  "retention.w1": {
    metricKey: "retention.w1",
    displayName: "Возврат через неделю (W1)",
    businessMeaning: "Доля новых пользователей, которые снова что-то запланировали через неделю после недели регистрации",
    formula:
      "|{u ∈ когорта(N): плановое действие на неделе N+1}| / |когорта(N)|; когорта(N) = аккаунты, зарегистрированные в ISO-неделю N (Пн–Вс по Минску); метрика retention.w1_n — размер когорты n",
    source: "User.createdAt (когорта) + planningActivity.ts",
    window: "Последняя завершённая когорта: регистрация на неделе (текущая − 2), проверка на неделе (текущая − 1); сравнение — предыдущая недельная когорта",
    exclusions: `${EXCLUDES_STAFF}; процент скрыт при размере когорты n < 30 (MIN_RATE_SAMPLE) — показывается только n`,
    version: "2.0.0",
    verifiable: false,
    changes: [
      {
        date: "2026-10-27",
        note: "Недельные ISO-когорты вместо когорты одного дня и окна D+2…D+7; добавлен размер когорты n и скрытие процента при n < 30; плановое действие — по новому определению (PLAN_ADD, все PlanItem)",
      },
    ],
  },
  "retention.w4": {
    metricKey: "retention.w4",
    displayName: "Возврат через 4 недели (W4)",
    businessMeaning: "Доля новых пользователей, которые снова что-то запланировали на 4-й неделе после недели регистрации",
    formula:
      "|{u ∈ когорта(N): плановое действие на неделе N+4}| / |когорта(N)|; когорта(N) = аккаунты, зарегистрированные в ISO-неделю N (Пн–Вс по Минску); метрика retention.w4_n — размер когорты n",
    source: "User.createdAt (когорта) + planningActivity.ts",
    window: "Последняя завершённая когорта: регистрация на неделе (текущая − 5), проверка на неделе (текущая − 1); сравнение — предыдущая недельная когорта",
    exclusions: `${EXCLUDES_STAFF}; процент скрыт при размере когорты n < 30 (MIN_RATE_SAMPLE) — показывается только n`,
    version: "2.0.0",
    verifiable: false,
    changes: [
      {
        date: "2026-10-27",
        note: "Недельные ISO-когорты вместо когорты одного дня и окна D+22…D+30; добавлен размер когорты n и скрытие процента при n < 30; плановое действие — по новому определению (PLAN_ADD, все PlanItem)",
      },
    ],
  },
  "habit.3of4week": {
    metricKey: "habit.3of4week",
    displayName: "3/4 Week Habit",
    businessMeaning:
      "Доля уже активированных планирующих аккаунтов, повторявших значимое действие планирования минимум в 3 из последних 4 недель",
    formula:
      "|{u ∈ activated: активен в ≥3 из 4 недельных бакетов}| / |activated|, где activated = аккаунты, чьё первое плановое действие пришлось на 8 недель до начала 4-недельного окна",
    source: "planningActivity.ts (getActivatedPlanningFamilies + getPlanningActiveUserWeekBuckets)",
    window: "Трейлинг 4 недели (28 дней); сравнение co сдвигом на 7 дней (не на 28)",
    exclusions: `${EXCLUDES_STAFF}; из знаменателя исключены аккаунты без планового действия и активированные раньше чем за 8 недель до начала окна или внутри окна`,
    version: "1.1.0",
    changes: [
      {
        date: "2026-10-27",
        note: "Знаменатель — активированные за 8 недель до начала окна (раньше — все активированные когда-либо); плановое действие — по новому определению",
      },
    ],
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
    formula: "COUNT(Activity WHERE type='EVENT' AND getPublicListingActivityWhere(now)): публичный статус + бизнес-владелец не отключён + событие не истекло (будущее вхождение или бессрочное расписание)",
    source: "Activity — publicContentVisibility.ts",
    window: "Текущий момент",
    exclusions: "Черновики, модерация, отклонённые, архив, удалённые; события отключённых бизнесов; прошедшие события",
    version: "1.1.0",
    changes: [PUBLIC_VISIBILITY_CHANGE],
    verifiable: true,
  },
  "supply.active_places": {
    metricKey: "supply.active_places",
    displayName: "Active Places",
    businessMeaning: "Опубликованные места, доступные пользователю",
    formula: "COUNT(Place WHERE getPublicPublishedPlaceWhere(now)): PUBLISHED + не в архиве + бизнес-владелец не отключён",
    source: "Place — publicContentVisibility.ts",
    window: "Текущий момент",
    exclusions: "Архивные места; места отключённых бизнесов",
    version: "1.1.0",
    changes: [PUBLIC_VISIBILITY_CHANGE],
    verifiable: true,
  },
  "supply.active_offers": {
    metricKey: "supply.active_offers",
    displayName: "Active Offers",
    businessMeaning: "Опубликованные предложения/классы, доступные пользователю",
    formula: "COUNT(Offer WHERE getPublicPublishedOfferWhere(now)): PUBLISHED + не в архиве + место публично видно",
    source: "Offer — publicContentVisibility.ts",
    window: "Текущий момент",
    exclusions: "Архивные предложения; предложения без публичного места",
    version: "1.1.0",
    changes: [PUBLIC_VISIBILITY_CHANGE],
    verifiable: true,
  },
  "supply.content_freshness_pct": {
    metricKey: "supply.content_freshness_pct",
    displayName: "Content freshness",
    businessMeaning: "Доля активного инвентаря, технически изменённого за последние 7 дней",
    formula: "COUNT(active WHERE updatedAt >= now - 7d) / COUNT(active), где active — по тем же публичным правилам, что supply.active_*",
    source: "Activity, Place, Offer",
    window: "updatedAt за последние 7 дней",
    exclusions:
      "PROVISIONAL прокси: updatedAt — техническая метка изменения записи, не гарантия актуальности информации о событии",
    version: "1.1.0",
    changes: [PUBLIC_VISIBILITY_CHANGE],
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
  "analytics.segment_trend": {
    metricKey: "analytics.segment_trend",
    displayName: "Тренд сегмента (7 / 30 дней)",
    businessMeaning: "Как изменилось число активных пользователей сегмента по сравнению с предыдущим таким же периодом",
    formula:
      "(A − B) / B × 100%, где A — пользователи сегмента с ≥1 UserEvent в последних 7 (30) завершённых минских сутках, B — в предыдущих 7 (30); при B = 0 показывается «—»",
    source: "UserBehaviorProfile.segmentKeys (состав сегмента) + UserEvent (активность)",
    window: "Последние 7 / 30 завершённых минских суток против предыдущих; не зависит от выбранного периода отчёта",
    exclusions: "Роли ADMIN и MODERATOR",
    version: "2.0.0",
    verifiable: false,
    changes: [
      {
        date: "2026-10-27",
        note: "Раньше — по lastSeenAt внутри выбранного периода, при нуле в предыдущем окне давало +N×100%; теперь по UserEvent за завершённые окна",
      },
    ],
  },
  "analytics.segment_avg_actions": {
    metricKey: "analytics.segment_avg_actions",
    displayName: "Среднее на пользователя сегмента: сохранения / в план / переходы к партнёру",
    businessMeaning: "Сколько в среднем действий совершил пользователь сегмента за выбранный период",
    formula:
      "COUNT(UserEvent: SAVE | PLAN_ADD | CTA_CLICK пользователей сегмента за период) / число пользователей сегмента в периоде (последний визит в периоде)",
    source: "UserEvent + UserBehaviorProfile.segmentKeys",
    window: "Выбранный период в минских сутках",
    exclusions: "Роли ADMIN и MODERATOR; при фильтре города — только события этого города",
    version: "2.0.0",
    verifiable: false,
    changes: [
      { date: "2026-10-27", note: "Раньше — накопленные за всё время счётчики профиля (totalSaves, totalPlanAdds, totalCtaClicks)" },
    ],
  },
  "analytics.behavior_categories": {
    metricKey: "analytics.behavior_categories",
    displayName: "Категории событий (Поведение)",
    businessMeaning: "Какие категории событий чаще показывают, сохраняют, добавляют в план и открывают для перехода",
    formula:
      "COUNT(UserEvent: CARD_VIEW | SAVE | PLAN_ADD | CTA_CLICK по карточкам событий) в разрезе Activity.eventCategoryId",
    source: "UserEvent + Activity.eventCategoryId + EventCategory",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "2.0.0",
    verifiable: false,
    changes: [
      {
        date: "2026-10-27",
        note: "Раньше — вес предпочтений профиля × накопленные счётчики (не зависело от периода); теперь реальные события периода",
      },
    ],
  },
  "analytics.user_funnel": {
    metricKey: "analytics.user_funnel",
    displayName: "Воронка: видели → открыли → сохранили / в план / к партнёру",
    businessMeaning:
      "Сколько людей прошли каждый шаг. «Сохранили», «Добавили в план» и «Перешли к партнёру» — отдельные ветки от «Открыли»: доля считается от открывших и не превышает 100%",
    formula:
      "Уникальные люди (userId, иначе анонимный sessionId). Видели = любое событие воронки; Открыли = ≥1 DETAIL_OPEN; остальные шаги = действие не раньше первого открытия. Доля = шаг / открывшие; при нуле открывших — «—»",
    source: "UserEvent (PAGE_VIEW, CARD_VIEW, DETAIL_OPEN, SAVE, PLAN_ADD, CTA_CLICK)",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "2.0.0",
    verifiable: false,
    changes: [
      {
        date: "2026-10-27",
        note: "Раньше считались события (одна сессия могла дать 300% от предыдущего шага), без учёта порядка, а «Обзор» игнорировал фильтры сегмента и возраста ребёнка. Теперь — уникальные люди с учётом времени, фильтры применяются на всех вкладках",
      },
    ],
  },
  "analytics.content_performance": {
    metricKey: "analytics.content_performance",
    displayName: "Эффективность контента: показы в ленте, открытия, сохранения, в план, CTA",
    businessMeaning: "Как карточка ведёт себя в выбранном периоде. CTR = открытия / показы в ленте",
    formula:
      "COUNT(UserEvent) по карточке: показы в ленте = CARD_VIEW, открытия = DETAIL_OPEN, сохранения = SAVE, в план = PLAN_ADD, CTA = CTA_CLICK. CTR = открытия / показы; без показов — «—». Может быть выше 100%: карточку открывают и мимо ленты (поиск, прямая ссылка)",
    source: "UserEvent",
    window: ANALYTICS_WINDOW,
    exclusions: ANALYTICS_EXCLUSIONS,
    version: "2.0.0",
    verifiable: false,
    changes: [
      {
        date: "2026-10-27",
        note: "Раньше в «просмотры» входили и PAGE_VIEW, и CARD_VIEW; теперь колонка «Показы в ленте» — только CARD_VIEW",
      },
    ],
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
