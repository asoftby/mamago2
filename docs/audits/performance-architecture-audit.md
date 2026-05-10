# Performance & Architecture Audit — mamaGo 2.0

**Дата:** 2026-05-10  
**Область:** Next.js App Router, клиентские провайдеры, сетевые запросы, сохранение публикаций (events/offers/places), Prisma/PostgreSQL, кеширование, бандл.

**Ограничение:** только аудит и рекомендации; изменения в код не вносились.

---

## 1. Executive Summary

| # | Проблема | Влияние |
|---|-----------|---------|
| 1 | **Публичный бейдж уведомлений вызывает тяжёлый `GET /api/notifications?limit=1`** вместо лёгкого подсчёта; на сервере для ответа выполняются запрос ленты, отдельные `getUnreadCount`, `countUnifiedNotifications`, плюс Telegram/audience — избыточно для счётчика. | **Critical** |
| 2 | **`SiteHeader` монтирует Desktop и Mobile деревья одновременно** (`hidden lg:contents` / `contents lg:hidden`). Оба тянут `useDiscoveryFilterOptions` → **дублируются** запросы `/api/geo/metro-stations` и `/api/geo/districts` на каждую загрузку публичной страницы. | **Critical** |
| 3 | **`PATCH /api/business/events/[id]` + `revalidateEventMutationPaths`** после каждого сохранения дергают множество `revalidatePath` (включая `/admin`, хаб города и списки); параллельно клиент в режиме edit делает **`router.refresh()`** после сохранения черновика — двойная нагрузка на сервер и дерево RSC. | **High** |
| 4 | **`GET /api/notifications`** для списка делает цепочку запросов к БД (лента + `getUnreadCount` + `getWelcomeIsRead` + `countUnifiedNotifications`) при каждой загрузке первой страницы ленты; Telegram и audience резолвятся повторно на каждом запросе. | **High** |
| 5 | **`UnreadNotificationCountProvider` опрашивает счётчик при каждом изменении `pathname`** (+ интервал 60 с и visibility) — лишние запросы при клиентской навигации по публичному сайту. | **Medium** |
| 6 | **`CityProvider` → `usePublicCityOptions`** тянет `/api/public/cities` на mount без HTTP-кеша и без SWR/React Query — каждый полный reload в публичной зоне. | **Medium** |
| 7 | **`WeatherProvider`** при смене города всегда дергает `/api/weather/weekly`; провайдер обёрнут высоко в публичном layout — цена ко всем страницам `(public)`. | **Medium** |
| 8 | **`NotificationSettingsInModal`**: дублирующий fetch настроек в `useEffect` и отдельный **`TelegramStatusRow` с `useTelegramConnectionStatus({ enabled: true })`** → при входе в «Настройки» внутри колокола сразу уходит **`/api/settings/telegram/status`**, даже если пользователь только переключил вкладку. | **Medium** |
| 9 | **`NotificationCacheContext` не используется** в прод-пути (`NotificationsPanel` рендерит `NotificationFeed` с локальным состоянием); кеш списка между открытиями колокола не переиспользуется на уровне приложения. | **Medium** |
| 10 | **`PlanWidget.tsx`** (отдельный виджет в хедере с fetch `/api/save/plan/day`) не найден импортерами в кодовой базе — возможный мёртвый код или расхождение деплоя; **`MyPlanProvider` + `useMyPlan`** для авторизованных дополнительно дергают `/api/save/plan/day` за «сегодня» при mount — **второй запрос дня плана** при наличии виджета My Plan. | **Low–Medium** |

---

## 2. Network / Fetch Audit

| Endpoint | Кто вызывает | Когда | Проблема | Предложенное исправление | Ожидаемый эффект |
|----------|----------------|-------|----------|---------------------------|------------------|
| `GET /api/notifications?limit=1` | `UnreadNotificationCountProvider` | После auth, каждый `pathname`, poll 60s, visibility | Использует полный handler ленты + несколько агрегирующих запросов | Перевести на `GET /api/notifications/unread-count`; опционально убрать `pathname` из deps или debounce | Резкое снижение CPU/DB на «фоновом» счётчике |
| `GET /api/notifications/unread-count` | `NotificationsDropdown` (business), fallback в `useUserNotificationBadgeCount`, сам endpoint | Mount business-колокола; fallback без провайдера | Endpoint всё ещё вызывает `getTelegramLinkStatus` + `resolveNotificationAudienceUser` для простого числа | Кешировать telegram+audience в request scope или отдельный «cheap» путь без Telegram для badge-only | Меньше latency на badge |
| `GET /api/notifications` | `NotificationFeed` | Открытие панели (первая загрузка), события NOTIFICATIONS_CHANGED | Один ответ тянет ленту + total + unread + welcome + telegram prompt логику | Разделить «лента» и «метаданные» или один SQL с материализованными полями; client cache (контекст уже есть) | Быстрее первый paint списка |
| `POST /api/notifications/mark-open` | `NotificationFeed` | При открытии панели (частично gated по unread) | После mark вызываются `getUnreadCount`, `getWelcomeIsRead` — ок для консистентности, но дорого при частых открытиях | Вызывать только если `unreadCount > 0` с клиента (частично есть); кеш welcome на сервере | Меньше POST-трафика к БД |
| `GET /api/settings/telegram/status` | `useTelegramConnectionStatus`, страницы настроек | В модалке: `enabled: true` при показе настроек | Лишняя нагрузка при каждом заходе в настройки уведомлений | `enabled` только после перехода на вкладку или использовать флаг из `settings` без отдельного GET | Меньше запросов |
| `GET /api/public/cities` | `usePublicCityOptions` из `CityContext` | Каждый mount провайдера в `(public)` | Нет `Cache-Control` / dedupe между вкладками кроме браузера | `fetch` с `next: { revalidate }` на сервере или глобальный клиентский кеш/SWR | Меньше нагрузки на `listPublicCitySelectorOptions` |
| `GET /api/geo/metro-stations`, `GET /api/geo/districts` | `useDiscoveryFilterOptions`, `PlaceLocationPicker`, wizard location, `fetchDiscoveryFilters` | Публичный сайт: **два** экземпляра хука (desktop+mobile DOM); смена города | Дублирование пар запросов; API без явного edge/CDN кеша | Одна обёртка-провайдер фильтров по городу; условный mount mobile desktop; `unstable_cache` в route handlers | −50% geo-запросов на landing |
| `GET /api/weather/weekly` | `WeatherProvider` | Смена `citySlug` | Глобально для всего `(public)` | Перенести под страницы/виджеты, где нужна погода; lazy | Меньше API при посещениях без погоды |
| `GET /api/save/plan/day` | `useMyPlan` (`refetchPlanForDate`), `PlanWidget` (если подключён) | Auth mount «сегодня» | Дублирование с виджетом дня | Единый контекст «plan snapshot» или SWR с ключом даты | Один запрос на дату |
| `POST/PATCH ...` save publications | Wizards, списки | autosave / submit | См. раздел 4 | См. раздел 4 | Меньше latency сохранения |
| Google Maps JS | `GoogleMapsService`, autocomplete/map previews | Шаги редактора места/события | Тянется по требованию — ок; риск — если импорт карты попадает в общий chunk | Явные `dynamic()` для карт/pickers | Меньше initial JS на витрине |

---

## 3. Provider / Layout Audit

| Provider / layout | Где подключён | Запросы при mount | Почему плохо | Куда перенести / как lazy-load |
|-------------------|---------------|-------------------|--------------|----------------------------------|
| `GlobalProviders` | `src/app/layout.tsx` | Зависит от `AuthProvider` / session | Корневой SSR уже читает auth (`getCurrentAuthState`) — дублирование источников правды возможно | Оставить минимум; следить чтобы клиентский auth не дублировал лишние polling |
| `PublicProviders` | `src/app/(public)/layout.tsx` | Цепочка: notifications count, pending actions, city→cities API, weather, family→children API | Тяжёлый «комбайн» для всех публичных страниц | Разбить: счётчик уведомлений только если есть колокол; weather только на страницах с планом/афишей; optional providers по segment |
| `UnreadNotificationCountProvider` | Внутри `PublicProviders` | `GET /api/notifications?limit=1` + polling | Тяжёлый endpoint + частые триггеры | Лёгкий endpoint; меньше триггеров |
| `CityProvider` | `PublicProviders` | `/api/public/cities` | Каждая публичная страница | Кеш + возможно cities из RSC props для layout |
| `WeatherProvider` | `PublicProviders` | `/api/weather/weekly` при городе | Глобально | Lazy под потребителей |
| `FamilyPersonaProvider` | `PublicProviders` | `/api/children` при авторизации | Нужно для фильтров — но тянется на всех маршрутах `(public)` | Для чисто маркетинговых страниц — отложить до взаимодействия |
| `MyPlanProvider` | `(public)/layout.tsx` | `useMyPlan` → plan day + ideas + suggestions logic | Оверхед для гостей частично gated — но провайдер монтируется | Dynamic import overlay/widget |
| `BackofficeProviders` | admin + business | Нет (passthrough) | — | Хороший паттерн изоляции |
| `EditorProviders` | `(content-editor)/layout.tsx` | Нет | — | Изоляция от публичных провайдеров сохранена |
| **Business shell** | `business/(protected)/layout.tsx` | Сервер: user, business, billing summary + **client** NotificationsDropdown | Billing summary на каждый layout — ок для кабинета; уведомления дублируют логику публичной зоны | Унифицировать badge-fetch; кеш billing коротким TTL при необходимости |
| **Admin layout** | `admin/layout.tsx` | Параллельно: moderation counts, B2B pending, import pending, reviews pending + prisma business check | Каждая навигация по админке бьёт в БД | Частичный ISR, `loading.tsx`, или перенос счётчиков в клиентский SWR с серверным bootstrap |

---

## 4. Save Flow Audit

### Events (`PATCH /api/business/events/[id]`)

**Текущий поток:** auth → parse body → `fetchActivityEventRowSummary` → `findFirst` existing → валидации категорий/места → `prisma.activity.update` → при необходимости `assignActivitySlugIfMissing` → при изменении расписания `replaceActivitySessionsFromScheduleJson` + `syncActivityNextOccurrenceAt` → галерея `replaceActivityGalleryFromMediaIds` если переданы ids → синк venue/city → occasions → **`revalidateEventMutationPaths`** → JSON ответ с `resolveCanonicalEventPublicPathById`.

**Что занимает время:**

- Полная пересборка сеансов из `scheduleJson` при любом изменении JSON расписания (даже «косметика» может триггерить если клиент шлёт объект целиком).
- Повторные чтения (`slug` после update, summary в начале).
- Широкий **revalidatePath** по множеству путей включая `/admin` и городские хабы при каждом autosave.
- На клиенте **`router.refresh()`** после сохранения черновика в режиме edit (`EventWizard`) — повторный обход RSC дерева редактора.

**Рекомендации:**

- Узкий revalidate: только затронутые slug-пути + конкретные списки; отложить revalidate до submit/publish или debounce на сервере для черновиков.
- На клиенте: убрать или ограничить `router.refresh()` при autosave; optimistic update локального состояния.
- Галерея: не слать `galleryMediaIds` если массив не менялся (частично уже есть diff на клиенте в `buildDraftPersistPayload`).

### Offers (`PATCH /api/business/offers/[id]`)

**Текущий поток:** легче события; prisma update; пост-хуки **defer** через `runAfterPublishResponse` для slug.

**Замечание:** в просмотренном фрагменте нет явных `revalidatePath` — публичная витрина может отставать до отдельного механизма ISR/webhooks (проверить пайплайн публикации вне этого аудита).

### Places (`PATCH /api/business/places/[id]`)

**Текущий поток:** проверки прав; большой `updateData`; пересоздание subcategories deleteMany + createMany; slug; ответ без массового revalidate в этом файле.

**Риски:** частый autosave с большими HTML полями; при опубликованных местах редирект на revision API — отдельный путь.

---

## 5. Prisma / Database Audit

### Уже хорошо

- У модели `Notification` есть индексы по `(userId, seenAt)`, `(userId, audience, createdAt)` и др. — см. `prisma/schema.prisma`.
- `PlanItem`: индекс `(userId, date)` — типичный доступ по дню плана.
- `Activity`: индексы по `businessId`, `cityId`, `nextOccurrenceAt`, `slug`.

### Подозрительные места

| Область | Наблюдение |
|---------|--------------|
| **GET /api/notifications** | Последовательные запросы: лента, затем `getUnreadCount`, `getWelcomeIsRead`, `countUnifiedNotifications` — потенциально объединить или кешировать в одной транзакции/read |
| **Event PATCH** | Двойное чтение в начале (`fetchActivityEventRowSummary` + `findFirst`) — возможно один запрос с нужными полями |
| **revalidate helpers** | `getEventRevalidationContext` делает до двух обращений к `city` по id — микро-оптимизация через join |
| **Гео API** | `districts`/`metro-stations` — простые `findMany` по `cityId`; индексы `[cityId]` есть у `District`/`MetroStation` |

### Рекомендации

- Добавить метрики/timing уже используемым `createRequestPerf` в routes сохранения и сравнить prod traces.
- Рассмотреть **materialized** или денормализованный счётчик unread (осторожно с консистентностью) только если DB станет узким местом после фикса endpoint для badge.

---

## 6. Client Bundle Audit

| Область | Наблюдение |
|---------|------------|
| **Двойной хедер** | Desktop + Mobile одновременно в DOM увеличивает клиентские деревья и эффекты (не только сеть). |
| **Wizards** | `EventWizard` тянет много шаговых модулей в одном `"use client"` файле — кандидат на `next/dynamic` для редких шагов (AI, карты). |
| **Google Maps** | Загрузка через `@googlemaps/js-api-loader` точечно — сохранять паттерн; не импортировать карту в общих хедерах. |
| **Rich text / media** | Проверить `ImageUploader`, редакторы — dynamic при открытии модалки. |
| **`date-fns`** | В `NotificationFeed` импорт локали `ru` — следить за tree-shaking (обычно ок при named imports). |

---

## 7. Notifications — целевая архитектура vs факт

| Требование | Факт в коде |
|------------|-------------|
| Bell только count | Публичный: **`/api/notifications?limit=1`** — не только count. Business: **`/api/notifications/unread-count`** — верно по типу, но endpoint тяжёлый. |
| Drawer один раз + кеш | Список локальный в `NotificationFeed`; при закрытии/открытии список сохраняется в state компонента, но **нет глобального** NotificationCacheProvider в дереве; при размонтировании колокола кеш теряется. |
| mark-open только если unread > 0 | Есть проверки по `seenAt` и debounce по времени; сервер всё равно делает работу при вызове. |
| Telegram/email не при каждом открытии панели | **Telegram**: при открытии списка не дергается; при переходе в настройки — **да** (`TelegramStatusRow`). Email prompt через отдельный hook. |

---

## 8. Editor / Admin / Business separation

- **Editor** `(content-editor)`: только `EditorProviders` — публичные `CityProvider` / `MyPlanProvider` **не** подключены — хорошо.
- **Business**: отдельный layout без `PublicProviders`; но **`NotificationsDropdown`** и **`ProfileDropdown`** переиспользуются с сайта — это ок по UX, но нужно следить чтобы они не тянули city/plan (сейчас не тянут через те же провайдеры).
- **Admin**: собственный layout со счётчиками модерации на каждый запрос — см. выше.

---

## 9. App Router / caching

- Часть страниц явно **`force-dynamic`** (админ-списки, биллинг, маршруты) — осознанно.
- Корневой `layout.tsx` вызывает **`getCurrentAuthState()`** — типично фиксирует dynamic-сегмент у корня (проверить документацию Next для вашей версии).
- API routes гео/городов **не используют** внутри себя `unstable_cache` / заголовки CDN — кандидаты на долгий `revalidate` для справочников.

---

## 10. Fix Plan

### Phase 1: быстрые фиксы без большого риска

| Что | Файл / модуль | Изменение | Риск | Эффект | Проверка |
|-----|----------------|-----------|------|--------|----------|
| Badge notifications | `src/contexts/UnreadNotificationCountContext.tsx` | Заменить fetch на `/api/notifications/unread-count` | Низкий | −CPU/DB | Network tab: один лёгкий GET |
| Убрать лишние триггеры badge | `UnreadNotificationCountContext.tsx` | Убрать или debounce `pathname` из deps | Низкий | Меньше запросов при переходах | Навигация по 10 страницам |
| Дубль fetch настроек | `NotificationSettingsInModal.tsx` | Один `loadData` вместо двойного эффекта | Низкий | −1 запрос settings | Открыть настройки в колоколе |
| HTTP-кеш справочников | `src/app/api/geo/districts/route.ts`, `metro-stations`, `api/public/cities` | `Cache-Control` s-maxage или `unstable_cache` | Низкий–средний | −latency geo/cities | Повторные GET из CDN |

### Phase 2: provider / layout separation

| Что | Файл | Изменение | Риск | Эффект | Проверка |
|-----|------|-----------|------|--------|----------|
| Двойной хедер | `SiteHeader.tsx`, `DesktopHeader`/`MobileHeader` | Условный рендер по `matchMedia` или один источник данных фильтров | Средний | −дубли запросов и эффектов | DevTools Network при загрузке главной |
| Weather | `PublicProviders.tsx` | Обёртка только вокруг страниц с планом/виджетами погоды | Средний | −weather fetch | Страницы без погоды |
| Подключить NotificationCacheProvider | Дерево около `NotificationsPanel` | Оборачивать панель + читать кеш в Feed | Средний | Меньше повторных GET | Открыть/закрыть колокол |

### Phase 3: save-flow optimization

| Что | Файл | Изменение | Риск | Эффект | Проверка |
|-----|------|-----------|------|--------|----------|
| revalidate черновиков | `src/lib/business/eventMutationSideEffects.ts` | Не звать городской хаб и `/admin` при каждом PATCH draft; только при publish/submit | Высокий если забыть publish path | Быстрее save | Лог времени `createRequestPerf` |
| router.refresh | `EventWizard.tsx` | Убрать для autosave или заменить точечным обновлением данных | Средний | Меньше RSC | Профиль Next server |
| Узкий revalidate | `revalidateEventMutationPaths` | Набор путей по статусу события | Средний | Меньше инвалидаций кеша | Контент обновляется после publish |

### Phase 4: DB / index / caching optimization

| Что | Файл | Изменение | Риск | Эффект | Проверка |
|-----|------|-----------|------|--------|----------|
| Объединить запросы notifications | `src/app/api/notifications/route.ts` + service | Один round-trip или отказ от лишних count при UI-only | Средний | Ниже latency inbox | EXPLAIN / APM |
| unread-count без Telegram | `src/app/api/notifications/unread-count/route.ts` | Ленивая загрузка telegram только если нужен флаг prompt | Средний | Быстрее badge | Load test |

### Phase 5: deeper refactor

| Что | Изменение | Риск | Эффект |
|-----|-----------|------|--------|
| Единый Data Router для geo/filters | Контекст «FilterOptions» с SWR по ключу города | Средний | Дедупликация всех потребителей |
| Серверный bootstrap фильтров | Передавать metro/district из RSC layout города | Выше | Нулевой клиентский fetch на первом кадре |
| Optimistic UI для плана и уведомлений | TanStack Query / SWR | Средний | Лучший UX |

---

## PR-sized задачи (предложение)

1. **`fix(notifications): use unread-count endpoint in UnreadNotificationCountProvider`** — замена URL + проверка poll.  
2. **`perf(header): dedupe geo filter fetches across desktop/mobile`** — один провайдер или условный mount.  
3. **`perf(api): add caching headers or unstable_cache to public cities + geo endpoints`**.  
4. **`fix(notifications): remove duplicate settings fetch in NotificationSettingsInModal`**.  
5. **`perf(notifications): slim unread-count route (defer telegram resolution)`**.  
6. **`perf(events): narrow revalidateEventMutationPaths for draft saves`**.  
7. **`perf(event-wizard): avoid router.refresh on every draft save in edit mode`**.  
8. **`feat(notifications): wire NotificationCacheProvider into NotificationsPanel`**.  
9. **`chore: remove or wire PlanWidget`** — если не используется, удалить; если нужен — подключить явно и слить запрос с MyPlan.  
10. **`perf(admin): defer moderation nav counts to client SWR with server fallback`**.

---

*Конец отчёта.*
