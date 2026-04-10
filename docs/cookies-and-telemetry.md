# Cookies, согласие и телеметрия (mamaGo)

Краткая схема для разработки и продукта. Юридическую оценку формулировок даёт юрист.

## Три переключателя в UI

| Категория в баннере | Что управляет |
|---------------------|----------------|
| **Необходимые** | Всегда включены. Базовые cookies, сессия, безопасность, работа основных функций (вход, план, избранное и т.д.). |
| **Внешняя веб-аналитика** | Только **сторонние** скрипты веб-аналитики (Google Analytics, GTM, PostHog и аналоги). Подключаются через `AnalyticsLoader` при согласии. |
| **Маркетинг и реклама** | Только **сторонние** рекламные/маркетинговые технологии (Meta Pixel, TikTok и т.д.). Подключаются через `MarketingLoader` при согласии. |

## First-party продуктовая телеметрия (отдельно от «analytics cookies»)

События продукта пишутся **в нашу БД** (`UserEvent`, агрегаты `UserBehaviorProfile`, сегменты). Примеры: открытие карточки, просмотр в ленте, клики CTA, сохранение в идеи, добавление в план.

- Клиент: `src/lib/analytics/client.ts` (`postAnalyticsEvent` / `postProductTelemetryEvent`), `POST /api/analytics/events`.
- Сервер: `src/server/services/analytics/AnalyticsEventService.ts` (`trackUserEvent`), в т.ч. из save-роутов и server components.

**Этот слой не привязан к переключателю «Внешняя веб-аналитика»** в текущей архитектуре. Имя папки `services/analytics` и путь API `/api/analytics/events` — исторические; смысл — продуктовые события, а не GA.

## Что сейчас реально подключено

- Cookie-баннер и категории: **да** (`src/lib/cookies/consent-config.ts`).
- Внешняя аналитика и маркетинг: **заглушки** в `AnalyticsLoader` / `MarketingLoader` (скрипты добавляют после получения ID).

## Расширение в будущем

- Любые сторонние аналитические скрипты — только за `canUseAnalytics` / категорию `analytics`.
- Любые рекламные пиксели — только за `canUseMarketing` / категорию `marketing`.
- Изменение политики по продуктовой телеметрии (гейтинг по согласию, отдельная категория) — **отдельное продуктово-юридическое решение**, не часть этого документа.

## Связанные файлы

- Тексты UI: `src/lib/cookies/consent-config.ts`
- Снимок согласия: `src/lib/cookies/consent-manager.ts`, `src/lib/cookies/consent-types.ts`
- Хелперы для скриптов: `src/lib/cookies/has-consent.ts`
- Внешние скрипты: `src/components/analytics/analytics-loader.tsx`, `marketing-loader.tsx`
