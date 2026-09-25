# Cookies, согласие и телеметрия (mamaGo)

Краткая схема для разработки и продукта. Юридическую оценку формулировок даёт юрист.

## Три переключателя в UI

| Категория в баннере | Что управляет |
|---------------------|----------------|
| **Необходимые** | Всегда включены. Базовые cookies, сессия, безопасность, работа основных функций (вход, план, избранное и т.д.). |
| **Внешняя веб-аналитика** | Разрешает GA4 использовать analytics storage/cookies и подключает Yandex Metrica. До согласия GA4 работает в Advanced Consent Mode с `analytics_storage=denied`, а Yandex не загружается. PostHog и другие провайдеры фактически не используются. |
| **Маркетинг и реклама** | Только **сторонние** рекламные/маркетинговые технологии (Meta Pixel, TikTok и т.д.). Подключаются через `MarketingLoader` при согласии. Управляется отдельным флагом `marketing`, независимым от `analytics`: согласие на аналитику **не** включает рекламу/персонализацию автоматически. |

## Четыре источника правды — зоны ответственности

Чтобы не путать «аналитику» вообще с конкретными системами:

- **mamaGo DB / domain-модель** — авторитетные бизнес-факты (места, события, офферы, бронирования, пользователи, бизнес-профили). Источник правды для всего, что показывается в продукте.
- **UserEvent (first-party product telemetry)** — источник правды по фактическому продуктовому трафику. `PageViewTracker → POST /api/analytics/events → UserEvent(PAGE_VIEW)` питает `canonicalAudience`, admin traffic, персонализацию и business-аналитику независимо от external analytics consent.
- **Google Search Console** — источник SEO clicks и queries.
- **GA4 (Google Analytics 4)** — источник acquisition, channels и UTM. GA4 Users/Sessions не являются абсолютным источником фактического трафика mamaGo.
- **Yandex Metrica** — источник Webvisor/heatmaps и поведенческой UX-аналитики. Загружается только с согласия.

## First-party продуктовая телеметрия (UserEvent)

События продукта пишутся **в нашу БД** (`UserEvent`, агрегаты `UserBehaviorProfile`, сегменты).

- Клиент: `src/lib/analytics/client.ts` (`postAnalyticsEvent` / `postProductTelemetryEvent`), `POST /api/analytics/events`.
- Сервер: `src/server/services/analytics/AnalyticsEventService.ts` (`trackUserEvent`), в т.ч. из save-роутов и server components.

**Этот слой не привязан к переключателю «Внешняя веб-аналитика»** в текущей архитектуре. Имя папки `services/analytics` и путь API `/api/analytics/events` — исторические; смысл — продуктовые события, а не GA/Yandex.

## Внешняя веб-аналитика: GA4 и Yandex Metrica

Реализация: `src/components/analytics/analytics-loader.tsx` (`AnalyticsLoader`), рантайм-конфиг из `src/server/services/analytics/externalAnalyticsConfig.ts` → `src/lib/analytics/externalAnalyticsConfig.ts` (чистый resolver).

### GA4: Advanced Consent Mode

- При включённом PROD runtime-конфиге `AnalyticsLoader` сначала создаёт `dataLayer`/официально совместимый `gtag`, затем ставит consent default: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` = `denied`. Только после этого добавляется `gtag.js`, вызываются `gtag("js", ...)` и один `gtag("config", ...)`.
- До согласия Google tag может отправлять cookieless measurement, но наш код не разрешает analytics/ad cookies. После принятия `analytics` выполняется consent update с `analytics_storage=granted`; после отзыва — `analytics_storage=denied`. Все рекламные consent-поля всегда остаются `denied`.
- `ga-disable-*` не используется для обычного denied consent: он подавил бы cookieless measurement и сломал цель Advanced Consent Mode. Google Signals и ad-personalization signals явно выключены.
- Инициализация Google отделена от consent update и защищена от повторов: смена согласия не добавляет второй script, не повторяет `js`/`config` и не создаёт второй initial page view.

### Yandex: полный consent gate

- До согласия Yandex script и `ym(..., "init")` отсутствуют. После согласия Метрика загружается и инициализируется один раз; после отзыва вызывается `destruct` и выполняется cleanup.
- `AnalyticsLoader` подключён только в public provider tree: `src/app/(public)/layout.tsx` → `PublicProviders` → `CookieConsentProvider` → `AnalyticsLoader`. Root layout (`src/app/layout.tsx`), admin layout (`src/app/admin/layout.tsx`) и business layout (`src/app/business/layout.tsx`) его не подключают — события с admin/business-поверхностей во внешнюю аналитику не уходят.
- Namespaced `<noscript>`-пиксель Yandex («глаз») **намеренно не добавлен** — он бы отправлял хит в обход JS-гейта согласия.

### Revoke (отзыв согласия)

При отзыве `analytics` `AnalyticsLoader`:

- обновляет Google consent до `analytics_storage=denied`, сохраняя рекламные категории `denied`;
- если Yandex-счётчик был активен — вызывает `ym(counterId, "destruct")`;
- очищает доступные first-party GA/Yandex cookies через cookie-consent `autoClear` (`/^_ga/`, `_gid`, `_gat`, `gcl_*`, `/^_ym_/`) и Yandex localStorage через `clearYandexLocalStorage()`.
- Cookies, установленные самим доменом `yandex.ru` (не нашим доменом), браузер не позволяет очистить со страницы mamaGo — это ограничение платформы, не баг.

### Runtime env (не build-time, не `NEXT_PUBLIC_*`)

Читаются на сервере (`server-only`), fail-closed:

```
EXTERNAL_ANALYTICS_ENABLED=false   # true только когда провайдеры реально включены
GOOGLE_ANALYTICS_ID=               # G-XXXXXXX
YANDEX_METRIKA_ID=                 # числовой ID счётчика
```

Включение требует **одновременно** `APP_ENV=production|prod` **и** `EXTERNAL_ANALYTICS_ENABLED=true`; иначе — `enabled: false`, оба ID — `null`. Невалидный формат ID (не совпал с regex) также даёт `null` для этого провайдера независимо от второго. См. `src/lib/analytics/externalAnalyticsConfig.ts` (`resolveExternalAnalyticsConfig`) и тест `externalAnalyticsConfig.test.ts`.

Эти переменные читаются в рантайме сервера при рендере `(public)/layout.tsx`, не на этапе сборки — один Docker-образ работает одинаково во всех окружениях, конкретные ID/флаг задаются деплой-секретами.

### Marketing — независимый флаг

Согласие `analytics` не включает `marketing` автоматически и наоборот: `AnalyticsLoader` и `MarketingLoader` подписаны на разные категории cookie-consent (`canUseAnalytics` / `canUseMarketing`). Внутри самого GA4-конфига рекламные сигналы дополнительно отключены явно (`allow_google_signals: false`, `allow_ad_personalization_signals: false`) — согласие на аналитику не даёт Google прав на ad personalization.

### SPA-навигация: GA4 vs Yandex

- **GA4**: ручной `page_view`/`gtag("event", "page_view", …)` **не отправляется**. Полагаемся на GA4 Enhanced Measurement (отслеживание истории браузера/History API). Ручная отправка `page_view` при каждом переходе привела бы к **задвоенным просмотрам** (Enhanced Measurement уже поймает переход).
- **Yandex Metrica**: инициализация с `defer: true` — счётчик не шлёт автоматический хит на init. SPA-навигация отслеживается явно: `YandexRouteTracker` (использует `usePathname`/`useSearchParams` **под `Suspense`**, чтобы не терять статический рендеринг public-маршрутов) вызывает `ym(counterId, "hit", url, { title, referer })` при каждой смене URL.

## Traffic source of truth и GA4 coverage

Admin-метрики `Unique visitors`, `Page views` и `Views / visitor` — это фактический mamaGo traffic из `UserEvent(PAGE_VIEW)` через `canonicalAudience`. Guest sessions учитываются детерминированно по `sessionId`; ADMIN/MODERATOR-linked sessions исключаются. `PageViewTracker` монтируется один раз только в public shell, пишет один initial `PAGE_VIEW` и один при смене pathname и не зависит от cookie consent.

Контракт будущей контрольной метрики:

```text
External Analytics Coverage = observed GA4 traffic / first-party mamaGo traffic
```

Обе части должны использовать одинаковое окно и явно сопоставимую единицу. Числитель приходит только из реального GA4 reporting export/API; GA4 sessions нельзя синтезировать из `UserEvent`. Пока такого источника в runtime нет, `external_analytics.ga4_coverage` зафиксирован в metric dictionary как непроверяемый gap и не выводит вымышленных значений.

## Что сейчас реально подключено

- Cookie-баннер и категории: **да** (`src/lib/cookies/consent-config.ts`).
- Внешняя аналитика (GA4 + Yandex Metrica): **да**, `AnalyticsLoader` в public provider tree, включается через `EXTERNAL_ANALYTICS_ENABLED` + `APP_ENV=production|prod` (см. выше). В dev/staging всегда выключена.
- Маркетинг: заглушка в `MarketingLoader` (скрипты добавляют после получения ID/провайдера).

## Расширение в будущем

- Новые сторонние аналитические провайдеры по умолчанию полностью гейтятся категорией `analytics`; исключение для cookieless режима требует отдельного документированного consent-контракта, как у GA4.
- Любые рекламные пиксели — только за `canUseMarketing` / категорию `marketing`.
- Изменение политики по продуктовой телеметрии (гейтинг по согласию, отдельная категория) — **отдельное продуктово-юридическое решение**, не часть этого документа.

## Связанные файлы

- Тексты UI, revision, autoClear: `src/lib/cookies/consent-config.ts`
- Снимок согласия: `src/lib/cookies/consent-manager.ts`, `src/lib/cookies/consent-types.ts`
- Хелперы для скриптов: `src/lib/cookies/has-consent.ts`
- Внешние скрипты: `src/components/analytics/analytics-loader.tsx`, `marketing-loader.tsx`
- Runtime-конфиг: `src/server/services/analytics/externalAnalyticsConfig.ts`, `src/lib/analytics/externalAnalyticsConfig.ts`, `src/lib/analytics/externalAnalyticsTypes.ts`
- Regression-тесты: `src/lib/analytics/externalAnalyticsConfig.test.ts`, `src/lib/analytics/externalAnalyticsContract.test.ts`
