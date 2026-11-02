# P0 — инвентаризация отсутствующих User перед адресным восстановлением WordPress (#1064)

**Обновлено 2026-11-02:** исходная база WordPress выведена из эксплуатации. На Mac найден исторический архив `mamago-wp-audit-20260703-034032.tar.gz` с 579 User и полями ID/email/имени. Read-only сверка показала пять отсутствующих в PROD исторических email (ID 7,17,22,42,43). Кроме того, из 571 DEV User только 565 совпадают по нормализованному email с PROD, остальные шесть: `user:43`, два `BUSINESS_OWNER` без credentials и три `USER` с credentials. Другие пять DEV-only аккаунтов **не автоматически кандидаты на перенос**; требуется аудит их назначения и зависимых объектов.

## Scope / ограничения

- **Пока не импортируем никого.** Исторический WordPress audit archive даёт пять кандидатов: source IDs 7, 17, 22, 42, 43. Read-only сверка показала, что их архивные email отсутствуют в PROD; проверять на момент записи нужно повторно. Существующий write CLI `migration:user:exclusion-backfill` по-прежнему **разрешает строго одного `user:43`**, его нельзя использовать для добавления остальных четырёх без отдельно проверенного расширения кода и safety CI.
- При отдельном одобрении в PROD может быть создан **только новый User**, `role=USER`, `status=PENDING_ACTIVATION`, `passwordHash=null`, без старых паролей и передачи бизнес-ролей. Для ID 43 проверяются DEV email и displayName; для IDs 7,17,22,42 — исторический локальный архив и его ограничения по давности.
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

## Полная DEV vs PROD сверка по email, включая не-WordPress пользователей

`migration-wordpress-user-coverage-audit.py` сверяет **миграционные линии
WordPress**, но не все DEV users. Для общего сравнения каждой учётной записи
нужно также выполнить:

```bash
python3 scripts/migration-all-users-dev-prod-audit.py
```

Инструмент делает только SELECT по обеим базам, сравнивает нормализованный
`lower(btrim(email))` и наличие миграционных source keys, выводит
анонимизированные строки для каждого DEV-only пользователя с ролью, статусом,
месяцем создания, наличием credential и источником. Не выводит email,
User.id, имена, пароли, хеши. Если у учётной записи изменён email, но
source key уже есть в PROD, помечает возможное совпадение и **не
разрешает дублирование**. Аккаунты с `deletedAt` не переносятся.

Число пользователей DEV не должно использоваться для определения
полноты PROD: сравниваются именно идентичности и происхождение.

**Последний all-users audit (2026-11-02):** DEV 571, PROD 637, совпадают по нормализованному email 565, только DEV 6, только PROD 72. Из шести DEV-only: один `wordpress-db:user:43`, два `BUSINESS_OWNER` (ACTIVE, NO_PASSWORD), три `USER` (ACTIVE, PASSWORD_SET); у других пяти нет активного WordPress lineage. **Не считать их ошибочно неимпортированными WordPress пользователями без дополнительного доказательства.**

## Решение владельца: подтверждение бизнесов в PROD по УНП

**2026-11-02.** Подтверждение бизнеса в DEV не переносится как доверенное
подтверждение в PROD. Бизнес, который должен работать в PROD, повторно
подтверждается в **самой PROD** по УНП, через существующий механизм сверки
с ГРП и отдельную бизнес-модерацию. В том числе нельзя переносить из DEV
`status=APPROVED`, `verificationStatus=APPROVED`, `isVerified=true`,
`unpVerificationStatus=VERIFIED`, `unpVerifiedAt` или права владельца.

1. **Если УНП уже есть в PROD:** повторно сверить существующую
   запись; **не создавать второй Business** и не менять ownerUserId. Для
   пользователя, который заявляет право на бизнес, использовать штатный
   запрос на доступ с отдельной проверкой полномочий.
2. **Если бизнеса нет в PROD:** бизнес проходит штатное создание/онбординг
   в PROD, с УНП, юридическим названием и подтверждением контактного
   телефона, затем сверку с ГРП и независимую бизнес-модерацию.
3. **Если УНП не задан:** автоматическое подтверждение через УНП невозможно;
   не создавать/не подтверждать бизнес путём слепого копирования DEV.
   Нужно получить корректный УНП и инициировать стандартную процедуру.
4. **Для `user:43`:** при восстановлении User не переносить его DEV
   Business/BusinessMember. Два события уже существуют в PROD; их
   ownership нельзя изменять автоматически.
5. **Важное различие в текущем коде:** `resolveBusinessUnpVerification`
   возвращает `VERIFIED` при положительной сверке с ГРП, но
   `LOOKUP_FAILED`/другие ошибки не блокируют **подачу заявки**:
   `src/app/business/onboarding/actions.ts` использует fail-open.
   `UnpVerificationSection` не меняет `verificationStatus`
   автоматически. Поэтому **повторная сверка УНП ≠ автоматическое
   подтверждение организации или полномочий владельца**. До завершения
   модерации считать бизнес непроверенным. Если продуктовая политика
   требует блокировать *одобрение* при `unpVerificationStatus != VERIFIED`,
   это отдельная P1-задача с серверными guards, тестами и согласованным
   fallback при недоступном ГРП, а не скрытый эффект текущего импортёра.

Это правило **не добавляет PROD writes** в PR #1065 и не расширяет
single-user writer; бизнесы не мигрируются данным PR.

## Подтверждение владельцев существующих PROD объектов (2026-11-02)

Оператор выполнил усиленный `migration-dev-only-ownership-overlap-audit.py`.
Только SELECT; для совпавших бизнесов и событий проверены PROD owner
role/status и WordPress lineage (без вывода PII).

- DEV-only #1/#2: `APPROVED`, но `isVerified=false`, Business без УНП;
  в PROD совпадающего бизнеса нет, `Matching PROD business owners: NONE`.
  Наличие DEV approval не имеет силы в PROD.
- DEV-only #3/#4: бизнесов и событий нет, перенос аккаунта не одобрен.
- DEV-only #5: в PROD ровно один Business с тем же УНП и именем.
  **PROD owner: `role=USER,status=ACTIVE`, WordPress source user ID 538**;
  email владельца *не равен* DEV-only #5. Никакого duplicate Business,
  owner transfer или смены BusinessMember без подтверждения полномочий
  через штатный request-access flow.
- DEV WordPress `user:43`: его два `PUBLISHED` Activity существуют
  в PROD с совпадениями source, slug и title. **PROD owner у обеих —
  `ADMIN,status=ACTIVE`, без WP user source lineage**. Даже после
  восстановления User 43 *не переназначать* их автоматически; если
  нужна передача права управления, требуется отдельное подтверждение
  законного владельца и проверка связанных прав.
- DEV Business пользователя 43: `DRAFT`, без УНП и PROD совпадения;
  **не копировать** автоматически.
- Архивные WP users 7/17/22/42/43 остаются кандидатами на
  **отдельное** восстановление User с безопасными правами. Готовый
  CLI в данном PR разрешает только user:43. Список допусков и
  транзакционный write path для остальных ещё не расширены.

**Ни один PROD User, Business, BusinessMember, Activity не менялся.**

## Итог overlap-аудита 2026-11-02 (read-only)

Вторичный операторский аудит `scripts/migration-dev-only-ownership-overlap-audit.py` подтвердил:

- DEV-only #1 и #2: каждый имеет один `APPROVED` `Business`, `isVerified=false`, без УНП. В PROD нет совпадений по migration source или нормализованному имени. Это **не доказывает, что бизнес реальный**; требуется классификация администратором.
- DEV-only #3 и #4: в DEV не владеют бизнесами или событиями; ранее найдена история входов. Нельзя автоматически считать тестовыми.
- DEV-only #5: бизнес `DRAFT`, `isVerified=false`, с УНП; в PROD найдена ровно одна запись с тем же УНП и именем. **Не создавать второй Business**. Требуется выяснить существующего PROD owner.
- WordPress user:43: бизнес `DRAFT`, без УНП, нет PROD совпадений. Два `PUBLISHED` Activity уже присутствуют в PROD — каждая совпала по миграционному source key, slug и заголовку. **Не импортировать Activity повторно**. Требуется проверить, кто их текущий владелец в PROD.
- Никого не импортировали, не меняли owners, статус публикации и контент.

Расширенный аудит дополнительно выводит **только** role/status и WordPress
source ID действующих PROD владельцев при совпадении source или УНП
для бизнеса и source или slug для Activity (не печатает email/имена/УНП).
Это не разрешение переназначать ownership.

## Проверка связанных бизнесов и событий у DEV-only пользователей

Операторский read-only аудит 2026-11-02 показал 6 DEV-only email:
2 `BUSINESS_OWNER` без пароля, с 1 бизнесом каждый; 3 `USER`
с passwordHash и историей активности, из них 1 владеет бизнесом;
один `wordpress-db:user:43` с 1 бизнесом и 2 событиями.
Перенос User без объектов автоматически не переносит бизнесы/события;
перенос бизнесов из DEV не разрешён этим PR.

Чтобы проверить перекрытия в PROD по source lineage, УНП и имени бизнеса,
а также по source lineage, slug и заголовку событий, выполнить:

```bash
python3 scripts/migration-dev-only-ownership-overlap-audit.py
```

В выводе только счётчики и статусы. Сырые email, имена, УНП, названия
событий и их fingerprint не выводятся. Совпадение по имени/названию
само по себе не доказывает идентичность. Объекты не создаются и не
изменяются. Каждый перенос требует отдельной оценки реальности
аккаунта и доказательства необходимости данных из DEV.

## Сначала полная сверка пользователей (обязательна до любых PROD writes)

Первичное сравнение DEV и PROD показало одного кандидата (`user:43`), но
не доказывает полноты WordPress миграции: отсутствующих **в обеих** базах
пользователей оно не видит. Кроме исходного release-manifest на 564 User,
в репозитории есть более поздний activation-manifest на 578 source keys.
Это **разные исторические срезы**, не повод автоматически создать 578 User.

Чтобы обнаружить пропуски в обеих базах, дубли миграционных связей и
аккаунты с совпадающими нормализованными адресами, сначала запустить
отдельную read-only инвентаризацию из рабочей папки на Mac:

```bash
python3 scripts/migration-wordpress-user-coverage-audit.py
```

Скрипт только читает `dev-db-1`, `prod-db-1` одним SSH-сеансом и
сравнивает исходные ID с checked-in historical manifests. Полные
электронные адреса в вывод не попадают. Он печатает список пробелов
по source keys, не разрешает создание новых пользователей.
При ненулевом списке `absent from BOTH` или противоречиях —
разобраться отдельно и **не запускать write** до завершения проверки.

## Исходный WordPress audit archive (2026-07-03)

После сверки DEV/PROD обнаружен сохранённый оператором архив
`mamago-wp-audit-20260703-034032.tar.gz` с 579 реальными строками
`core/users.tsv`, включая все пять ранее исключённых source ID:
7, 17, 22, 42, 43. Для проверки фактических email без вывода персональных
данных и без записи в базы:

```bash
python3 scripts/migration-wordpress-user-archive-reconcile.py \
  "$HOME/Desktop/mamago2-old-20260717/mamago-wp-audit-20260703-034032.tar.gz"
```

Скрипт читает локальный архив, вычисляет только временные MD5 fingerprint
нормализованных email в памяти, а из DEV/PROD получает fingerprint через
SELECT. Проверяет совпадения email с обеими БД, наличие имени, сходство
маски адреса с историческим activation manifest и DEV lineage пользователя.
Сырые email, хеши и имена в stdout не попадают.

**Внимание:** архив отражает состояние на 2026-07-03. Соответствие или
несоответствие email не доказывает окончательную идентичность и не
разрешает PROD write без ручной проверки. Даже при отсутствии совпадений
нет оснований автоматически создавать аккаунты, если недостаточна
достоверность исходных имён и адресов.

## Следующий этап: строгий PREVIEW всех пяти архивных WordPress User

Уже реализован ограниченный **только read-only** pipeline:
`scripts/migration-wordpress-five-preview-ssh.py` читает неизменённый
локальный `mamago-wp-audit-20260703-034032.tar.gz`, извлекает
**ровно** `user:7/17/22/42/43` (579 исходных строк) и передаёт записи
напрямую в stdin `scripts/migration-wordpress-five-preview.ts`.
Электронные адреса, имена, пароли не выводятся, не сохраняются на диск,
не отправляются в GitHub. Через изолированные SSH-туннели проверяются
`devmamago` и `prodmamago`.

```bash
cd ~/dev/mamago2-worktrees/user-backfill-1064
git fetch origin fix/prod-wordpress-user-additive-backfill-1064
git switch --detach origin/fix/prod-wordpress-user-additive-backfill-1064
python3 scripts/migration-wordpress-five-preview-ssh.py \
  "$HOME/Desktop/mamago2-old-20260717/mamago-wp-audit-20260703-034032.tar.gz"
```

В TS проверяются точный список ID и структура входных данных,
уникальность нормализованных email, совпадение с историческим
activation-manifest, наличие исходного DEV lineage для user:43,
отсутствие в PROD любых lineage с этими sourceRecordKey (в том числе
неактивных) и email-коллизий **включая soft-deleted User**. Для каждого
формируется тот же canonicalHash, который использует существующий
`planUserMigration`, и sourceHash архивного кандидата.

Вывод должен содержать пять `action=CREATE`; любой конфликт
останавливает preview. В отчёте только маски email и проверочные хеши.
**PREVIEW не разрешает импорт и не содержит COMMIT mode.**

Дальнейшая работа: отдельный, ограниченный теми же пятью ID write path
с проверенным манифестом точных source/email/canonical hashes,
одобрением владельца, backup/test-restore, сериализуемыми/идемпотентными
транзакциями, проверкой счётчиков до/после и отсутствием привилегий.
Не включать пяти-пользовательский write в существующую команду для
одного user:43 без независимого security-review и тестов.
Для всех пяти требуется `USER / PENDING_ACTIVATION / passwordHash=null`
без Business, BusinessMember, Activity, Session и отправки писем.
Отдельно проверяем PROD-верификацию бизнеса по УНП и права на объекты.

## Шаг 2 — рекомендованный read-only preview через SSH (без .env)

В этой версии PR предусмотрен отдельный Python 3 CLI-хелпер
`scripts/migration-user-exclusion-preview-ssh.py`. Он:
- читает строго `dev-db-1` и `prod-db-1` через `ssh mamago-prod`;
- проверяет, что PostgreSQL базы действительно называются `devmamago` и `prodmamago`;
- открывает два временных SSH-туннеля, привязанных только к `127.0.0.1` Mac;
- передаёт пароли только в окружение запускаемого процесса и никогда не выводит их;
- запускает **только `--preview --confirm-production`**, не имеет режима записи.

После `git fetch` и обновления worktree до актуального HEAD PR:

```bash
cd ~/dev/mamago2-worktrees/user-backfill-1064
python3 scripts/migration-user-exclusion-preview-ssh.py
```

Отчёт должен содержать `sourceRecordKey=wordpress-db:user:43`, `action=CREATE`,
`emailMask`, `emailSha256`, `canonicalHash`, `sourceHash`. Пароли не выводятся.
Если SSH недоступен, нет двух разных баз или отсутствует ключевой lineage,
операция прерывается без записи.

**Операторский хелпер не предназначен для `--confirm-writes`.** Запись в PROD
остаётся отдельной, требующей индивидуально утверждённый manifest и проверку.

## Шаг 2a — ручное подключение (при необходимости)

### Шаг 2 — предпросмотр в новой ветке PR

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
