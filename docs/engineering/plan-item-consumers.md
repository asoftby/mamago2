# Инвентарь потребителей `PlanItem`

Статус: снимок для PR1 «Foundation» («Отправить в mamaGo», спека `docs/specs/forward-to-plan-spec-v1.2.md`, разделы 6 и 12).
База: `origin/dev` @ `fe0ede5c`. Строки `файл:строка` относятся к этой базе; перед правкой файла перечитывать актуальное состояние.

Документ питает PR5 (UI записи бота) и PR8 (уведомления). Только факты по коду.

## Как искать (охват)

Поиск `planItem|PlanItem|planItems` по `src`, `scripts`, `lib`, `emails`, `prisma/seed*`, `prisma/schema.prisma`, сырые SQL (`$queryRaw|$executeRaw`), админка (`src/app/admin`), Operations Center (`src/server/ops`), sitemap, `public/`.
Исключено как однофамильцы: `MigrationPlanItem` и «execution plan» в `src/lib/migration/**`, `scripts/migration-*` (отдельный тип миграционного движка, к `PlanItem` не относится).

- Сиды (`prisma/seed*.ts`, `prisma/seed/*`): **НЕ НАЙДЕНО** (искал `planItem|PlanItem`).
- Sitemap / `public/`: **НЕ НАЙДЕНО**.
- Operations Center (`src/server/ops`): **НЕ НАЙДЕНО**.
- Единственный «экспорт»: `GET /api/me/export` (строка в разделе 3).

## Обозначения

- **Фильтр `cancelledAt: null`**: «да» = пользовательское чтение/счёт, где отменённая запись не должна быть видна; «нет» = не нужен (с причиной).
- **Действие**: PR1 (в этом PR) / PR5 (UI) / PR8 (уведомления) / PR9 (privacy/purge) / не требуется.
- Состояние БД до PR4: строк с `source != CATALOG` и `cancelledAt != null` нет, поэтому фильтр `cancelledAt: null` ни на что не влияет сегодня.

## 1. Ядро: `plan.service.ts` (чтение и запись)

| Место | Что делает | Неявные допущения | `cancelledAt: null` | Действие |
|---|---|---|---|---|
| `src/server/services/plan.service.ts:114-130` `countPlanUsersByActivity` | чтение: `distinct (activityId,userId)` по `activityId in` | только каталожные (`activityId`); бот-записи с `activityId=null` не попадают | нет: без каталожной ссылки запись по определению не найдена; отменённые каталожные невозможны | не требуется |
| `plan.service.ts:146-176` `addPlanItem` | запись: дедуп `{userId, activityId}` → `update`/`create` | «одна запись на `activityId`», перезаписывает `date/startsAt/title/coverImageUrl` | нет (запись каталога не меняем) | не требуется (спека §6.1: не трогать) |
| `plan.service.ts:179-214` `addRoutePlanItem` | запись: дедуп `{userId, routeId}` | route-only запись | нет | не требуется |
| `plan.service.ts:281-330` `addPlacePlanItem` | запись: дедуп `{userId, placeId}`, `placeId`=сохранённый визит | `placeId` = «PlanItem это визит в место», не место события | нет | не требуется; `venuePlaceId` сюда не попадает |
| `plan.service.ts:351-398` `addArticlePlanItem` | запись: дедуп `{userId, articleId}` | экспортирована, но вызывающего кода не найдено (`api/save/plan` отклоняет `articleId` 400: `route.ts:98-104`) | нет | не требуется |
| `plan.service.ts:408-419` `listArticlePlanItemsBatch` | чтение: по `articleId in` | только статьи | нет (каталожная ссылка) | не требуется |
| `plan.service.ts:423-432` `removePlanItem` | запись: `deleteMany {id, userId}` | удаляет любую запись владельца, включая бот-записи | нет | не требуется (удаление бот-записи пользователем допустимо; требует решения PR5: удалять или отменять) |
| `plan.service.ts:438-453` `listPlanItemsByWeek` | чтение пользовательское (неделя) | `include activity` (null допустим) | **да** | PR1 |
| `plan.service.ts:459-469` `listAllPlanItems` | чтение пользовательское (все) | то же | **да** | PR1 |
| `plan.service.ts:473-492` `listUpcomingPlanItems` | чтение пользовательское (90 дней) | то же | **да** | PR1 |
| `plan.service.ts:495-511` `listPlanItemsInRange` | чтение пользовательское (диапазон) | то же | **да** | PR1 |
| `plan.service.ts:512-523` `listPlanItemsByDate` | чтение пользовательское (день) | то же | **да** | PR1 |
| `plan.service.ts:525-542` `listPlanItemsDueForReminder` | чтение job: `activityId != null` и `startsAt` в окне | **бот-записи исключены `activityId: { not: null }`** | **да** (защитно) | PR1: фильтр; PR8: расширить на `source = TELEGRAM_FORWARD` |
| `plan.service.ts:579-592` `listPlanItemsForTomorrowDigest` | чтение job: `date` + `activityId != null` | то же; вызывающего кода не найдено (только определение) | **да** (защитно) | PR1: фильтр |
| `plan.service.ts:594-607` `listPlanItemsForUserDates` | чтение job дайджеста: `OR {userId,date}`, **без** фильтра `activityId` | бот-запись попадёт в дайджест как есть; `eventTitle = activity?.title ?? title ?? "Активность"` (`run-plan-tomorrow-digests-core.ts:104`) — защищено от `null`; отменённая запись попала бы в дайджест | **да** | PR1: фильтр; PR8: BRING/requirements в тексте |

## 2. Сценарий дня, API и страницы плана

| Место | Что делает | Неявные допущения | `cancelledAt: null` | Действие |
|---|---|---|---|---|
| `src/server/services/dayScenario.service.ts:80-120` `listPlanItemsByDateForScenario` | чтение: `{userId,date}` + сессии активности | `item.activity` может быть null (обработано `item.activity ? … : null`, `:111-116`) | **да** | PR1: фильтр; PR5: проверить таймлайн для бот-записи |
| `dayScenario.service.ts:128-` `listActivitySessionsForPlanItems` | вход: массив `{activityId,date}` | «Items without an activityId are skipped» (комментарий) | нет (чистая функция по вводу) | не требуется |
| `dayScenario.service.ts:168-186` `computePlanFingerprint` | хэш набора (id, `activityId`, `routeId`, `placeId`, `articleId`, `date`, `startsAt`, override) | **не включает** `source`, `cancelledAt`, `venuePlaceId`: отмена бот-записи не меняет fingerprint (сценарий не станет «изменился») | косвенно: вход уже без отменённых после фильтров | PR5/PR7: решить, включать ли `cancelledAt/source` в fingerprint |
| `dayScenario.service.ts:292-298` `upsertScenarioItemOverride` | чтение `findFirst {id,userId,date}` | по id | нет (адресный поиск) | не требуется |
| `src/app/api/plan/scenario/route.ts:82-90` `loadCanonical` | чтение в транзакции: `{userId,date}` + `activity` | `row.activity?.…` (`:105-120`), `title` с fallback `"Активность"` | **да** | PR1: фильтр |
| `scenario/route.ts:170-175` | чтение дубля `{userId,activityId,id≠}` | только каталог | нет | не требуется |
| `scenario/route.ts:185-196` | запись: `update` замена активности; `deleteMany {userId,date,id in}` | замена только в рамках существующей записи | нет | PR5: убедиться, что «замена» не применяется к бот-записи (требует `activityId` через `OCCURRENCE_REQUIRED`) |
| `src/app/(public)/[city]/my-plan/[date]/scenario/page.tsx:87` | чтение через `listPlanItemsByDateForScenario` | — | через сервис | PR5 |
| `src/app/(public)/[city]/my-plan/[date]/scenario/actions.ts:65` | чтение `listPlanItemsByDate` | — | через сервис | PR5 |
| `src/app/api/save/plan/day/route.ts:18` | чтение `listPlanItemsByDate` → JSON `items` | JSON отдаёт **все поля** `PlanItem` (включая будущие `notes`, `priceAmount`, `inboxItemId`) клиенту владельца | через сервис | PR5: оценить, какие новые поля отдавать |
| `src/app/api/save/plan/summary/route.ts:29` | чтение `listPlanItemsInRange`, счёт по датам, `nextPlanItem.title` | `title ?? activity?.title ?? null` | через сервис | не требуется |
| `src/app/api/save/plan/upcoming/route.ts:19` | чтение `listUpcomingPlanItems` → JSON | как `day` | через сервис | PR5 |
| `src/app/api/save/plan/route.ts:303-312` (DELETE) | чтение `findFirst {id,userId}` + `removePlanItem` | берёт `activityId/placeId/routeId/date` для аналитики | нет | PR5: решить «удалить или отменить» для `source != CATALOG` |
| `src/app/api/save/plan/route.ts:35-` (POST) | запись через `addPlanItem/addRoutePlanItem/addPlacePlanItem` | требует `activityId` или `routeId` или `placeId` (`:109-114`); `articleId` отклоняется | нет | не требуется (ручной ввод позже идёт через `planEntry.service`) |
| `src/app/api/plan/routes/route.ts:25` | запись `addRoutePlanItem` | route | нет | не требуется |
| `src/app/(public)/me/plan/page.tsx:21,104-140` | чтение `listAllPlanItems`, fingerprint, сериализация | `item.activity ? … : null`; **`planAvailability = getPlanActivityPublicAvailability(item.activity)` → для `activity = null` возвращает `"missing_activity"`** (`src/lib/plan/publicVisibility.ts:12`) | через сервис | PR5 (риск ниже) |
| `src/app/(public)/me/page.tsx:83-84` | чтение `listPlanItemsByWeek`; `groupPlanItemsByDate` | результат группировки не используется (вызов без присваивания) | через сервис | не требуется |
| `src/app/(public)/me/day/[date]/page.tsx:27,63-65` | чтение `listPlanItemsByDate`; `unavailable` при `missing_activity` | то же допущение, что и `PlanItemCard` | через сервис | PR5 |
| `src/app/(public)/me/ideas/page.tsx:276-300` | чтение: `{userId, OR [activityId in, routeId in]}` | ищет совпадения с идеями; бот-записи не совпадут | нет (по каталожным id) | не требуется |
| `src/app/api/save/ideas/route.ts:76-84` | чтение `{userId, activityId in, date?}` | каталог | нет | не требуется |
| `src/app/api/save/status/route.ts:42,67,114` | чтение по `articleId` / `placeId` / `activityId` | `activityId!` (`:111,115`) — non-null assertion после валидации входа; относится к входному параметру, не к строке БД | нет (каталожные id) | не требуется |
| `src/app/api/save/status/articles/route.ts:51-66` | чтение через `listArticlePlanItemsBatch` | `if (!item.articleId) continue` | нет | не требуется |
| `src/app/api/plan/suggestions/route.ts:62-70`, `src/app/api/plan/generate/route.ts:51-59` | чтение `{userId,date,activityId≠null}` → исключения из рекомендаций | только `activityId` | нет (но косвенно: отменённые записи имеют `activityId = null`) | не требуется |
| `src/app/api/me/export/route.ts:32-50` | чтение `{userId}` все записи; выборка `id,date,startsAt,createdAt,title,coverImageUrl,activityId,routeId,planRouteSlug,activity{…}` | **экспорт данных пользователя**: новые поля (`source`, `notes`, `locationText`, `priceAmount`, `arriveAt`, `endsAt`, `dueAt`, `cancelledAt`, requirements) не включены | **нет** (экспорт «всех данных»: отменённые включать) | PR9 (приватность): расширить выборку |
| `src/server/account/deleteAccount.service.ts:95` | запись: `planItem.deleteMany {userId}` | порядок: удаляет `PlanItem` до пользователя; `PlanItemRequirement` удаляется каскадом, `InboxItem` каскадом от `User` | нет | PR2/PR9: проверить в `deleteAccount.integration.test.ts` каскад на новые таблицы |

### Добавлено из `origin/dev` @ `334b959c..` (feedback loop «Experience», влито в ветку PR1)

| Место | Что делает | Неявные допущения | `cancelledAt: null` | Действие |
|---|---|---|---|---|
| `src/server/services/experience/experience.service.ts:52` | чтение: заголовки по `id in` + `userId` для сводки опыта | адресный поиск; `activity?.title \|\| title \|\| "Событие"` | нет (по id) | не требуется |
| `experience.service.ts:102` `listPendingExperienceCandidates` | чтение пользовательское: прошедшие записи за 14 дней с `activityId != null` для чек-ина «были ли» | только каталожные записи | **да** | PR1: фильтр (добавлен) |
| `experience.service.ts:308` | чтение `findFirst {id,userId}` при подтверждении посещения | `if (!planItem.activityId) throw unsupported_entity` — записи бота не поддерживаются (ожидаемо до Stage 1.5) | нет (по id) | не требуется; решить в PR5/PR7, нужен ли чек-ин для записей бота |
| `src/server/services/planOccurrence.service.ts:16` `resolvePlanActivityOccurrence` | чтение: до 25 записей `{userId, activityId}` для дедупа «update/create/completed_same_date» (вызывается из `addPlanItem`) | каталожный дедуп по `activityId` | нет (каталог) | не требуется |
| `src/app/(public)/me/plan/ExperienceCheckIn.tsx`, `PlanPageClient.tsx`, `src/app/api/plan/experiences/**` | клиент и API чек-ина | работают с `Experience` (`sourcePlanItemId` — простая ссылка без FK, переживает удаление `PlanItem`) | нет | PR5: убедиться, что отмена бот-записи не создаёт «висящий» чек-ин |

## 3. Уведомления, дайджесты, напоминания

| Место | Что делает | Неявные допущения | `cancelledAt: null` | Действие |
|---|---|---|---|---|
| `src/server/notifications/jobs/run-plan-event-reminders-core.ts:94-130` | чтение кандидатов `listPlanItemsDueForReminder`; `dueAt = startsAt − offset`; `eventTitle = activity?.title ?? title ?? "Событие"` | кандидаты всегда с `activityId`; для бот-записей нужно `source = TELEGRAM_FORWARD` | через сервис | PR8 |
| `src/server/notifications/notification.service.ts:80-95` `resolveNotificationEventId` | `dedupeKey` = `context.activityId ?? context.planItemId` | `activityId` может быть null → ключ по `planItemId` (уже поддержано) | нет | PR8 |
| `src/server/notifications/jobs/run-plan-tomorrow-digests-core.ts:68-110` | чтение `listPlanItemsForUserDatesFn`; сортировка по `startsAt` (null → в конец) | `activityId: item.activityId` в контексте (может быть null); `placeName` через `activity.place/venue` → для бот-записи пусто | через сервис | PR8: `locationText`, BRING |
| `src/server/notifications/in-app-delivery.ts:46-91,208-216` | `planItemId`/`planItemIds` как `entityId`/метаданные | идентификаторы, без чтения `PlanItem` | нет | не требуется |
| `src/lib/notifications/domainContracts.ts:42-63` | типы контекста (`planItemId: string; activityId: string \| null`) | — | нет | PR8 |
| `src/lib/plan/getPlanReminderLabel.ts:115` / `src/components/plan/PlanReminderCaption.tsx` | подпись «напомним…» по `planDate/planStartsAt` | не читает БД | нет | PR5 |
| `src/app/admin/communications/scenarios/[key]/page.tsx:67-86`, `src/app/api/admin/communications/scenarios/[key]/test/route.ts` | синтетический preview-контекст (`planItemId: "preview"`) | не читает БД | нет | PR8: если добавится сценарий `PLAN_REQUIREMENT_DUE` |

## 4. Админка, зависимости контента, скрипты, сырой SQL

| Место | Что делает | Неявные допущения | `cancelledAt: null` | Действие |
|---|---|---|---|---|
| `src/server/services/contentDependencySummary.service.ts:605-612` | `planItem.groupBy activityId` (`_count`) | счёт по каталожному `activityId`; `activityId != null` фильтруется после | нет (каталог) | не требуется |
| `contentDependencySummary.service.ts:48,99,168,314,414,459,585,632` | `planItems` как блокирующая зависимость (`blocking: counts.planItems > 0`) | считает каталожные записи; отменённые бот-записи без `activityId` не учитываются | нет | не требуется |
| `src/server/services/contentLifecycleOperation.service.ts:273,292` | `route._count.planItems` | связь `Route.planItems` | нет | не требуется |
| `src/app/admin/content/routes/page.tsx:108-126` | `_count.planItems` для маршрута | — | нет | не требуется |
| `src/app/api/admin/places/[id]/route.ts:136` | `_count.planItems` (связь `Place.planItems` по `placeId`) | блокирует удаление места. Новая связь `venuePlanItems` (`onDelete: SetNull`) в счёт **не** попадёт | нет | PR1: ничего (SetNull безопасен); при желании добавить в счёт — отдельное решение |
| `src/lib/admin/contentDependencySummary.ts:69` | текст причины «planItems» | — | нет | не требуется |
| `src/server/services/analytics/planningActivity.ts:58,73` (сырой SQL) | `SELECT "userId","createdAt" FROM "PlanItem" WHERE "routeId" IS NOT NULL …` (WPF-метрика) | считает только route-записи; бот-записи не влияют | нет (фильтр по `routeId`) | не требуется; PR9: решить, считать ли capture в WPF |
| `src/lib/admin/metricDictionary.ts:82-83` | описание метрики `planning.wpf` | — | нет | не требуется |
| `scripts/repair-event-session-timezones.ts:121-170` | read+write: `{activityId, startsAt≠null, date in}` → `update startsAt` | только каталожные | нет | не требуется |
| `src/lib/my-plan/planItemTimezoneRepair.ts` | чистая функция | — | нет | не требуется |
| `prisma/seed*.ts`, `prisma/seed/*` | — | **НЕ НАЙДЕНО** | — | — |

## 5. Клиент: типы, хуки, компоненты

Общий тип `PlanItemWithActivity` (`plan.service.ts:52-105`) — ядро клиентского контракта; новые поля в него не добавляются в PR1 (PR5).

| Место | Что делает | Неявные допущения | Действие |
|---|---|---|---|
| `src/features/my-plan/types/event.ts:2` | реэкспорт `PlanItemWithActivity` | — | PR5 |
| `src/features/my-plan/lib/normalizePlanItemFromApi.ts:4-17` | `startsAt`, `createdAt` → `Date`; остальные поля как есть | прокинет новые поля как есть | PR5 |
| `src/features/my-plan/hooks/useMyPlan.tsx` (83 упоминания; `:151-163`, `:510`, `:603-659`, `:967`) | клиентское состояние плана по датам; POST `/api/save/plan` | `plannedItems: PlanItemWithActivity[]`; тип опирается на `activity` и каталожные id | PR5 |
| `src/features/my-plan/lib/upcomingPlanItems.ts:6-13` | ссылка: `activity → /activity`, иначе `planRouteSlug`, иначе `planPlaceSlug`, иначе `null` | **тип записи по заполненности** (не по `source`); без `activity` и slug возвращает `null` — бот-запись без ссылки безопасна | PR5 |
| `src/features/my-plan/components/UpcomingPlanBlock.tsx:10-15` | подпись типа: `planRouteSlug\|\|routeId → "Маршрут"`, `planPlaceSlug\|\|placeId → "Место"` | **определение типа по заполненности `routeId/placeId`**; `venuePlaceId` учитывать не должно | PR5 |
| `src/features/my-plan/components/RecommendationCard.tsx:113` | `isRoute = routeId \|\| planRouteSlug` | то же | PR5 |
| `src/features/me/components/PlanCard.tsx:158-185` | карточка: `activity?.title ?? item.title ?? "Активность"`; `unavailable = business_disabled \|\| missing_activity`; `routeHref` только по `planRouteSlug` | для записи без `activity` — «Снято с публикации» | PR5 |
| `src/app/(public)/me/plan/PlanItemCard.tsx:22-37` | карточка `/me/plan`: `unavailable` при `missing_activity`; `href` только при `activityId && !unavailable` | то же | PR5 |
| `src/app/(public)/me/plan/PlanPageClient.tsx:26`, `PlanDayList.tsx`, `PlanOverviewDialog.tsx`, `WeekCalendar.tsx`, `RecommendationsSection.tsx:62` | потребляют сериализованные элементы `/me/plan` (`planAvailability?`) | `RecommendationsSection` сам ставит `"missing_activity"` для синтетических | PR5 |
| `src/features/my-plan/components/PlanMainContent.tsx`, `ScenarioDraftEditor.tsx`, `ScenarioTimeline.tsx`, `scenarioTimelineParts.tsx`, `MyPlanPanelContent.tsx`, `MyPlanWidget.tsx`, `PlanItemRow.tsx`, `PlanRecommendationsBlock.tsx`, `PlanSuggestionsSheet.tsx`, `AssignScenarioTimeControl.tsx`, `GuestMyPlanPanel.tsx` | отрисовка и правка плана / сценария | `activityId: string \| null` уже допускается (`scenarioDraft.ts:6`); `scenarioDraft.ts:151` отсекает `activityId == null` в подборе замен | PR5 |
| `src/features/my-plan/lib/scenarioDraft.ts`, `scenarioProjection.ts`, `scenarioScheduling.ts`, `planItemMeta.ts`, `sortPlanItemsForDay.ts`, `planDateMarkers.ts`, `detectScenarioConflicts.ts`, `recommendationPool.ts` | чистая логика сценария/сортировки | `planItemMeta.ts:3` явно не опирается на `scheduleJson`; для записи без `activity` — ветки с `null` | PR5 |
| `src/features/me/components/TodayHeroCard.tsx` | показ записей на сегодня | `PlanItemWithActivity[]` | PR5 |
| `src/lib/my-plan/guestMyPlanDraftStorage.ts`, `migrateGuestMyPlanAfterAuth.ts` | гостевой черновик плана в localStorage, перенос после входа | свой тип; на `source` не влияет | не требуется |
| `src/features/save/*`, `src/components/activity/SaveToPlanModal.tsx`, `src/hooks/useAddScenarioPlan.ts`, `src/components/routes/RouteCard.tsx`, `src/components/event-page/*`, `src/components/onboarding/SaveEventOnboarding.tsx` | клиенты `POST /api/save/plan` (запись каталожных) | каталожные | не требуется |

## 6. Тесты, затрагивающие `PlanItem`

Файлы (сгруппировано), которые могут потребовать правок, если меняются фильтры/типы:

- сервисы: `src/server/services/dayScenario.service.test.ts`, `src/server/services/articleSaveActions.test.ts`, `src/server/services/contentLifecycleOperation.service.test.ts`, `src/server/services/analytics/planningActivity.integration.test.ts`;
- API: `src/app/api/plan/scenario/route.integration.test.ts`, `src/app/api/save/status/route.test.ts`;
- уведомления: `src/server/notifications/jobs/run-plan-event-reminders.test.ts`, `run-plan-tomorrow-digests.test.ts`, `src/server/notifications/notification-renderer.test.ts`, `notification.service.test.ts`;
- аккаунт: `src/server/account/deleteAccount.integration.test.ts`, `deleteAccountWiring.test.ts`;
- клиент: `src/features/my-plan/lib/*.test.ts` (`planItemMeta`, `planDateMarkers`, `scenarioDraft`, `scenarioProjection`, `upcomingPlanItems`, `sortPlanItemsForDay`, `detectScenarioConflicts`), `src/features/my-plan/components/PlanItemRow.test.tsx`, `scenarioTimelineParts.test.tsx`, `src/components/activity/SaveToPlanModal.test.tsx`, `src/features/save/*.test.ts`, `src/lib/my-plan/*.test.ts`, `src/lib/plan/resolveActivityParticipationCta.abwsTicketLink.test.ts`, `src/lib/decision/decisionAttribution.integration.test.ts`.
- `src/lib/migration/**` тесты: однофамильцы (`MigrationPlanItem`), не относятся.

## 7. Код, определяющий тип записи по заполненности `placeId / activityId / routeId / articleId`

`venuePlaceId` на эти определения влиять **не должен**. Найдено:

| Место | Определение |
|---|---|
| `src/features/my-plan/components/UpcomingPlanBlock.tsx:10-15` | `planRouteSlug\|\|routeId` → «Маршрут»; `planPlaceSlug\|\|placeId` → «Место» |
| `src/features/my-plan/lib/upcomingPlanItems.ts:6-13` | `activity` → событие; `planRouteSlug` → маршрут; `planPlaceSlug` → место |
| `src/features/my-plan/components/RecommendationCard.tsx:113` | `isRoute = routeId \|\| planRouteSlug` |
| `src/features/me/components/PlanCard.tsx:164` | `!activity?.id && planRouteSlug` → ссылка на маршрут |
| `src/app/(public)/me/plan/PlanItemCard.tsx:35-38` | `activityId && !unavailable` → ссылка на событие |
| `src/app/(public)/me/ideas/page.tsx:293-296` | группировка запланированных по `routeId` |
| `src/server/services/dayScenario.service.ts:168-186` `computePlanFingerprint` | в отпечаток входят `activityId/routeId/placeId/articleId` |
| `src/app/api/save/plan/route.ts:109-114` | валидация: нужен `activityId \|\| routeId \|\| placeId` |
| `src/server/services/analytics/planningActivity.ts:58,73` | `"routeId" IS NOT NULL` — признак route-записи |
| `src/server/services/plan.service.ts:156-165,189-199,296-308,365-377` | дедуп по `{userId, activityId \| routeId \| placeId \| articleId}` |

Поиск был по выражениям `(item\|row\|planItem)\.(placeId\|routeId\|articleId\|planRouteSlug\|planPlaceSlug)` и `\b(placeId\|routeId\|articleId)\s*(!=\|==\|\?\|&&\|\|\|)` в `src/features/my-plan`, `src/features/me`, `src/app/(public)/me`, `src/app/api/plan`, `src/app/api/save`, `src/lib/plan`, `src/lib/my-plan`, `src/lib/decision`, `src/components/plan`, `dayScenario.service.ts`. Другие места могли остаться вне этого списка путей; для PR5 повторить поиск по всему `src` перед правкой UI.

## 8. Итоги

- Потребителей: 12 чтений в `plan.service.ts` и 5 записей; ещё ~20 DB-мест (API, страницы, jobs, аналитика, админка, скрипты) и ~40 клиентских файлов. Тестовых файлов с `PlanItem`: ~25 (без `src/lib/migration/**`).
- Фильтр `cancelledAt: null` в PR1: `plan.service.ts` (`listPlanItemsByWeek`, `listAllPlanItems`, `listUpcomingPlanItems`, `listPlanItemsInRange`, `listPlanItemsByDate`, `listPlanItemsDueForReminder`, `listPlanItemsForTomorrowDigest`, `listPlanItemsForUserDates`), `dayScenario.service.ts` (`listPlanItemsByDateForScenario`), `api/plan/scenario/route.ts` (`loadCanonical`).
- Самые рискованные для PR5: `getPlanActivityPublicAvailability(null)` возвращает `"missing_activity"`, и все три карточки (`PlanItemCard`, `PlanCard`, `me/day/[date]/page.tsx`) помечают такую запись «Снято с публикации»; для записи бота нужен отдельный путь. Для PR8: `listPlanItemsDueForReminder` исключает записи без `activityId`; `listPlanItemsForUserDates` их включает (дайджест уже безопасен по `null`).
- Из UI-решений для PR5 зафиксировано: «удалить или отменить» для `DELETE /api/save/plan`; поля отпечатка сценария (`source`, `cancelledAt`); какие новые поля отдавать в `/api/save/plan/{day,upcoming}`.
- Прямых небезопасных non-null assertion на `activityId` строки БД не найдено: `activityId!` в `api/save/status/route.ts:111,115` относится к входному параметру запроса.
