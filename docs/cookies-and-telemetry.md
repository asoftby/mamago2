# Cookies, согласие и телеметрия (mamaGo)

Краткая схема для разработки и продукта. Юридическую оценку формулировок даёт юрист.

## Три переключателя в UI

| Категория в баннере | Что управляет |
|---------------------|----------------|
| **Необходимые** | Всегда включены. Базовые cookies, сессия, безопасность, работа основных функций (вход, план, избранное и т.д.). |
| **Внешняя веб-аналитика** | Только **сторонние** скрипты веб-аналитики: **Google Analytics 4** и **Yandex Metrica**. Подключаются через `AnalyticsLoader` при согласии. PostHog и другие провайдеры фактически не используются и намеренно не упоминаются в UI. |
| **Маркетинг и реклама** | Только **сторонние** рекламные/маркетинговые технологии (Meta Pixel, TikTok и т.д.). Подключаются через `MarketingLoader` при согласии. Управляется отдельным флагом `marketing`, независимым от `analytics`: согласие на аналитику **не** включает рекламу/персонализацию автоматически. |

## Четыре источника правды — зоны ответственности

Чтобы не путать «аналитику» вообще с конкретными системами:

- **mamaGo DB / domain-модель** — авторитетные бизнес-факты (места, события, офферы, бронирования, пользователи, бизнес-профили). Источник правды для всего, что показывается в продукте.
- **UserEvent (first-party product telemetry)** — поведенческая телеметрия продукта в нашей БД: открытие карточки, просмотр в ленте, клики CTA, сохранение в идеи, добавление в план. Используется для admin-дашбордов, персонализации, business-аналитики. Не зависит от согласия `analytics` (см. ниже).
- **GA4 (Google Analytics 4)** — внешняя веб-аналитика: acquisition (откуда пришёл пользователь), каналы (organic/paid/referral/social), кампании (UTM), session/traffic-аналитика. Загружается только с согласия.
- **Yandex Metrica** — внешняя веб-аналитика: Webvisor (записи сессий), карты кликов, поведенческая UX-аналитика, вторичная traffic-аналитика (дублирующая/альтернативная GA4 для рынков, где GA4 менее надёжен). Загружается только с согласия.

## First-party продуктовая телеметрия (UserEvent)

События продукта пишутся **в нашу БД** (`UserEvent`, агрегаты `UserBehaviorProfile`, сегменты).

- Клиент: `src/lib/analytics/client.ts` (`postAnalyticsEvent` / `postProductTelemetryEvent`), `POST /api/analytics/events`.
- Сервер: `src/server/services/analytics/AnalyticsEventService.ts` (`trackUserEvent`), в т.ч. из save-роутов и server components.

**Этот слой не привязан к переключателю «Внешняя веб-аналитика»** в текущей архитектуре. Имя папки `services/analytics` и путь API `/api/analytics/events` — исторические; смысл — продуктовые события, а не GA/Yandex.

## Внешняя веб-аналитика: GA4 и Yandex Metrica

Реализация: `src/components/analytics/analytics-loader.tsx` (`AnalyticsLoader`), рантайм-конфиг из `src/server/services/analytics/externalAnalyticsConfig.ts` → `src/lib/analytics/externalAnalyticsConfig.ts` (чистый resolver).

### Consent-гейтинг

- GA4 и Yandex Metrica грузятся (`<script>` вставляется в `<head>`, `gtag`/`ym` инициализируются) **только после** согласия на категорию `analytics` (`canUseAnalytics()`, `src/lib/cookies/has-consent.ts`).
- `AnalyticsLoader` подключён только в public provider tree: `src/app/(public)/layout.tsx` → `PublicProviders` → `CookieConsentProvider` → `AnalyticsLoader`. Root layout (`src/app/layout.tsx`), admin layout (`src/app/admin/layout.tsx`) и business layout (`src/app/business/layout.tsx`) его не подключают — события с admin/business-поверхностей во внешнюю аналитику не уходят.
- Namespaced `<noscript>`-пиксель Yandex («глаз») **намеренно не добавлен** — он бы отправлял хит в обход JS-гейта согласия.

### Revoke (отзыв согласия)

При отзыве `analytics` (или изначальном отсутствии согласия) `AnalyticsLoader`:

- ставит `window["ga-disable-<measurementId>"] = true` — Google-скрипт перестаёт отправлять хиты;
- если Yandex-счётчик был активен — вызывает `ym(counterId, "destruct")`;
- очищает доступные first-party Yandex-cookies браузера (`_ym_uid`, `_ym_retryReqs`, `_ym_hide_phones`, `_ym*_(lastHit|lsid|reqNum)`, `ytm_(tf|tag)_*` — через `localStorage`, см. `clearYandexLocalStorage()`), и через cookie-consent `autoClear` (`/^_ym_/`, `src/lib/cookies/consent-config.ts`).
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

## Что сейчас реально подключено

- Cookie-баннер и категории: **да** (`src/lib/cookies/consent-config.ts`).
- Внешняя аналитика (GA4 + Yandex Metrica): **да**, `AnalyticsLoader` в public provider tree, включается через `EXTERNAL_ANALYTICS_ENABLED` + `APP_ENV=production|prod` (см. выше). В dev/staging всегда выключена.
- Маркетинг: заглушка в `MarketingLoader` (скрипты добавляют после получения ID/провайдера).

## Расширение в будущем

- Любые сторонние аналитические скрипты — только за `canUseAnalytics` / категорию `analytics`.
- Любые рекламные пиксели — только за `canUseMarketing` / категорию `marketing`.
- Изменение политики по продуктовой телеметрии (гейтинг по согласию, отдельная категория) — **отдельное продуктово-юридическое решение**, не часть этого документа.

## Связанные файлы

- Тексты UI, revision, autoClear: `src/lib/cookies/consent-config.ts`
- Снимок согласия: `src/lib/cookies/consent-manager.ts`, `src/lib/cookies/consent-types.ts`
- Хелперы для скриптов: `src/lib/cookies/has-consent.ts`
- Внешние скрипты: `src/components/analytics/analytics-loader.tsx`, `marketing-loader.tsx`
- Runtime-конфиг: `src/server/services/analytics/externalAnalyticsConfig.ts`, `src/lib/analytics/externalAnalyticsConfig.ts`, `src/lib/analytics/externalAnalyticsTypes.ts`
- Regression-тесты: `src/lib/analytics/externalAnalyticsConfig.test.ts`, `src/lib/analytics/externalAnalyticsContract.test.ts`
