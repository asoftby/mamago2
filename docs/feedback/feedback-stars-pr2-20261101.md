# Feedback 5★ — PR2: запись оценок, посещения, история, агрегаты, API (01.11.2026)

Второй PR по ТЗ «Рейтинги mamaGo 2.0 — Feedback 5★». База — `origin/dev` после merge PR #1049
(`d3c58a9`). Все новые эндпоинты выключены флагами; существующие эндпоинты не меняются (их перевод — PR5).

## Аудит перед PR (обязательный)

| Нужно по ТЗ | Что уже было в `dev` | Решение |
| --- | --- | --- |
| Сервис записи звёзд | `syncPlanFeedback.service.ts` (только SENTIMENT3 из «Моего плана») | новый `feedback.service.ts` — единая точка записи STARS5; старый писатель не трогаем до PR4/PR5 |
| Ограничение частоты | `src/lib/security/rateLimit.ts` (`RateLimitEntry`, атомарный счётчик) | переиспользуем: 30 оценок и 5 текстов в сутки на пользователя |
| Проверка посещения | `Experience` (ATTENDED), `BookingRequest` (COMPLETED), `ActivitySession`, `OfferSession` | переиспользуем как источники фактов; новых таблиц нет |
| История | `FeedbackRevision` (PR1) | пишется в той же транзакции при каждом изменении |
| Агрегаты | `FeedbackReputationAggregate` (PR1), записи не было | `feedbackAggregate.service.ts` + чистый `starAggregate.ts` |
| Cron | `authorizeCronRequest`, маршруты `/api/cron/*` | новый `/api/cron/feedback-aggregates` по тому же образцу |
| Авторизация API | `getCurrentUser()`, zod-валидация | тот же шаблон |

Параллельных систем оценок не создаётся.

## Что сделано

- `feedbackOccurrence.ts` — серверная проверка цели и посещения: `visit` (не в будущем, не старше 365 дней), `session` (сеанс этого события, уже начался), `offer-session`, `booking` (своя, `COMPLETED` → `VERIFIED`), `plan` (свой `Experience` с `ATTENDED`). Чужая бронь отвечает «не найдено». `Offer` PLACE_VISIT отклоняется (`OFFER_INHERITS_PLACE`). Снимок площадки фиксируется при первой оценке и больше не меняется.
- `feedback.service.ts` — оценка (upsert по визиту, повтор при гонке), текст (нужен подтверждённый телефон, модерация, последний опубликованный текст остаётся виден), отзыв оценки (мягкий, идемпотентный), сводка, опубликованные отзывы, доступные чипы.
- `feedbackAggregate.service.ts` — полный пересчёт проекций DIRECT / LINKED_EVENT / LINKED_OFFER / BUSINESS_ROLLUP в той же транзакции; prior категории из агрегатов; ежедневная сверка.
- Решение 01.11: звёзды авторизованного пользователя публичны без подтверждённого телефона (`starRatingPublicEligible`).

## API

| Метод | Путь | Флаг |
| --- | --- | --- |
| POST | `/api/feedback` | `FEEDBACK_V1_WRITE_ENABLED` |
| PUT | `/api/feedback/[id]/review` | `FEEDBACK_V1_WRITE_ENABLED` |
| DELETE | `/api/feedback/[id]` | `FEEDBACK_V1_WRITE_ENABLED` |
| GET | `/api/feedback/summary`, `/reviews`, `/tags` | `FEEDBACK_V1_WRITE_ENABLED` или `FEEDBACK_STARS_UI_ENABLED` |
| GET | `/api/cron/feedback-aggregates` | cron-авторизация |

При выключенных флагах эндпоинты отвечают 404.

## Проверка

- `test:feedback-foundation` (+ новый `starAggregate.test.ts`), `tsc --noEmit`, eslint.
- `test:feedback-stars-integration` — новый шаг CI на изолированном PostgreSQL: запись и повтор, история, «последняя оценка автора», все ветки проверки посещения, связанные проекции, роллап исполнителя, наследование PLACE_VISIT, текст и модерация, отзыв, сверка дрейфа.

## Не в этом PR

- Перевод `/api/plan/experiences/[id]/feedback`, `/api/bookings/[id]/feedback`, `/api/places/[id]/reviews` и backfill — PR5.
- Ранжирование и правила boost — PR3. UI — PR4. Модерация и кабинет бизнеса — PR7.
- Расписание вызова `/api/cron/feedback-aggregates` (раз в сутки) — настроить вместе с включением флага.
