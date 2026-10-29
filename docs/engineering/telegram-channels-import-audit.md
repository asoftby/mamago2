# Аудит перед реализацией: автосбор событий из Telegram-каналов

- Дата: 2026-10-29
- База: `origin/dev` @ `0787d43685e92eed7d625a7964c9916464bd0547`
- ТЗ: [`telegram-channels-import-spec.md`](./telegram-channels-import-spec.md)
- Задача: PR 0 из плана ТЗ. Без этого отчёта PR 1 не начинается.

Первый аудит сделан на `85ca105`. С тех пор `dev` ушёл вперёд до `0787d43`;
каталоги `src/server/services/telegram/capture`, `src/server/modules/import`,
`src/lib/ai`, `src/worker`, `src/app/admin/import`, `src/app/api/cron` и
import-модели в `prisma/schema.prisma` между этими SHA **не изменились**
(проверено `diff -r`). Выводы первого аудита остаются в силе.

## Что уже есть и как используем

| Нужно по ТЗ | Что есть в коде | Решение |
| --- | --- | --- |
| Источник и настройки | `ImportSource` (`parserKey`, `status`, `isAutoUpdate`, `rateLimitMs`, `crawlMaxPages`, `territoryId`), форма `/admin/import/sources` | Переиспользуем |
| Реестр парсеров | `parsers/registry.ts`, `parser-definitions.ts`, контракт `EventImportParser` | Расширяем ключом `telegram-channel-event` |
| Запуск, блокировка, счётчики | `runImportForSource`, `ImportRun`, `GlobalLock` на источник | Переиспользуем |
| Пропуск неизменённых записей | `@@unique([sourceId, externalId])` + `contentHash` | Переиспользуем; добавляем `hashInput` (PR 4) |
| Очередь ревью | `ImportReviewTask`, `/admin/import/review`, `submitReviewDecision` | Расширяем (PR 6) |
| Публикация | `import-publish.service.ts`, `event-field-mapper.ts`, `activity-session-from-occurrences.ts` | Переиспользуем |
| Сеансы | `NormalizedEventImport.occurrences[]`, `ActivitySession.source/externalId/title` | Переиспользуем |
| Защита ручных правок | `ImportFieldOverride` | Переиспользуем |
| Поиск дублей | `event-match-scorer.ts`, `event-candidate-search.ts`, `event-suggested-action.ts` | Расширяем (PR 2) |
| Мультимодальный вызов | `captureProcessor.ts`: `loadImages`, `attempt`, повтор, эскалация на сильную модель, `addUsage`; `lib/ai/openrouterClient.ts` | **Выносим в общий модуль (PR 1)** |
| Скачивание картинок по URL | `fetchBinary` в `parsers/fetchHtml.ts` (SSRF-защита, `validateUrl`, `maxBytes`) | Переиспользуем в `WebImageSource` |
| Категория / обогащение | `lib/ai/detectEventCategory.ts`, `enrichEvent.ts` | Переиспользуем |
| Переписывание описания | `/api/ai/rewrite`, `lib/ai/descriptionAssistant.ts` | Переиспользуем |
| Фоновые задачи | `src/worker/scheduler.ts`, `/api/cron/*` с `authorizeCronRequest` | Расширяем (PR 3) |

## Подтверждённые пробелы

1. **Плановых запусков импорта нет.** `runImportForSource` вызывается только
   из `src/app/admin/import/actions.ts`; `isAutoUpdate` пишется формой, но не
   читается планировщиком; `triggerType` всегда `MANUAL`
   (`import-pipeline.service.ts:102,140`: `triggeredByUserId ? "MANUAL" : "MANUAL"`).
   Внешних запусков в `scripts/`, `ops/`, `docker-compose.yml`, `.github/` нет.
   Тест `test:abws-readonly-import-schedule` касается read-only расписания
   импортированных событий в кабинете, к запускам отношения не имеет.
2. **Capture принимает только личные чаты**
   (`telegramUpdateParser.ts:137`, `NOT_PRIVATE_CHAT`), поэтому для каналов и
   групп переиспользуется только мультимодальное ядро, не приём сообщений.
3. **Дубли между ожидающими записями разных источников не ищутся**:
   кандидаты берутся только из `Activity`.
4. **Слабый поиск кандидатов** (`event-candidate-search.ts`): первое слово
   названия или площадки; дата сравнивается с `nextOccurrenceAt`, не с сеансами.
5. **Баг `normalizeAddress`** (`utils/string-normalize.ts`): `\b` не работает
   для кириллицы, «ул», «пр-т», «пер» не удаляются. Проверено на Node:
   `"ул ленина".replace(/\b(ул)\b/g, "X")` возвращает `"ул ленина"`.
6. **Ревью-задача создаётся для каждой записи** без автоотсева.

## Лимиты Capture (остаются в Capture, на импорт не переносятся)

`src/server/services/telegram/capture/captureLimits.ts`: `maxTextChars` 4000,
`maxPhotoBytes` 5 МБ, `maxPhotosPerItem` 5, `maxItemsPer24h` 30,
`albumDebounceMs` 2500, `purgeAfterMs` 7 суток.

## Тесты, закрывающие рефакторинг Capture (PR 1)

Скрипты `package.json`: `test:telegram-capture`,
`test:telegram-capture-parser`, `test:telegram-capture-integration`,
`test:inbox-maintenance-integration`. В `check:push:steps` входят первые два.
Ожидания существующих тестов в PR 1 не меняются.

## Ограничения среды аудита

Аудит выполнен чтением кода и сравнением деревьев. Приложение, база DEV и
реальные сообщения не запускались; точность распознавания афиш не измерена и
проверяется на пилоте (метрики — в разделе «Этапы и порядок работ» ТЗ).
