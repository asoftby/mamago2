# P0 — адресное восстановление WordPress User 43 из DEV в PROD (#1064)

**Обновлено 2026-11-02:** исходная база WordPress выведена из эксплуатации и недоступна. Запуск старой команды с `WP_SSH_*` / `WP_DB_*` невозможен. Этот сценарий использует только **сохранённого ранее мигрированного пользователя из DEV** и его исходную MigrationLineage как проверяемое подтверждение происхождения.

## Scope / ограничения

- Восстанавливаем **ровно одного** подтверждённого недостающего пользователя: `wordpress-db:user:43`. Остальные 4 исторических исключения имеют исходный USER lineage в PROD.
- В PROD создаётся **новый User**, `role=USER`, `status=PENDING_ACTIVATION`, `passwordHash=null`, без старых паролей. Копируются только проверенные email и displayName из DEV.
- Никакого переноса `Business`, `BusinessMember`, `BUSINESS_OWNER`, сессий, телефонов, подтверждений email, привилегий или иных личных данных.
- Никакого `DELETE`, `UPDATE` существующих User/Business, автоматических писем, обхода защиты администраторов или глобального снятия исторических исключений.
- Исходный WordPress ID сохраняется в новом `MigrationLineage` под отдельным `wordpress-db/dev-user-recovery-1064` namespace. Это явно **восстановление из DEV**, а не повторная миграция из WordPress.
- При наличии любого существующего email без учёта регистра, чужого активного lineage или изменения snapshot операция блокируется. `SKIP_UNCHANGED` без writes применяется только к нашему же прежнему успешно созданному аккаунту.

## Предварительные требования

1. CI и независимое ревью draft PR #1065; без автоматического merge или деплоя.
2. Известна точная DEV и PROD PostgreSQL база (каждая на своём отдельном соединении). Код проверяет фактические `current_database()` = `devmamago` и `prodmamago` и соответствующие имена в строках подключения; не допускается запуск с перепутанными URL.
3. На машине запуска доступны **в двух отдельных локальных SSH-туннелях** обе базы, с закрытыми от вывода логами/командами credentials. Файл `.env` сам по себе не подгружается `prisma.config.ts`: переменные `DATABASE_URL` и `SOURCE_DEV_DATABASE_URL` должны быть реально экспортированы в процесс CLI. Нельзя пересылать значения URL, паролей и ключей в чат.
4. Подтверждена подлинность записи `user:43` в DEV, неактивный (PENDING_ACTIVATION) статус и исходный lineage `wordpress-db/phoenix-release-bundle` (и `sourceEntityType=wordpress-db:user`, `sourceExternalId=43`). Проверены точные email/displayName; старый WordPress источник недоступен, поэтому DEV lineage выступает *историческим* доказательством, а не нынешним внешним источником.
5. Для записи в PROD: свежий полный резервный бэкап PROD, **тестовое восстановление в отдельную БД**, акт подтверждения, отдельно утверждённый манифест (все хеши совпадают), явное разрешение оператора на запись.

## Шаг 1 — read-only проверка с сервера (не требует env)

С рабочей станции:

```bash
ssh mamago-prod 'bash -s' <<'SH'
set -euo pipefail
for db in dev-db-1 prod-db-1; do
  echo "=== $db / WordPress user:43 ==="
  docker exec -i "$db" sh -c '
    export PGPASSWORD="${POSTGRES_PASSWORD:-}"
    exec psql -X -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" \
      -d "${POSTGRES_DB:-postgres}" -P pager=off
  ' <<'SQL'
SELECT l."sourceRecordKey", l."targetType"::text,
       s."adapterKey", s."sourceNamespace",
       l."sourceEntityType", l."sourceExternalId",
       l."isActive", l."lastSourceHash" IS NOT NULL AS has_source_hash,
       CASE WHEN u.id IS NULL THEN 'MISSING' ELSE u.role::text END AS role,
       u.status::text, u."deletedAt" IS NOT NULL AS deleted,
       CASE WHEN u.email IS NULL THEN NULL
            ELSE LEFT(split_part(u.email,'@',1),1) || '***@' ||
                 split_part(u.email,'@',2) END AS masked_email
FROM "MigrationLineage" l
JOIN "MigrationSource" s ON s.id = l."sourceId"
LEFT JOIN "User" u ON u.id = l."targetId"
WHERE l."sourceRecordKey" = 'wordpress-db:user:43'
  AND l."targetType" = 'USER';
SQL
done
SH
```

Это только SELECT, пароли не печатаются. Сверить с исходным расследованием #1064.

## Шаг 2 — предпросмотр в новой ветке PR

На Mac уже есть worktree `~/dev/mamago2-worktrees/user-backfill-1064`. После обновления ветки и установки зависимостей требуются **две разные строки подключения** из безопасных операторских переменных:

- `SOURCE_DEV_DATABASE_URL` → строго `devmamago`
- `DATABASE_URL` → строго `prodmamago`

```bash
pnpm migration:user:exclusion-backfill --preview --confirm-production
```

Не запускать, пока обе строки подключения не настроены, иначе CLI остановится. Режим предпросмотра **не пишет ни в одну базу и не отправляет письма**. В выводе: маска email, `emailSha256`, `canonicalHash`, `sourceHash`, `action=CREATE/BLOCKED/SKIP_UNCHANGED`. Вывод не должен содержать полную почту.

## Шаг 3 — утверждение точного манифеста

После проверки и согласования `action=CREATE` сформировать отдельный непубличный JSON (хеши ниже *заглушки*):

```json
{
  "schemaVersion": 1,
  "issue": 1064,
  "approvedBy": "FOUNDER",
  "approvedAt": "2026-11-02T18:00:00.000Z",
  "entries": [{
    "sourceRecordKey": "wordpress-db:user:43",
    "emailSha256": "<64 lowercase hex>",
    "canonicalHash": "<64 lowercase hex>",
    "sourceHash": "<64 lowercase hex>",
    "action": "CREATE"
  }]
}
```

Точный бинарный SHA-256 проверенного manifest:

```bash
shasum -a 256 /secure/path/user-backfill-approved.json
```

## Шаг 4 — PROD write (только после самостоятельного разрешения)

```bash
pnpm migration:user:exclusion-backfill \
  --confirm-writes --confirm-production \
  --acknowledge-prod-user-import \
  --acknowledge-exclusion-backfill \
  --confirm-backup-restored \
  --backup-reference "VERIFIED-RESTORE-ID" \
  --manifest /secure/path/user-backfill-approved.json \
  --reviewed-manifest-sha256 "<reviewed-manifest-sha256>"
```

Поля `--confirm-backup-restored` / `--backup-reference` — подтверждение человека, а **не автоматическая проверка**; не указывать их без test restore. Перед CREATE код повторно считывает DEV snapshot и PROD, проверяет точное совпадение с манифестом, затем вызывает существующий `writeUserMigration` в SERIALIZABLE транзакции. При конфликте транзакция откатывается; уже существующих пользователей не изменяем.

После создания: сверить число новых User (+1), новых User lineage, число Business и BusinessMember (без изменений), отсутствие коллизий email и корректность USER/PENDING_ACTIVATION. После проверки — отдельная самосервисная активация через сайт, **не массовая рассылка**.

## CI

```bash
pnpm test:migration-user-exclusion-backfill
pnpm exec tsc --noEmit
```

**PR сам по себе ничего в PROD не деплоит и не импортирует.**
