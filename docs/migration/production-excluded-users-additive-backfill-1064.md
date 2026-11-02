# P0 — адресная дозагрузка исключённых WordPress Users в PROD (#1064)

**Режим:** строго аддитивный, пользовательский. Не является миграцией Business, BusinessMember, бизнес-ролей или бизнес-верификации. Никаких автоматических писем.

## Почему этот путь отдельный

Документ `docs/migration/manifests/phoenix-users-founder-exclusions-2026-07-31.json` временно исключает WordPress ID 7, 17, 22, 42, 43 по причине `HISTORICAL_NAME_INPUT_UNRECOVERABLE`. Стандартный `migration:user:live` намеренно их пропускает. Старые DEV-учётные записи (особенно `user:43`) **нельзя копировать напрямую** в PROD.

Создан отдельный `scripts/migration-user-exclusion-backfill.ts`, который работает с **актуальным WordPress источником** и использует существующий проверенный путь `planUserMigration/writeUserMigration`. Только `CREATE` по индивидуально одобренному списку; при повторе `SKIP_UNCHANGED` без каких-либо записей.

## Обязательные условия перед началом

1. Источник WordPress доступен по SSH **с компьютера оператора**. Не переносить запуск на PROD-хост.
2. Проверены PROD `DATABASE_URL` и `SELECT current_database()` = `prodmamago`; используйте обычный SSH-туннель на Mac. Не публиковать URL, пароли, SSH-ключи.
3. Создан полный бэкап PROD и проведено **пробное восстановление в отдельную базу**. Записать идентификатор бэкапа и результат проверки восстановления.
4. Утверждены конкретные исходные WordPress ID и источники идентичности, совпадение email, назначение аккаунта и причина исторического исключения. Не выдумывать исторические имя/фамилию; текущий `display_name` WordPress допустим только при явной проверке пользователем-владельцем миграции.
5. Все существующие PROD пользователи, включая 72 адреса, отсутствующих в DEV, остаются неизменными. `user:1` — администратор, никогда не кандидат на создание. DEV `example.invalid` и `mamago.local` — тестовые данные, не переносить.
6. Успешны CI + независимое ревью PR и review конкретного manifest. **Ни один из этих пунктов не предполагается выполненным автоматически.**

## Шаг 1. Read-only preview

Из корня репозитория на Mac, с настроенными переменными подключения к WordPress и PROD:

```bash
pnpm exec tsx scripts/migration-user-exclusion-backfill.ts \
  --preview --confirm-production --allow-remote-readonly
```

Вывод включает для пяти исключённых WordPress ID: `sourceRecordKey`, `action` (`CREATE`, `BLOCKED`, `SKIP_UNCHANGED`), маску адреса, `emailSha256`, `sourceHash`, `canonicalHash`. **Ни писем, ни изменений БД.** Режим проверки может выявить, что часть ID уже существует в PROD или имеет конфликт — такой аккаунт нельзя создавать повторно.

После preview сверить эти данные и статус восстановления с живой базой, документированными исключениями и первоначальным источником. В случае `BLOCKED` — расследование, не обход защиты.

## Шаг 2. Утверждённый manifest

Файл создаётся **только после проверки**; его нельзя генерировать как автоматическое разрешение на запись. Пример формата (значения хешей — заполняются из проверенного preview, ниже *фиктивные*, не применять):

```json
{
  "schemaVersion": 1,
  "issue": 1064,
  "approvedBy": "FOUNDER",
  "approvedAt": "2026-11-02T18:00:00.000Z",
  "entries": [
    {
      "sourceRecordKey": "wordpress-db:user:43",
      "emailSha256": "<64 lowercase hex>",
      "canonicalHash": "<64 lowercase hex>",
      "sourceHash": "<64 lowercase hex>",
      "action": "CREATE"
    }
  ]
}
```

`entries` должны быть в лексикографическом порядке по `sourceRecordKey`. Допускаются **только** ID 7, 17, 22, 42, 43; никаких других. Без полных адресов email, паролей или токенов. Избегайте включения реальных персональных хешей в публичные PR и комментарии: храните файл вне репозитория с ограниченным доступом. Дата и факт согласования должны быть действительными.

Повторная проверка manifest без записей:

```bash
pnpm exec tsx scripts/migration-user-exclusion-backfill.ts \
  --preview --confirm-production --allow-remote-readonly \
  --manifest /secure/path/user-backfill-approved.json
```

**Если изменился email, `sourceHash` или `canonicalHash`, операция остановится.** Также стоп при иной роли, ином статусе нового пользователя, конфликте email (без учёта регистра), несовпадении/дублировании lineage или уже занятом WordPress ID.

## Шаг 3. Запись только по отдельному подтверждению

Сначала зафиксировать хеш **ровно тех байт** manifest, которые независимо проверены:

```bash
shasum -a 256 /secure/path/user-backfill-approved.json
```

После письменного подтверждения точного состава и успешного test-restore:

```bash
pnpm exec tsx scripts/migration-user-exclusion-backfill.ts \
  --confirm-writes --confirm-production \
  --allow-remote-readonly \
  --acknowledge-prod-user-import \
  --acknowledge-exclusion-backfill \
  --confirm-backup-restored \
  --backup-reference "RESTORE-TEST-ID" \
  --manifest /secure/path/user-backfill-approved.json \
  --reviewed-manifest-sha256 "<reviewed-manifest-sha256>"
```

`--confirm-backup-restored` и `--backup-reference` — **операторские подтверждения**, а не автоматическая техническая проверка восстановления. Не передавать флаги до выполнения проверки.

Скрипт повторно сверяет source и target непосредственно перед каждым `CREATE`, использует SERIALIZABLE транзакцию существующего `writeUserMigration`, не создаёт Business/BusinessMember, не повышает роль и не отправляет писем. Он не меняет существующих пользователей. Миграционный ledger создаётся только для новых User. При неожиданном конфликте запуск останавливается; уже завершённые записи не удаляются (при возобновлении `SKIP_UNCHANGED` без writes).

После запуска сверить ожидаемую прибавку User, отсутствие изменения Business/BusinessMember, целевые User/lineage, отсутствие дублей. Затем отдельно проверить **индивидуальную** активацию (`PENDING_ACTIVATION`) и доставку писем в рамках #1060. Массовую рассылку не включать.

## Проверки к PR

```bash
pnpm exec tsx --test src/lib/migration/commit/user/productionExclusionBackfillPolicy.test.ts
pnpm exec tsc --noEmit
```

**Никаких автоматических деплоев или PROD-импортов в рамках PR.**
