# Inbox recover и purge: runbook

Контракт: `docs/specs/forward-to-plan-spec-v1.3.md`, разделы 11, 13 и 15 (production gate, purge smoke).
Код: `src/server/services/telegram/capture/inboxRecover.ts`, `inboxPurge.ts`, маршруты `src/app/api/cron/inbox-recover` и `inbox-purge`, smoke `scripts/ops/inbox-purge-smoke.ts`.

## Что делают джобы

Оба вызываются существующим runner'ом (`scripts/deploy/run-prod-notification-jobs.sh`, cron каждые 5 минут, `flock`), после reminders и digests, с `CRON_SECRET` из окружения app-контейнера.

| Джоб | Маршрут | Что делает |
|---|---|---|
| `inbox-recover` | `GET /api/cron/inbox-recover` | `InboxItem` в `RECEIVED`/`PROCESSING`, у которых `debounceUntil` старше 2 минут, перезапускает через обычный processor. Захват только compare-and-set (параллельные запуски не берут один элемент дважды), терминальные статусы не трогает. До 5 элементов и 45 секунд на запуск, до 3 повторов на элемент (считаются по `RECOVER_ATTEMPT` в `ruleCodes`); после этого `FAILED` с `error = RECOVER_EXHAUSTED`. Если processor бросил ошибку: `FAILED` с `PROCESSOR_ERROR`. |
| `inbox-purge` | `GET /api/cron/inbox-purge` | Для всех `InboxItem` с `purgeAfter <= now()` (любой статус) обнуляет `InboxItemPart.text` и `InboxItem.draft`; удаляет `InboxItem` старше 30 дней (части уходят каскадом). Идемпотентно, батчами по 200 (до 50 батчей за запуск). |

В ответах и логах только числа и коды: ни текстов сообщений, ни `draft`, ни `chatId`, ни `file_id`.

## Что сделать на PROD (кроме деплоя)

1. Выкатить код (деплой). Миграций в этом PR нет.
2. Обновить runner на хосте: установленная копия `/usr/local/sbin/mamago-notification-jobs` не обновляется деплоем. Скопировать новую версию так же, как это делает установщик:
   `sudo install -m 0755 scripts/deploy/run-prod-notification-jobs.sh /usr/local/sbin/mamago-notification-jobs`
   Расписание cron и установщик менять не нужно.
3. Убедиться, что `CRON_SECRET` задан в app-контейнере (только факт, без вывода значения):
   `docker exec <app-контейнер> sh -c 'test -n "$CRON_SECRET" && echo CRON_SECRET=SET || echo CRON_SECRET=MISSING'`

## Purge smoke (критерий из спеки, раздел 15)

Запускается вручную, на синтетических данных, внутри app-контейнера (там есть `CRON_SECRET` и приложение на `127.0.0.1:3000`):

```bash
docker exec <app-контейнер> node dist/ops/inbox-purge-smoke.js --confirm-host=<хост БД>
```

- Для не локальной БД скрипт без `--confirm-host=<тот же хост>` отказывается работать (`PURGE_SMOKE REFUSED`, код 2) и ничего не пишет. Имя хоста БД подставляется из `DATABASE_URL`; при отказе скрипт печатает его сам.
- `--base-url=...` нужен только если приложение слушает не на `http://127.0.0.1:3000`.

Что делает скрипт: создаёт служебного пользователя (`purge-smoke-<случайная строка>`) и синтетические элементы с маркером `PURGE_SMOKE_<случайная строка>`: по одному в статусах `RECEIVED`, `DRAFT_READY`, `FAILED`, `CONFIRMED` с `purgeAfter` в прошлом и непустым `draft`, один элемент старше 30 дней и один неистёкший контрольный. Вызывает purge так же, как cron (`GET /api/cron/inbox-purge` с Bearer), проверяет SQL-условиями и удаляет служебные строки.

### Критерий PASS

Последняя строка `PURGE_SMOKE PASS items_created=6 ... failed=0`, код выхода 0, и все проверки `PASS`:

| Проверка | Смысл |
|---|---|
| `purge_route_ok` | маршрут ответил 200 |
| `expired_parts_text_null` | у частей просроченных элементов `text IS NULL` |
| `expired_drafts_null` | у просроченных элементов `draft IS NULL` |
| `old_item_deleted` | элемент старше 30 дней удалён |
| `unexpired_control_untouched` | неистёкший элемент не тронут |
| `marker_not_found` | маркер не найден ни в одной текстовой/JSON колонке таблиц `Inbox*` и `PlanItem` |
| `synthetic_rows_removed` | служебные строки удалены |

Остальные пункты критерия спеки проверяются отдельно:
- в логах job нет содержимого: `docker logs <app-контейнер> --since 1h | grep -c PURGE_SMOKE_` должно быть `0`, а в логе runner только числа и коды;
- cron вызывает job по расписанию: в `/var/log/mamago-notification-jobs.log` есть строки `finish inbox-purge` за последние сутки без `inbox-purge failed`.

### Что делать при FAIL

1. Не включать пилот: `TELEGRAM_CAPTURE_USER_IDS` на PROD остаётся пустым (production gate, спека раздел 15).
2. По имени упавшей проверки:
   - `purge_route_ok` (значение 401/503/0): проверить `CRON_SECRET` в контейнере, что приложение отвечает на `127.0.0.1:3000`, версию деплоя;
   - `expired_*`, `old_item_deleted`, `unexpired_control_untouched`, `marker_not_found`: ошибка в логике purge: передать разработчику имя проверки и числа, исправить и повторить smoke после любого изменения purge.
3. Если запуск оборвали (Ctrl+C, таймаут) и служебные строки остались, удалить их вручную (только служебные):
   ```sql
   DELETE FROM "InboxItem" WHERE "userId" LIKE 'purge-smoke-%';
   DELETE FROM "User" WHERE id LIKE 'purge-smoke-%';
   ```
4. Повторить smoke. Процедуру повторять после любого изменения purge.

## Диагностика recover

- Элемент завис в `PROCESSING`/`RECEIVED`: `inbox-recover` подберёт его в течение нескольких минут. Если он дошёл до `FAILED`, смотреть `InboxItem.error` (`RECOVER_EXHAUSTED`, `PROCESSOR_ERROR`, `CAPTURE_MODEL_NOT_CONFIGURED`, `OPENROUTER_FAILED`, `INVALID_MODEL_OUTPUT`, `TELEGRAM_FILE_FAILED`).
- Recover перезапускает обработку, но не отправляет пользователю сообщений; карточки появятся в PR4.
