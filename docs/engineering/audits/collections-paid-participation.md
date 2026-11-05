# Аудит: «Платное участие в подборках» (Этап 0, read-only)

- Базовый SHA: `0b22fc9e2ede17c9fe9059b6422adebaf5a98084` (`origin/dev`, 2026-11-05).
- Метод: чтение кода и миграций. Код, миграции и БД не менялись.
- **Не выполнено:** п. 9 по prod-данным. Доступа к prod БД у агента нет, подключаться с имеющимися `.env` без вашего решения не стал. Вместо этого дан SQL-пакет (раздел 8).
- Все выводы про наличие и отсутствие проверены по коду на указанном SHA. Измерений производительности нет.

## 0. Главные находки (читать первыми)

1. **`CollectionItem` в задаче названа неверно.** `CollectionItem` и `Collection` — это личные доски пользователя в «Моих идеях» (`prisma/schema.prisma:7152-7191`). К редакционным подборкам они отношения не имеют. Редакционная подборка — это `Article.publicationType = COLLECTION` плюс `ArticleLinkedItem` (`schema.prisma:3707-3727`). Модель участия нужно привязывать к `ArticleLinkedItem`. Комментарий в схеме прямо говорит: «`position` — редакторский порядок (основа под будущую продажу мест в подборках)».
2. **`rankForFamily` — это не движок ранжирования.** Это 17-строчная стабильная сортировка по переданной функции score (`src/lib/discovery/rankForFamily.ts`). Применить её к заданному набору ID можно, но функцию score для подборки придётся писать с нуля. Блок «Для вашей семьи» (`familyPicks`) устроен отдельно (`src/server/services/recommendations/familyPicks/*`) и работает по окнам дат, а не по заданному набору.
3. **Рейтинг Feedback 5★ в ранжировании не участвует.** `FeedbackReputationAggregate.rankScore` есть, но читают его только сервисы плана и репутации мест (`placeReputation.service.ts`, `api/plan/experiences`). Документ `family-picks-pr1.md` пишет: «Feedback remains outside this release». Критерий «рейтинг ниже порога скрывает размещение» пока опирается на данные, которые нигде не используются при ранжировании.
4. **Страница статьи `force-dynamic`** (`src/app/(public)/[city]/blog/[slug]/page.tsx:46`), не ISR. Гость и бот получают SSR-HTML на каждый запрос. Персональный порядок для семьи на клиенте возможен без потери SEO, но нагрузка на hot path уже динамическая. См. риск R4.
5. **Уже существует коммерческий слой**, который по смыслу покрывает «оплата по УНП и сроки»: `CommercialCounterparty(unp)`, `BusinessContract` (+`Item`, суммы, сроки, `autoRenew`), `BusinessServicePlacement(entityType, entityId, startsAt, endsAt, status)`, `CommercialNotification` (`*_EXPIRING/EXPIRED`). Но: автогенерации счёта в кабинете нет, зачисления по выписке нет, а сервис `commercialNotifications.service.ts` не имеет вызовов из планировщика (нашёл вызов только на админской странице чтения). Это заготовка, а не работающий контур.
6. **Исходящая воронка частично есть:** `EditorialRequest` (тема, город, `criteria` JSON) и `editorialRequestMatchingService` подбирают бизнесы и их публичные Offer по сигналам и чипам занятий. Он возвращает телефон и email владельца для ручной связи. Приглашения в кабинет и бот нет.

## 1. Таблица «компонент → статус → путь → решение»

| # | Компонент | Статус | Путь | Решение |
|---|---|---|---|---|
| 1.1 | Подборка как тип статьи | есть | `Article.publicationType` (`schema.prisma:3694`), `src/lib/journal/publicationType.ts`, миграция `20261028120000_article_publication_type` | Переиспользовать |
| 1.2 | Элементы подборки | есть | `ArticleLinkedItem`: kind EVENT/OFFER/ARTICLE, `position`, CHECK «ровно один FK», partial unique `(articleId, offerId)`, `@@unique([articleId, position])` | Расширить. Новую сущность «карточка подборки» не нужна. |
| 1.3 | Валидация ≥3 | есть | `COLLECTION_MIN_ITEMS = 3`, `assertCollectionItemCount` в `publicationType.ts`; вызывается на create/update/publish в `articleAdminService.ts` | Переиспользовать. Новое правило «≤ slots» добавить рядом. |
| 1.4 | `slots` («10 мест» из заголовка) | **нет** | В схеме поля нет | Новое поле `Article.collectionSlots Int?` (нужно явное значение, из заголовка парсить нельзя) |
| 1.5 | Платная квота = slots − редакционные | нет | — | Вычисляемая величина, хранить не нужно |
| 1.6 | Админка подборки | есть | `ArticleEditorClient.tsx`, `ArticleLinkedItemsEditor.tsx` (drag-n-drop, поиск через `/api/admin/content/entity-search`) | Расширить: slots, статусы участия, hook |
| 1.7 | Страница подборки | частично | `[city]/blog/[slug]/page.tsx`, `/blog/[slug]/page.tsx`, данные `articleMvpRenderData.ts:515-560`. `force-dynamic`. Элементы превращаются в синтетические `activityCard` в порядке `position`; скрытые (`!block.card`) молча отфильтровываются | Расширить |
| 1.8 | JSON-LD подборки | частично | `buildArticleJsonLd` (тип Article); `ItemList` есть только в `buildRouteJsonLd.ts` для маршрутов | Добавить `ItemList` по элементам подборки в SSR |
| 1.9 | Скрытие выбывших | есть | `getOfferHiddenReason` / `getPublicPublishedOfferWhere` (`src/lib/offers/offerVisibility.ts`, `src/server/public/publicContentVisibility.ts`) | Переиспользовать. Порог рейтинга — нет (см. 2.3). |
| 2.1 | `rankForFamily` | частично | `src/lib/discovery/rankForFamily.ts` (только сортировка), потребители `rankHomeByAudience.ts`, `personaRanking.ts` | Переиспользовать как примитив. Функцию score для подборки написать. |
| 2.2 | Блок «Для вашей семьи» | частично | `recommendations/familyPicks/*`, `api/recommendations/family-picks`; фильтр по возрасту `rankHomeByAudience` мягкий (match 100 000 / unknown 10 000 / mismatch 0) | Взять возрастную логику. Сам блок под порядок в подборке не подходит. |
| 2.3 | Рейтинг Feedback 5★ | частично (данные есть, в ранжирование не подключены) | `FeedbackReputationAggregate.rankScore`, `sharePositive` (`schema.prisma:7306`) | **Решение владельца:** подключать ли Feedback к этой фиче. Нейтральный скор новых объектов нигде не определён. |
| 2.4 | Влияние Boost | есть, надо изолировать | `Boost` (`schema.prisma:3071`), `BoostSettings`, `applyActivePublicationBoost` и фильтры в `kudaDiscoveryFeed.ts`, `classesDiscoveryFeed.ts`; `SearchDocument.boost` | Порядок подборки читает только `ArticleLinkedItem.position` и новую функцию score. Boost туда не попадает по построению. Добавить тест-контракт. |
| 2.5 | Стабильный порядок для гостя и бота | нет | сейчас порядок = `position` | Новый: редакционный score (рейтинг, заполненность, свежесть) + фиксированные legacy-позиции |
| 2.6 | Ротация по дневному seed | нет | — | Новое, чистая функция, без БД |
| 3.1 | Матчинг кандидатов по теме | частично | `editorialRequestMatchingService.ts` + `EditorialRequest.criteria`, админка `/admin/content/editorial-requests` | **Расширить:** добавить `articleId` (подборка) как источник критериев. Новый матчер не нужен. |
| 3.2 | Матчинг по территории | есть | `territoryScope.ts`, `resolveTerritoryCityIds` | Переиспользовать |
| 3.3 | Матчинг по возрасту | частично | `ageMapping.ts`, `agePolicy` у Offer | Использовать в score |
| 4.1 | Шаблоны и рендер | есть | `notificationRegistry.ts` (1143 строки, `NOTIFICATION_SCENARIO_REGISTRY`), `renderNotification` (`template-render.service.ts`), каналы IN_APP/EMAIL/TELEGRAM | Расширить: новые сценарии |
| 4.2 | Типы уведомлений | частично | enum `NotificationType` (`schema.prisma:4573`) | Добавить типы приглашения, заявки, оплаты, продления. Добавление значения enum — миграция. |
| 4.3 | Планировщик напоминаний | частично | `src/app/api/cron/*` (`plan-event-reminders`, `plan-tomorrow-digests` и др.), `src/server/notifications/jobs/*`, `bookingStale.job.ts` | Расширить: новый cron `collection-participation-reminders`. Модель «run-*-core.ts + route» уже есть. |
| 4.4 | Ежемесячный отчёт бизнесу | нет | — | Новый cron + сценарий |
| 4.5 | Коммерческие уведомления о сроках | частично (не подключены) | `CommercialNotification`, `commercialNotifications.service.ts` | **Выбор:** использовать эту таблицу или `NotificationType`. Предлагаю второе (единый путь доставки, настройки каналов), см. R6. |
| 5.1 | Реквизиты плательщика, УНП | есть | `BillingPayerProfile` (`schema.prisma:7667`), `CommercialCounterparty.unp`, `/business/billing/requisites` | Переиспользовать |
| 5.2 | Договоры, суммы, сроки | есть | `BusinessContract(+Item)`, админка `/admin/commercial/contracts` (wizard) | Переиспользовать как документ-основание |
| 5.3 | Самостоятельная генерация счёта в кабинете | **нет** | `/business/billing/documents` — страница списка документов, генерации счёта в коде не нашёл | Новое. См. вопрос В2. |
| 5.4 | Зачисление по выписке / УНП | **нет** | — | Первая версия: ручное подтверждение оплаты админом. Автозачисление — отдельная задача. |
| 5.5 | Платёж → сущность «участие», без баланса | частично | `BillingTransaction.referenceType/referenceId` есть, но `BillingReferenceType` не содержит нужного значения; транзакции завязаны на `BillingAccount.depositBalance` | Не использовать `BillingTransaction` (смешение с балансом запрещено моделью). Хранить оплату на самой сущности участия: `paidAt`, `invoiceNumber`, `contractId?`. |
| 5.6 | Срок размещения | частично | `BusinessServicePlacement` (`entityType: OFFER`, `startsAt/endsAt`) | Рассмотреть как носитель срока. Минусы: нет `collectionId`, `entityType` не про подборку. См. разбивку. |
| 6.1 | Кабинет бизнеса | есть | `src/app/business/(protected)/*`: `offers`, `promotion`, `analytics`, `billing`, `commercial`, `notifications` | Расширить: раздел «Подборки» |
| 6.2 | Блок «Подборки, куда вы подходите» | нет | — | Новый. Данные из 3.1 в обратном направлении (бизнес → подборки). |
| 6.3 | Бизнес-бот Telegram | частично | `businessTelegram.service.ts`, `businessTelegramDelivery.service.ts`, `/api/business/telegram/webhook`; доставка за флагом `TELEGRAM_BUSINESS_DELIVERY_ENABLED`, по умолчанию выключена; действия (callbacks) в бизнес-боте явно не реализованы | Только текстовые уведомления с CTA на сайт. Mini App для бизнеса не нашёл (есть `webAppButton.ts`, `verifyWebAppInitData.ts` для семейного контура). |
| 7.1 | Показы и клики по карточкам в подборке | частично | Пакетная телеметрия статьи `articlePerformanceAnalytics.ts` (`impression`, `action: card_open`, `blockId`, `catalogEntityId`); агрегация `articlePerformanceStats.service.ts` | Расширить: позиция в выдаче и сегмент (гость/семья) не передаются. Нужны `position` и `rankMode`. |
| 7.2 | Универсальные события | частично | `UserEvent.meta Json` (`schema.prisma:203`), `/api/analytics/events`, `analyticsMetaSchema` | Использовать только для заявок/сохранений. Показы остаются в cheap-батче статьи. |
| 7.3 | Заявки с контекстом подборки | нет | `Booking*`/`Lead` без источника «подборка» (не проверял детально поля источника) | Проверить в PR 3. |
| 8.1 | Модерация hook | частично | `OfferRevision` (`schema.prisma:2777`) привязан к Offer и хранит `payload` JSON; сервис `offerRevision.service.ts`, админ-роут `admin/moderation/offer-revisions` | Для hook **не подходит как есть**: hook принадлежит участию, а не Offer. Предлагаю модерацию на самой сущности участия (поле статуса размещения `PENDING_MODERATION`), без нового revision-слоя. |
| 8.2 | Очередь модерации в админке | есть | `admin/moderation/*` | Добавить вид «Участие в подборках» |
| 9 | Данные prod | **не проверено** | — | SQL-пакет в разделе 10 |

## 2. Конфликты утверждённой модели с кодом

- **К1.** Название `CollectionItem` (см. п. 0.1). Новые поля идут в `ArticleLinkedItem` или в рядом лежащую таблицу, не в личные доски.
- **К2.** «Бесплатные редакционные события занимают slot, но не коммерческую квоту.» Сейчас `ArticleLinkedItem.kind` бывает EVENT / OFFER / ARTICLE. Квота считается как `slots − count(kind ≠ платное OFFER)`. Для различения «платное» и «редакционное предложение» нужен флаг (см. ниже `isPaid` либо ссылка на участие).
- **К3.** `@@unique([articleId, position])`. Если legacy-позиция хранится как `position`, а порядок для пользователя вычисляется отдельно, два смысла `position` смешаются. Предлагаю: `position` остаётся редакторским порядком, `legacyPosition` отдельное поле, итоговый порядок вычисляется.
- **К4.** Сам `ArticleLinkedItem` требует ровно один FK и при удалении Offer делает **CASCADE** (`onDelete: Cascade`). Если бизнес удалил предложение в оплаченный срок, строка исчезнет вместе с участием. Модель требует «размещение скрывается, срок идёт», значит участие должно жить отдельно от строки и не каскадироваться (R2).
- **К5.** Порядок внутри подборки сейчас прибит к `position` на SSR. Персональный порядок надо делать на клиенте или в отдельном запросе с `private, no-store`. Иначе персональная выдача попадёт в общий кеш (требование CLAUDE.md про изоляцию семейных данных).
- **К6.** «Рейтинг ниже порога скрывает размещение» зависит от п. 0.3. Пока Feedback не в ранжировании, скрытие по рейтингу реализовать нельзя без отдельного решения.

## 3. Риски

| # | Риск | Мера |
|---|---|---|
| R1 | Путаница `CollectionItem` ↔ `ArticleLinkedItem` в брифах и PR | Исправить терминологию в задаче до начала |
| R2 | CASCADE при удалении Offer/Activity стирает оплаченное участие | Хранить участие в своей таблице с `onDelete: Restrict` или `SetNull` + снимок названия; удаление Offer с активным участием запретить в бизнес-API или предупреждать |
| R3 | Повторное использование `BillingTransaction` смешает продукт с балансом и Boost | Не использовать |
| R4 | `force-dynamic` + персональный порядок = нагрузка и риск утечки в кеш | Персональный порядок только через `private, no-store` API, SSR остаётся с редакционным порядком. Оценить число SQL до/после (измерение — в PR 4). |
| R5 | Рост `NotificationType` и миграции enum на живой БД | Одна миграция на все новые типы, аддитивно |
| R6 | Две параллельные системы уведомлений о сроках (`CommercialNotification` и `NotificationType`) | Выбрать одну (предлагаю `NotificationType`) и записать в backlog судьбу `CommercialNotification` |
| R7 | Бизнес-бот: доставка за флагом, действий нет, Mini App нет | Не обещать кнопки в боте в первых PR; только ссылка на кабинет |
| R8 | Фокус RC1 (#1103): параллельная фича, не блокирующая RC1 | По правилам CLAUDE.md предлагается **ОТЛОЖИТЬ** реализацию, если RC1 ещё не закрыт. Решение за вами. |
| R9 | Миграции: ручные, `migrate dev` запрещён, нужен прогон на чистой БД и копии prod | Каждый PR с миграцией — аддитивный, с проверкой на чистой БД |

## 4. Предлагаемая модель данных (минимум)

Одна новая таблица `CollectionParticipation` (название рабочее) и одно поле:

- `Article.collectionSlots Int?` (только для COLLECTION).
- `CollectionParticipation`: `id`, `articleId` (FK Article, Cascade), `offerId` (FK Offer, **Restrict/SetNull**), `businessId` (FK Business), `commercialStatus` enum `INVITED/APPLIED/WAITLIST/PAID/EXPIRED`, `placementStatus` enum `DRAFT/PENDING_MODERATION/PUBLISHED/HIDDEN`, `hook VARCHAR(140)`, `hookModeratedAt/By`, `legacyPosition Int?`, `legacyUntil DateTime?`, `startsAt`, `endsAt`, `invoiceNumber`, `paidAt`, `amount`, `currency`, `unp` (снимок), `createdAt/updatedAt`.
- Ограничения: `UNIQUE(articleId, offerId)`; CHECK «`hook` ≤ 140»; partial unique на `(articleId, legacyPosition) WHERE legacyPosition IS NOT NULL`; **слот-инвариант** («опубликованных ≤ slots») проверяется в транзакции с блокировкой строки Article, а не триггером.
- Связь с `ArticleLinkedItem`: опубликованное участие порождает или помечает строку `ArticleLinkedItem` (kind OFFER). Чтобы не дублировать источник истины, предлагаю вариант: публичная выдача читает объединение «редакционные строки + опубликованные участия» через один сервис `getCollectionCandidates(articleId)`; админка подборки редактирует то же самое.

## 5. Предлагаемая разбивка на PR (минимум, сначала данные)

| PR | Содержимое | Миграция | Зависит |
|---|---|---|---|
| **PR 1. Данные** | `collectionSlots`, `CollectionParticipation`, enum-ы, индексы, CHECK, чистая библиотека инвариантов (`assertSlots`, квота, waitlist) + тесты на чистой БД и копии prod | да | — |
| **PR 2. Порядок и SSR** | Функция score (`rankForFamily` + возрастная логика), legacy-позиции, ротация по seed, `ItemList` JSON-LD, Boost-изоляция (тест), публичный порядок гостя | нет | PR 1 |
| **PR 3. Бизнес-кабинет** | Раздел «Подборки»: приглашения, заявка, выбор Offer, hook, статус; заявка с модерацией; бизнес-API с ACL | нет | PR 1 |
| **PR 4. Админка** | Слоты и участия в редакторе подборки, очередь модерации hook, подбор кандидатов через `EditorialRequest` (+`articleId`), ручное подтверждение оплаты, лист ожидания | возможно (`articleId` в EditorialRequest) | PR 1 |
| **PR 5. Счёт и срок** | Генерация счёта по УНП из реквизитов, ручное зачисление, срок 12 месяцев, скрытие при выбытии Offer | нет | PR 3, PR 4 |
| **PR 6. Уведомления и отчёты** | Новые типы уведомлений, cron напоминаний за 14 и 3 дня, ежемесячный отчёт, телеметрия с `position`/`rankMode` | да (enum) | PR 5 |
| **PR 7. Персональный порядок** | Клиентский/приватный API порядка для семьи, измерение запросов | нет | PR 2 |

Каждый PR — отдельная ветка от свежего `origin/dev`.

## 6. Вопросы владельцу (нужны до реализации)

- **В1.** Подтвердить, что редакционная подборка = `ArticleLinkedItem`, а `CollectionItem` в задаче надо читать как «элемент подборки» (К1).
- **В2.** Счёт на первом этапе: генерировать PDF/документ в кабинете автоматически или выставлять вручную из админки (`BusinessContract`)? От ответа зависит размер PR 5.
- **В3.** Подключать ли Feedback 5★ к порогу скрытия размещения (К6), или на первом этапе скрывать только по статусу публикации Offer?
- **В4.** Уведомления о сроках: единый `NotificationType` (рекомендую) или `CommercialNotification` (R6).
- **В5.** Делать сейчас или отложить до закрытия RC1 (#1103) (R8).

## 7. Ограничения аудита

- Prod-данные не просматривались (см. раздел 8).
- Поля источника у заявок (7.3) и наличие Mini App для бизнеса проверены по поиску в коде, не по запуску.
- Производительность не измерялась.

## 8. SQL для п. 9 (только чтение, выполнить владельцу или по отдельному разрешению)

```sql
-- Сколько подборок и элементов
SELECT count(*) AS collections,
       count(*) FILTER (WHERE status = 'PUBLISHED') AS published
FROM "Article" WHERE "publicationType" = 'COLLECTION';

SELECT a.id, a.slug, a.title, a.status, count(li.id) AS items,
       count(li.id) FILTER (WHERE li.kind = 'OFFER') AS offers,
       count(li.id) FILTER (WHERE li.kind = 'EVENT') AS events
FROM "Article" a LEFT JOIN "ArticleLinkedItem" li ON li."articleId" = a.id
WHERE a."publicationType" = 'COLLECTION'
GROUP BY a.id ORDER BY items DESC;

-- Подборки, вышедшие за минимум
SELECT count(*) FROM (
  SELECT a.id FROM "Article" a JOIN "ArticleLinkedItem" li ON li."articleId" = a.id
  WHERE a."publicationType" = 'COLLECTION' GROUP BY a.id HAVING count(*) < 3) t;

-- Следы проданных позиций в коммерческом слое
SELECT "entityType", status, count(*), min("startsAt"), max("endsAt")
FROM "BusinessServicePlacement" GROUP BY 1, 2;

SELECT status, type, count(*), sum("totalAmount")
FROM "BusinessContract" GROUP BY 1, 2;

-- Позиции, проданные вне системы, могут быть в тексте договоров и заметках
SELECT id, "contractNumber", notes, "paymentComment"
FROM "BusinessContract"
WHERE notes ILIKE '%подбор%' OR "paymentComment" ILIKE '%подбор%';
SELECT id, "businessId", notes FROM "BusinessServicePlacement" WHERE notes ILIKE '%подбор%';
```
