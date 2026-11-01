# Feedback 5★ — PR1: фундамент (01.11.2026)

Первый из восьми PR по ТЗ «Рейтинги mamaGo 2.0 — Feedback 5★». Схема и чистые
функции для шкалы 1–5. Поведение при выключенных флагах не меняется: новых
эндпоинтов, UI и записи звёзд в этом PR нет.

## Повторный аудит перед PR (обязательный)

База: `origin/dev` = `16929f2` — совпадает с HEAD аудита в ТЗ, расхождений нет.

| Что уже было | Решение в PR1 |
| --- | --- |
| `FeedbackReaction` с CHECK −1/0/+1 | добавлена шкала `scale`; старые строки = `SENTIMENT3`, новые по умолчанию `STARS5` |
| `occurrenceKey` = голый `PlanItem.id` | префиксы `plan:` / `session:` / `offer-session:` / `booking:` / `visit:` / `legacy:`; существующие строки `source=PLAN` мигрируют в `plan:<id>` |
| `FeedbackTag.showFor` в −1/0/+1 | перевод в звёзды: [+1]→[4,5], [+1,0]→[3,4,5], [−1,0]→[1,2,3]; фильтрация для старого эмодзи-UI не меняется (проверено тестом) |
| `FeedbackReputationAggregate` без писателя | пересоздана под звёзды и проекции; миграция падает, если в старой таблице есть строки |
| `feedbackRankScore` (0–1) | переименован в `legacySentimentRankScore`; новый `feedbackRankScore` — байес на 1–5 |
| `syncPlanFeedback`, `placeReputation.service` | явно пишут/читают `SENTIMENT3` с префиксными ключами — поведение то же |

Параллельных таблиц оценок не создано.

## Что добавлено

- Миграция `20261101150000_feedback_stars_foundation` (additive, кроме пустой
  агрегатной таблицы): `FeedbackScale`, `FeedbackExperienceLevel`,
  `FeedbackRevisionReason`, `FeedbackProjection`, `FeedbackTargetType.BUSINESS`
  (только для агрегатов, CHECK запрещает реакции), поля сеанса/брони/уровня
  опыта/`withdrawnAt`, `FeedbackReview.publishedText`, таблица `FeedbackRevision`,
  `FeedbackTag.partyCategories`.
- `src/lib/feedback/model.ts`: `starDistribution`, `starPresentation`
  («★ 4,7 · 42 оценки», склонение), `feedbackRankScore` (1–5),
  `resolveCategoryPrior`, `tagShare`, `buildOccurrenceKey` / `parseOccurrenceKey`.

## Проверка

- Все 321 миграция + новая применены на чистом PostgreSQL 16; проверены CHECK
  (значения по шкале, BUSINESS, showFor, согласованность агрегата), перевод
  тегов, префикс `plan:`, откат при непустой агрегатной таблице.
- `prisma validate`, `tsc --noEmit`, `test:feedback-foundation`,
  `test:experience-feedback`, eslint по затронутым файлам.

## Перед применением на DEV/PROD

Как и раньше для Feedback: проверить на копии DEV, `migrate status`, число строк
в `FeedbackReputationAggregate` (ожидается 0), план отката. Отдельное разрешение
на перенос DEV/PROD.
