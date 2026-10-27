# Аудит перед реализацией ТЗ «Аналитика админки и русификация» (2026-10)

- Дата: 2026-10-27
- База: `origin/dev` @ `2ac6da363d51346979f87a94d63fc55f45bcf7c9`
- ТЗ: «ТЗ: исправление аналитики админки и русификация» (блоки A–E, PR 0–10)
- Правило: для каждого пункта ТЗ — найденный код → решение «переиспользовать / расширить».
  Параллельные реализации не строим.

## 1. Обязательные точки проверки

| Что проверить | Найдено | Решение |
| --- | --- | --- |
| `canonicalAudience.ts` — единое определение визитора | `src/server/services/analytics/canonicalAudience.ts`: `computeCanonicalAudience(prisma, start, end)` → `visitors`, `pageViews`; `AUDIENCE_EXCLUDED_ROLES`; tainted-сессии (сессия, связанная в окне с ADMIN/MODERATOR, исключается целиком, включая строки до логина). Используется `/admin` Traffic, `audience.*` коллекторами, `/admin/performance`. | **Расширить.** Добавить необязательные фильтры (город, разрешённые userId) и экспорт правила исключения внутреннего трафика (список tainted-сессий + Prisma/SQL-фрагменты) для Analytics. Новых определений визитора не вводить. |
| `planningActivity.ts` — единое «плановое действие» | `src/server/services/analytics/planningActivity.ts`: union `UserEvent(SAVE, PLAN_ADD)` ∪ `RouteIdea` ∪ `DayScenario(created/updated)` ∪ `PlanItem(routeId IS NOT NULL)`; функции для WPF, W1/W4, habit. | **Расширить на месте** (C3/C5): `PlanItem` — все создания, `SAVE` убрать; знаменатель habit — активированные за 8 недель. Коллекторы `weeklyPlanningFamilies.ts`, `retention.ts`, `habit.ts` продолжают звать только этот модуль. |
| `analyticsQueryHelpers.ts` и копии в `analyticsBehavior.service.ts` | Хелперы `analyticsEntityMap`, `analyticsVerticalMap`, `resolveAnalyticsAllowedUserIds`, `buildAnalyticsBaseEventWhere`, `applyAnalyticsUserFilter`, `analyticsEventWhereSql`, `loadAllEntityTitles`. В `analyticsBehavior.service.ts` — полные копии (`entityMap`, `verticalMap`, `resolveAllowedUserIds`, `buildBaseEventWhere`, `applyUserFilter`, `eventWhereSql`, `eventWhereSqlFromPrismaWhere`, `loadEntityTitles` (только EVENT/PLACE)). В `analyticsOverview.service.ts` — ещё одна копия `buildBaseWhere`, фильтры сегмента/возраста не применяются вовсе. | **Свести к `analyticsQueryHelpers.ts`** (D10, PR 7); туда же — исключение внутреннего трафика (B1, PR 2), чтобы все вкладки получили его из одного места. В PR 2 исключение добавляется в общий хелпер и в копию `analyticsBehavior` (копия удаляется в PR 7). |
| `publicContentVisibility.ts` — правило видимости | `src/server/public/publicContentVisibility.ts`: `getPublicListingActivityWhere`, `getActivityNotExpiredForPublicWhere`, `activityOwnerBusinessActiveWhere`, `getPublicPublishedPlaceWhere`, `getPublicPublishedOfferWhere`. `supplyHealth.ts` их не использует (свой `status='PUBLISHED'` + `nextOccurrenceAt`). | **Переиспользовать** в `supplyHealth.ts` (C6, PR 5). |
| `lib/admin/metricDictionary.ts` — словарь | `METRIC_DICTIONARY` (displayName, formula, source, window, exclusions, version, verifiable) для `/admin` KPI. Подсказок с формулой в `/admin/analytics` нет. | **Расширить**: новые/изменённые метрики (+ дата изменения), формулы для вкладок Analytics. Определения (типы событий, окна, TZ) — в новом `server/services/analytics/metricDefinitions.ts` (B), словарь ссылается на него. |
| Фильтр ботов / UA-парсер | Нет. UA используется только в `guestPlanQuota.ts` (хеш для ключа гостя) и в импорт-парсерах (исходящие запросы). | **Добавить** зависимость `isbot` (поддерживаемая библиотека) — в одном модуле `lib/analytics/clientClass.ts`. |
| i18n-слой | Нет. Есть только `src/lib/i18n/pluralRu.ts`. | **Без фреймворка** (как в ТЗ): `lib/admin/labels.ru.ts` + `pluralRu.ts` + форматтеры дат/чисел `ru-RU`/Europe/Minsk. |

## 2. Пункты ТЗ → найденный код → решение

### Блок A. Источник данных (PR 1)

| Пункт | Найденный код | Решение |
| --- | --- | --- |
| A1 DETAIL_OPEN с клиента | `src/components/analytics/AnalyticsDetailBeacon.tsx` — **серверный** компонент, `trackUserEvent` на каждый рендер, `sessionId` = id auth-сессии (`getSessionRowIdFromCookies`). Вызывается на 8 страницах из ТЗ (12 мест, у статей — несколько веток рендера). Образец клиента: `PageViewTracker.tsx` + `postProductTelemetryEvent` (`lib/analytics/client.ts`, шлёт `mg_analytics_sid` и `anonymousId`). Уже есть клиентские DETAIL_OPEN: `RecommendationCard.tsx` (клик из «Моего плана»), `continuousReadingAnalytics.ts` (`article_view`). | **Переписать `AnalyticsDetailBeacon` на месте** в клиентский компонент с теми же пропсами (одно событие на загрузку страницы сущности, `meta.source="detail"` сохраняется). Страницы меняются минимально (импорт тот же). Новый параллельный трекер не создаём. |
| A1 потребители DETAIL_OPEN | `businessWorkspace.service.ts`, `boostPerformance.service.ts` (PAGE_VIEW/CARD_VIEW), `dailyFreeBoost.service.ts`, `UserBehaviorAggregationService.ts`, `promotion.service.ts` (`registerPromotionActionFromUserEvent`), `behaviorSignalWeights.ts`, `engagementWeights.ts`, `SemanticEventContextService.ts`, коллекторы `funnel.ts`, `search.ts`, `engagementFunnel.ts`. | Не меняем. Событие по-прежнему проходит через `trackUserEvent` (API-роут), поэтому побочные эффекты (профиль, промо, рекомендации) сохраняются. Кабинет бизнеса/буст — в backlog (решение 1). |
| A2 фильтр ботов | `src/app/api/analytics/events/route.ts`, `AnalyticsEventService.trackUserEvent`. Rate-limit отсутствует (BACKLOG-034, не трогаем). | В роуте: UA → `isbot` → 204 без записи; аноним без `sessionId` → 204. `trackUserEvent` принимает необязательный `userAgent`/`clientClass` и сам не пишет бота. Новая колонка `UserEvent.clientClass` — ручная миграция. Сырой UA не хранится. |
| A3 Data Quality | `deriveDataQuality()` в `lib/admin/dashboardViewModels.ts` есть, но **нигде не рендерится**; блока «Data Quality» на `/admin` сейчас нет. Метрики телеметрии: `telemetry.ts` (`telemetry.events_written_5m`). | Счётчики отсеянного трафика пишутся пакетно в `MetricSample` (агрегированный delta раз в ≥60 с на инстанс, не по строке на запрос); новый коллектор считает доли за 24 ч/7 дн и долю событий без идентичности; `deriveDataQuality` расширяется, на `/admin` добавляется компактный блок «Качество данных» (см. «Решения, требующие подтверждения» в PR 1). |
| A4 старые DETAIL_OPEN | — | Не удаляем. Дата релиза A1 определяется по данным: первая строка `UserEvent` с непустым `clientClass` (отдельно на DEV и PROD, без ручной даты). Отчёты Analytics, чьё окно начинается раньше, показывают плашку. |

### Блок B. Единые определения (PR 2)

| Пункт | Найденный код | Решение |
| --- | --- | --- |
| Модуль определений | Нет; типы событий «просмотров» продублированы `VIEW_TYPES = ["PAGE_VIEW","CARD_VIEW"]` в 4 сервисах. | Новый `server/services/analytics/metricDefinitions.ts` (только константы и чистые функции: типы событий, TZ, окна). Сервисы и `metricDictionary.ts` ссылаются на него. |
| Просмотры = только PAGE_VIEW | `analyticsOverview` (`VIEW_TYPES`), Behavior, Funnels, Content Performance. | Overview: `computeCanonicalAudience().pageViews`. «Показы в ленте» = `CARD_VIEW` отдельно. |
| Визиторы / «Sessions» | Overview: `groupBy userId` и `groupBy sessionId` раздельно, по всем типам событий. | `visitors` — из `computeCanonicalAudience` (расширенного фильтрами); «Sessions» → «Устройства» (distinct `sessionId` с исключением внутреннего трафика). |
| B1 внутренний трафик | Analytics-сервисы, `engagementFunnel.ts` (комментарий прямо говорит «No role exclusion»), `telegramAnalytics.service.ts` — роли не исключают. | Исключение через `AUDIENCE_EXCLUDED_ROLES` + tainted-сессии из `canonicalAudience.ts` в `analyticsQueryHelpers` / SQL-фрагменте. Telegram — исключать ADMIN/MODERATOR из пользовательских метрик, кроме счётчиков ошибок бота. |
| B2 минские сутки | `analyticsDateRange.ts` — `date-fns` `startOfDay/endOfDay` (TZ контейнера = UTC). Behavior — `AT TIME ZONE 'UTC'`, подпись «Time-of-day buckets use UTC». Правильные хелперы: `zonedDateKey`, `startOfZonedDay`, `addDateKeyDays` (`lib/stories/ranges.ts`), `DEFAULT_TZ` (`server/geo/geoConstants`), `resolvePerformanceWindow` (`lib/performance/performanceMetrics.ts`). | `resolveAnalyticsDateRange` строим на этих хелперах (полуоткрытый интервал `[start, end)`); бакеты Behavior — `AT TIME ZONE 'Europe/Minsk'`. Новых date-хелперов не вводим. |
| B3 город в PAGE_VIEW | `PageViewTracker` шлёт только `meta.path`. Город: `resolveRouteCitySlug()` (`lib/city/resolveCityContext.ts`), `useCity()` (`contexts/CityContext.tsx`). `UserEvent.territoryId` — expand-фаза (backfill из `cityId`, без чтений). | `PageViewTracker` передаёт `citySlug` (сегмент пути, иначе выбранный город из `CityContext`); `trackUserEvent` уже резолвит `citySlug → cityId`. Фильтр Analytics — по `cityId` (Territory ещё не готова для чтений). |

### Блок C. «Рост продукта» на /admin (PR 3–5)

| Пункт | Найденный код | Решение |
| --- | --- | --- |
| C1 WoW/MoM | `audienceWeeklyMonthly.ts`, `weeklyPlanningFamilies.ts` → `resolvePerformanceWindow` (текущее окно включает неполный сегодняшний день, предыдущее — полное). `deriveGrowth`/`deriveNorthStar` в `dashboardViewModels.ts`. | Добавить в `performanceMetrics.ts` функцию завершённых окон (N полных минских суток против N предыдущих) и новые пары сэмплов `*_complete` / `*_complete_prev`; крупная цифра остаётся «на сейчас». |
| C2 TTL сэмпла | `metricProjection.ts::latestMetricValue` — без ограничения возраста. Интервалы — в объектах коллекторов (`intervalSec`), `db.*` пишет детектор `dbDegraded` (60 с). | TTL = 3 × `intervalSec` коллектора-источника; карта «метрика → интервал» строится из самих объектов коллекторов (единый источник интервала). |
| C3 WPF | `planningActivity.ts` (см. выше); writers: `planEntry.service.ts::createFromDraft`, `manualPlanEntry.service.ts::createManualPlanEntry`, `plan.service.ts::addArticlePlanItem` — создают `PlanItem` без `PLAN_ADD`. | Union: `PlanItem.createdAt` для всех записей; `SAVE` убрать (остаётся отдельной метрикой «Сохранения»). |
| C4 W1/W4 | `retention.ts` — дневные когорты, окна [D+2, D+7] / [D+22, D+30]; `MIN_RATE_SAMPLE = 30` в `growthDashboardViewModel.ts`. | Недельные ISO-когорты по Минску, удержание на неделе N+1 / N+4, сэмплы размера когорты; процент скрывается при n < 30. |
| C5 habit | `habit.ts` + `getEligiblePlanningFamilies(before)` (все когда-либо активированные). | Параметр «с» в `getEligiblePlanningFamilies`: первое действие в 8 неделях до начала окна (решение 4). |
| C6 supply | `supplyHealth.ts` | `getPublicListingActivityWhere` (+ `type=EVENT`), `getPublicPublishedPlaceWhere`, `getPublicPublishedOfferWhere`. |
| C7 спарклайны | `metricProjection.ts::weeklyHistory` + `bucketLastValuePerWeek` (текущая неделя — «на сейчас»), `Sparkline` в `growthFormat.tsx`. | Текущую ISO-неделю не рисовать (отбрасывать при проекции). |

### Блок D. Раздел Analytics (PR 6–7)

| Пункт | Найденный код | Решение |
| --- | --- | --- |
| D1–D3 Сегменты | `analyticsSegments.service.ts`: тренды/графики/средние из `UserBehaviorProfile` (`lastSeenAt`, lifetime `total*`). Членство в сегменте — `UserBehaviorProfile.segmentKeys` (`getUserIdsInSegment`). | Членство оставляем из профиля; активность, тренды, дневной график и средние — из `UserEvent` за окно (с исключением внутреннего трафика). prev = 0 → `null` («—»). |
| D4 Категории | `categoryFromProfiles` — вес предпочтений × lifetime-тоталы. `SemanticEventContextService` пишет `meta.categoryIds` для сильных событий по EVENT. | Реальные события по `meta.categoryIds` за период (DETAIL_OPEN/SAVE/PLAN_ADD); `CARD_VIEW` категорий не несёт — колонка «Показы» для категорий не показывается. |
| D5 ageBand / деление на 0 | `ageBandStats` — `findMany` всех событий в память; `planningProfileStats` делит на `profiles.length`, который может быть 0. | SQL-агрегация с `youngestChildBirthByUser` → `VALUES`-join; защита от 0 → `null`. |
| D6 фильтры Обзора | `analyticsOverview.service.ts` не вызывает `resolveAnalyticsAllowedUserIds`. | Применить общий хелпер. |
| D7 доли Обзора | `planRate = planAdds / saves`, воронка — доли от «просмотров + показов». | Доли от уникальных визиторов, открывших карточку (как `engagementFunnel.ts`). |
| D8 Воронки | `analyticsFunnels.service.ts` — отношения количеств событий (> 100%), CTA после Plan. | Пользовательская упорядоченная воронка по образцу `engagementFunnel.ts`; CTA — отдельная ветка от «Открыли». |
| D9 Контент | `analyticsContentPerformance.service.ts`: `views` = PAGE_VIEW+CARD_VIEW по сущности (фактически CARD_VIEW). Тест: `analyticsContentPerformance.service.test.ts`. | Колонки «Показы в ленте», «Открытия», «Сохранения», «В план», «CTA»; CTR = открытия / показы. Тест обновить. |
| D10 дубли | см. §1 | Удалить копии из `analyticsBehavior.service.ts` и `analyticsOverview.service.ts`. |

### Блок E. Русификация (PR 8–10)

| Пункт | Найденный код | Решение |
| --- | --- | --- |
| Словари enum | Разрозненные: `moderationContentStatusBadges.ts`, `moderationOfferStatusBadges.ts`, `ctaTargetActionLabels.ts`, `segmentCatalog.ts`, локальные `Record<…, string>` в компонентах. | Новый `lib/admin/labels.ru.ts` (статусы, типы событий, роли, типы сущностей, вертикали, каналы); существующие русские словари — переиспользовать/реэкспортировать, не дублировать. |
| Навигация | `components/admin/AdminNav.tsx` — `MODERATION_NAV_EN` подменяет русские подписи из `moderationSidebarConfig.ts`; заголовки секций по-английски. | Удалить словарь, брать `item.label`; заголовки — по словарю терминов. |
| Даты / числа | ~39 мест с `toLocaleString()` без локали / `en-CA` в admin/analytics. | Общий форматтер `ru-RU` + `Europe/Minsk`; склонения — `pluralRu.ts`. |
| Скрипт-проверка | Аналогов нет (есть `design-system-audit.mjs` как образец node-скрипта с тестом). | `scripts/admin-i18n-check.mjs` + белый список + baseline оставшегося долга; в CI для admin-папок. |

## 3. Прочее, найденное аудитом

- `getTrafficViewModel.ts` (блок Traffic, сейчас отключён в `dashboardBlocks.ts`) уже на `computeCanonicalAudience` — не трогаем.
- `continuousReadingAnalytics.ts` пишет DETAIL_OPEN для статей с клиента после 2 с видимости (`article_view`). На страницах статей до сих пор стоял ещё и серверный бикон — то есть статьи получали 2 открытия. Поведение «бикон + article_view» сохраняем (заменяем только серверный на клиентский) — см. решения PR 1.
- `engagementFunnel.ts` и `funnel.ts` считают по всем ролям; B1 добавляет исключение в `engagementFunnel.ts` (так требует ТЗ); `funnel.ts` (сырые 15-минутные счётчики Operations) не трогаем.
- Миграции применяются вручную (`prisma migrate deploy`), Prisma `migrate dev`/`db push` запрещены — новая колонка `UserEvent.clientClass` пишется рукописным SQL.

## 4. Отложено в backlog (оформляется в профильных PR)

- Кабинет бизнеса и отчёты по бусту (`businessWorkspace.service.ts`, `boostPerformance.service.ts`, `dailyFreeBoost.service.ts`) на новые определения — решение 1, PR 1.
- Настоящие 30-минутные сессии вместо «Устройств» — решение 2, PR 2.

## 5. Проверки в этой среде

- Prisma-движки (`binaries.prisma.sh`) недоступны через прокси: клиент сгенерирован с заглушками движков (типы корректны, `tsc` работает).
- Интеграционные тесты гоняются на локальном PostgreSQL 16 с миграциями, применёнными через `psql`, и Prisma Client с driver adapter `@prisma/adapter-pg` во временной обвязке вне репозитория (код репозитория не меняется). Где это невозможно — указано в PR.
