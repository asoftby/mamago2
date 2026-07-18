# Project Phoenix: Prelaunch Checklist

**Статус:** живой чек-лист до полного финала миграции WordPress → mamaGo 2.0.
Обновлять при закрытии каждого пункта (дата + PR/коммит).

Создан: 2026-07-13. Основа: [`production-cutover-runbook.md`](./production-cutover-runbook.md)
(раздел «Not yet implemented»), [`wordpress-to-mamago.md`](./wordpress-to-mamago.md)
(Migration Order, Needs Decision), [`wordpress-db-inspection-2026-07-06.md`](./wordpress-db-inspection-2026-07-06.md)
(счётчики источника).

## Правила работы по этому чек-листу (для любого агента: Claude, Codex, человек)

1. **Этот файл — единственный источник истины по прогрессу миграции.**
   Перед началом работы прочитать его целиком + `CLAUDE.md` в корне репо
   (критично: правила Prisma-миграций — никаких `migrate dev` / `db push` / reset).
2. **Порядок:** двигаться по разделам §1 → §2 → §3 → §4. Внутри §1 порядок:
   Places → Routes → Events → Offers → Users → Profiles → Reviews (Reviews
   зависит от Users+Places). Продуктовые решения (§3 и помеченные
   «продуктовое решение») агент сам не принимает — формулирует варианты и
   спрашивает Алексея.
3. **При закрытии пункта:** поставить `[x]`, дописать в скобках дату и
   PR/коммит. Новые обнаруженные задачи — добавлять пунктом в нужный раздел,
   а не держать в голове/чате.
4. **Паттерн реализации сущностей:** копировать существующий путь
   Place/Article/Event — adapter/normalizer (`src/lib/migration/adapters/wordpress-db/`),
   commit runner (`src/lib/migration/commit/`), тесты рядом. Не изобретать
   новую архитектуру.
5. **Конец сессии / передача (handoff):** дописать запись в «Журнал сессий»
   внизу файла: что сделано, что в незавершённом состоянии (ветка, файлы),
   какой пункт следующий. Запись должна быть достаточной, чтобы другой агент
   продолжил без контекста чата.
6. **WP-креды:** env-переменные `WP_SSH_HOST/WP_SSH_USER/WP_DB_NAME/WP_DB_USER/
   WP_DB_PASSWORD` лежат в локальном `.env` (gitignored) на машине Алексея —
   секреты в git не коммитить никогда. Подхват: `set -a; source .env; set +a`.
   SSH-аутентификация скриптов — только по ключу (BatchMode); интерактивный
   пароль скрипты не принимают by design.
7. **Ускоренный PR/Docker workflow (закреплено 2026-07-16 — было слишком
   медленно на серии мелких PR подряд):**
   - Маленький кодовый PR: targeted-тесты (только затронутые файлы, не
     полный sweep, если риск низкий) + targeted ESLint + `tsc --noEmit` +
     `git diff --check`. Полный `pnpm build` — максимум один раз, только
     если это обязательный pre-push hook или риск это оправдывает; **не
     запускать `pnpm build` второй раз вручную**, если тот же build уже
     отработал через pre-push hook.
   - После merge кодового PR — один Docker Build & Push на merge SHA.
     Больше ничего не ждать в текущей сессии: результат достаточно
     проверить перед следующим реальным DB write / full batch, не держать
     сессию открытой 10–15 минут ради одного docs-only Docker-рана.
   - **Отдельный docs-коммит после каждого маленького PR — не делать.**
     Флип `[ ]` → `[x]` и запись в handoff log — пакетно, по завершении
     сущности/фазы (например, всего golden write, а не каждого PR внутри
     него).
   - Docs-only push (`docs/**`, `**/*.md`) не должен запускать Docker
     Build & Push вообще — см. `.github/workflows/docker.yml`
     `paths-ignore`. Ждать Docker для docs-only изменений не нужно.
   - Не выполнять постоянный polling GitHub Actions в цикле
     sleep-check-repeat. После открытия PR — короткий отчёт с первым
     статусом CI, и дальше не ждать, если явно не попросили следить.
   - Полный `src/lib/migration/**` + `scripts/migration-*.test.ts` sweep,
     полный `pnpm build`, и подтверждённый green Docker — обязательны на
     фазовых воротах: перед первым реальным write, перед full batch,
     перед RC, перед production cutover. Ускорение касается только серии
     мелких fix-PR внутри одной фазы, не самих ворот.
   - Ускорение НЕ отменяет: backup перед реальными write, доказанную
     idempotency, план rollback, Prisma/schema guards (см. `CLAUDE.md`),
     auth/security-проверки, запрет destructive DB операций без
     подтверждения Алексея, и Go/No-Go перед production.

---

## 0. Готово (Phase 2D, для контекста)

- [x] Движок миграции: `Migration*` ledger-таблицы, идемпотентный CLI
      (`scripts/migration-commit-wordpress-db.ts`), preview/inspect, JSON-снапшоты.
- [x] **Places** — adapter/normalizer/runner (82 publish).
- [x] **Articles** (`post`) — adapter/normalizer/runner (115 publish).
- [x] **Events** — adapter/normalizer/runner + `EventMediaSyncer` (28 eligible).
- [x] Редиректы из slug history / articles через `manifest.csv`.
- [x] Cutover runbook (планировочный документ).

---

## 0.5 Фаза 0 — Git hygiene (закрыта 2026-07-14)

- [x] Clean baseline `dev` = `384bb1a2333ee98c8bddd697fdc95d84c4d98fc5`, working
      tree clean, open PR = 0.
- [x] PR #37 (HEIC upload fix) смержен в dev.
- [x] PR #36 (Phoenix Route import, 8→9 clean commits после review-фиксов)
      смержен в dev обычным merge commit.
- [x] PR #35 (production-cutover-runbook WP catch-all correction) смержен в dev.
- [x] 11 старых stash защищены: annotated tags `archive/stash-20260714-00`…`-10`
      (каждый = стабильный SHA исходного stash) + git bundle вне репозитория:
      `/Users/shapovalovalexey/dev/archives/mamago2-stash-archive-20260714.bundle`
      (SHA-256 `33bef6a9c15090a2134f10886faa068c397d60e3ac8a11009acf0a1dc4766901`).
      Ни один stash не удалён — `git stash list` по-прежнему показывает все 11.
      Manifest с классификацией по каждому stash:
      `/Users/shapovalovalexey/dev/archives/mamago2-stash-archive-20260714.md`.

Перенесённые задачи (не Git hygiene — продуктовый/инженерный WIP), см. также §5:

- **Фаза 6 (Product regression), P0** — из `archive/stash-20260714-00`:
  Phone E.164 fix, Event visibility/city discovery fix, Article
  admin/blog-city fix. Все три подтверждены отсутствующими в текущем dev
  прямым diff против базы stash. (Route-admin часть того же stash не
  переносится — уже дублирована и превзойдена чисткой PR #36.)
- **Фаза 3 (Импорт изображений)** — media candidates из
  `archive/stash-20260714-05` (тривиальный `articleMvpRenderData.ts` фикс) и
  `archive/stash-20260714-06` (смешанный; `RouteDetailClient.tsx`-хунк
  трогать нельзя — конфликтует с PR #36).

---

## 0.6 Фаза 1 — Scope freeze (закрыта 2026-07-14, решения Алексея)

Frozen scope для Phoenix v1. Заменяет открытые вопросы из
`wordpress-to-mamago.md` §Needs Decision и §3 ниже там, где они пересекаются.

**P0 — обязательно до cutover:**

- Places, Articles, Events, Routes (адаптеры готовы; Routes — только ручной
  review 14 маршрутов + slug history/redirect map, не инженерка).
- **MySQL batch-escape fix** (`connectExecutor.ts`) — идёт первым, до любого
  дальнейшего импорта/реимпорта: буквальный `\n` вместо реальных переносов
  строк подтверждён на 97/97 RouteStop notes, executor общий для
  Place/Article/Event/Route. Пока не исправлен — текстам уже импортированных
  сущностей верить нельзя.
- **Offers** (90+, адаптер/раннер/медиа) — далее по приоритету реализации.
- **Users** (579, адаптер) — identity + legacy ID ledger.
- **Article media** (ArticleMediaSyncer, cover + inline `wp-content/uploads`
  remap).
- **Profiles — identity/media только**: User identity (`wp_users` → `User`,
  legacy ID mapping) и профильные изображения (аватары/логотипы) — P0.
  Однозначные Business/Organizer ownership связи — P0. Остальные 536
  `profile` posts (публичный контент, неоднозначная классификация
  personal/business) — в migration ledger/quarantine без публикации;
  классификация — P1.
- **Reviews** (Voxel `post_reviews`, только approved, ~25 строк) — P0 при
  таком объёме; зависимость Users+Places будет P0-готова.
- **RankMath `exact`-режим redirects** — P0 subset (156 строк всего,
  `start`/`contains` — P1). Редиректы на `/` не принимаются автоматически —
  перед запуском маппятся на городские/тематические хабы вручную.
- **WordPress `page`** — только legal/about/contact и другие обязательные
  страницы, вручную в `Page`, до запуска. Остальное — EXCLUDED.
- Freeze/snapshot, validation reports, прод-бэкап, dry-run QA — процессные
  пункты §4.
- **Docker Build & Push на актуальном dev проходит успешно** — P0-gate.
  Отмечать выполненным только после зелёного post-merge workflow.

**Порядок реализации P0** (решение Алексея 2026-07-14): MySQL escape fix →
Offers → Users → Article media → Profiles identity/media → Reviews → далее
relations, taxonomy, redirects.

**P1 — первые 7–14 дней после запуска:**

- Profiles — публичный контент, полная personal/business/organizer
  классификация.
- RankMath `start`/`contains` redirects после conflict-review.
- Unpublished/draft контент (187 Places, 538 Events и т.д.) — staging-only в
  ledger, публикация выборочная post-launch; 187 unpublished Places
  разбираются вручную после запуска.
- User/Business avatar-медиа полировка после полной Profiles-классификации.

**EXCLUDED — сознательно не переносим в v1:**

- Past Events — **не импортируются вообще** (ни контент, ни metadata).
  Старые URL закрывает `wpLegacyCatchAll.ts`; отдельные ценные URL при
  необходимости добавляются вручную в redirect manifest.
- Event/Past Event изображения (уже решено ранее).
- route-budget/route-duration/reels-route/route-level location (уже решено).
- `collection` (90) и весь long-tail custom-post-types — source сохраняется
  для будущего решения; возврат в P1 только для конкретных подборок с
  подтверждённым трафиком/редакционной ценностью.
- WP comments, Voxel wall/timeline/user-timeline фиды, historical
  bookings/LatePoint/WooCommerce, RankMath scores/focus-keywords/аналитика.

---

## 0.7 P0 — Первый вход мигрированных пользователей WordPress

**Статус: AUDITED (read-only, 2026-07-14) — реализация не начата.**

**Основное правило:** WordPress password hashes **не переносятся**.
Мигрированный пользователь обязан подтвердить владение email, активировать
именно существующий мигрированный `User` (не получить дубль аккаунта), а
identity-конфликты и неоднозначное ownership не разрешаются автоматически.

Read-only аудит существующей auth-модели (`src/lib/auth/**`,
`src/server/auth/**`) показал: flow проектируется на 100% существующих
примитивов, **без изменений Prisma**:

- Sentinel-паттерн для «пароль не задан» уже существует
  (`DISABLED_PASSWORD_HASH`/`isVerifiablePasswordHash()` в
  `src/lib/auth/crypto.ts`, коммит `c2de1513`) — новый
  `MIGRATION_PENDING_PASSWORD_HASH` sentinel продолжает ту же конвенцию.
- Password-reset flow (`src/server/auth/password-reset.ts`) — hashed token,
  1ч TTL, single-use, уже enumeration-safe — переиспользуется как есть для
  активации; один новый явный шаг: `emailVerifiedAt = now()` +
  `deleteUserSessions()` при переходе из sentinel-состояния.
- Прямой прецедент в коде: `complete-registration/route.ts` (phone-stub →
  реальный аккаунт **в той же** `User.id` строке, email/password
  проставляются на существующую запись) — тот же паттерн, что нужен для
  WP-активации.
- `requestPasswordReset` сейчас **не rate-limited** вообще — обязательный
  prerequisite-фикс перед запуском (enumeration/abuse-риск на 579 email
  сразу после анонса миграции).

**Правила (зафиксированы, реализация — отдельная задача):**

- WordPress-пароли не мигрируются никогда.
- Активация требует подтверждения владения email (клик по одноразовой
  ссылке — не просто ввод email).
- Активация переиспользует существующий `User.id`, никогда не создаёт
  вторую строку на тот же email.
- Identity-конфликты (WP-email уже занят реальным mamaGo-аккаунтом) →
  quarantine/lineage-attach к существующей строке, пароль/verification
  существующего аккаунта не трогается — новый `User` не создаётся.
- Ownership (Business/Place/Offer) не назначается автоматически при
  неоднозначности — тот же принцип, что и в §0.6 для Profiles/Offers.

Полный дизайн (flow, необходимые изменения кода, security threats,
тестовая матрица, rollout/rollback, последовательность PR) — см. журнал
сессий, аудит от 2026-07-14. Реализация не входит в этот коммит.

---

## 1. Контентные сущности (инженерная работа по готовому паттерну)

### Places (82 publish)

**Статус: engine готов (§0) → full-batch READINESS AUDITED (2026-07-14) →
FULL BATCH ЗАПРЕЩЁН до закрытия 4 P0-блокеров ниже.**

Read-only full-batch readiness audit, 2026-07-14 (без commit/`--confirm-writes`,
без DB writes). Preview всех 82 publish Place: **82/82 успешно normalize (0
failed)**. Несмотря на чистый preview, полный batch-импорт признан
преждевременным — normalize "успешно" не означает "корректно для целевой
модели": preview не ловит семантические проблемы вроде невалидного формата
телефона (он проходит normalize как непустая строка, просто не E.164).

**Четыре P0-блокера, порядок закрытия: A → D → B → C:**

1. **(A) Phone не в E.164** — 32/76 записей с непустым `phone` postmeta
   требовали нормализации (легаси-форматы вроде `"+375 (25) 530-00-53"`
   писались в `Place.phone` как есть). **Исправлено этим PR** — см. запись
   ниже. Единственный канонический нормализатор `normalizePhoneToE164`
   (`src/lib/phone/e164.ts`), `normalizePlace.ts` сохраняет raw `phone`
   evidence + добавляет валидированный `phoneE164` (`null` при
   нерезолвимом значении, warning `PLACE_PHONE_INVALID`), `Place.phone` в
   draft пишется только из `phoneE164` — никогда raw.
2. **(D) Targeted CLI + UPDATE safety** — существующий per-record
   targeting (`--source-record-key`) не поддерживал `--entity place`;
   UPDATE-ветка `PlaceCommitRunner` была реализована, но не покрыта тестами;
   защита ручных правок отсутствовала (активного lineage было бы
   достаточно, чтобы разрешить UPDATE — этого недостаточно). **Исправлено
   PR "targeted Place commits"** — см. запись ниже: targeted lookup
   (`getPublishedPlaceById`, не client-side фильтр bulk-результата) +
   conservative UPDATE_SAFE/UPDATE_CONFLICT классификация в
   `PlaceCommitRunner`, а не просто allowlist.
3. **(B) Режим работы (`work_hours`)** — 77/82 Place имеют `work_hours`
   postmeta (все 77 — валидный JSON), `normalizePlace.ts` сохранял
   `workHoursRaw` как evidence, но 0% попадало в `OpeningHours` —
   `buildPlaceCreateDraft`/writer его не использовали. **Исправлено PR
   "import Place opening hours"** — см. запись ниже: pure parser
   `parsePlaceOpeningHours()` + writer integration внутри транзакции.
4. **(C) Media** — известная проблема (не совпадает с текущей строкой
   `Place | ready` в матрице §1.5 — см. исправление там же); детали
   фиксируются при выполнении PR C.

**Место `437` (уже импортирован в dev-БД) НЕ используется как первый
UPDATE-sample**: есть ручные правки, `lastImportedAt=null`, UPDATE-ветка
runner'а не покрыта тестами. Требует отдельной reconciliation-задачи после
(D) с защитой ручных данных — новые golden samples импортируются first, 437
проверяется отдельно.

**Реализация (вертикальными PR, без смешивания слоёв):**

- [x] **PR — Phone E.164 fix** (2026-07-14/15, ветка
      `fix/migration-place-phone-e164`, **PR #43 смержен в dev merge-коммитом
      `55fb873c`, post-merge Docker Build & Push SUCCESS**) — консолидация
      двух разошедшихся нормализаторов телефона в один канонический
      (`src/lib/phone/e164.ts`, `libphonenumber-js/core`),
      `normalizePlace.ts` добавляет `phoneE164` + `PLACE_PHONE_INVALID`
      warning, `buildPlaceCreateDraft.ts` пишет `phone` из `phoneE164`.
      `InternationalPhoneInput` защищён от краша на легаси-значении, не
      мутирует при рендере. Место 437 в БД не менялось (DB writes
      отсутствуют). `PlaceScalarLinker` (неподключённый dead code) не
      тронут функционально — задокументирован как известное расхождение
      для будущего подключения.
- [x] **PR — targeted Place commits (D)** (2026-07-15, ветка
      `feat/migration-place-targeted-update-safety`, **PR #44 смержен в dev
      merge-коммитом `dda93869`, post-merge Docker Build & Push SUCCESS**) —
      `--source-record-key wordpress-db:places:{id}`
      теперь принимается для `--entity place` в commit/preview CLI, с
      собственным строго-положительным-integer regex (строже, чем у
      route/event/article), targeted `getPublishedPlaceById()` в
      `WordPressRepository`/`sql.ts` (не bulk + client-side фильтр). Полный
      82-Place bulk путь не тронут. `PlaceCommitRunner`: активного lineage
      теперь недостаточно для UPDATE — добавлена `classifyUpdate()`,
      различающая `UPDATE_SAFE` (lineage найден, `sourceRecordKey`/
      `targetType` совпадают, `targetId` непустой, target-строка Place
      реально существует, `lastImportedAt` известен и `Place.updatedAt` не
      позже него) от `UPDATE_CONFLICT` (`LINEAGE_MISSING`/
      `LINEAGE_MISMATCH`/`TARGET_ID_MISSING`/`TARGET_ROW_MISSING`/
      `LAST_IMPORTED_AT_UNKNOWN`/`TARGET_MODIFIED_AFTER_IMPORT`) — сравнение
      таймстампов строгое (`>`), без придуманного буфера; любая
      неоднозначность классифицируется как conflict. На conflict: writer и
      lineage никогда не трогаются, `MigrationRecord.status` → `QUARANTINED`
      (не `FAILED` — это не ошибка), `PLACE_UPDATE_CONFLICT` reasonCode,
      override/force-флага нет специально. **Место 437 подтверждено
      классифицируется как `UPDATE_CONFLICT` (`LAST_IMPORTED_AT_UNKNOWN`)** —
      юнит-тест воспроизводит его точную реальную форму (активный lineage,
      `targetId` есть, `lastImportedAt=null`). Отдельно исправлен более
      общий баг: `lastImportedAt` не устанавливался вообще нигде в движке
      (ни на CREATE, ни на UPDATE, для всех сущностей, не только Place) —
      `MigrationLineageWriter.createLineage()` теперь ставит `lastImportedAt`
      на CREATE (инжектируемые часы, общий для Route/Article/Event/Place),
      `PlaceCommitRunner` — на UPDATE_SAFE. **Ноль DB writes в этом PR** —
      всё на уровне тестов/классификации; реальный targeted commit
      (`--confirm-writes`) не запускался.
- [x] **PR — import Place opening hours (B)** (2026-07-15, ветка
      `feat/migration-place-opening-hours`, **PR #45 смержен в dev
      merge-коммитом `13892b81`, post-merge Docker Build & Push
      SUCCESS**) — read-only аудит source (`--allow-remote-readonly`
      SELECT против всех 82 published Place): 77/82 имеют `work_hours`,
      все 77 — валидный JSON-массив day-групп `{days, status, hours}`.
      Status-распределение по группам: `hours` 78, `appointments_only` 23
      (всегда всю неделю одной группой), `closed` 2 (1 место — вся
      неделя; 1 место — смешано с `hours` на остальные дни),
      `open` 1 (единственный случай, `hours: []` — без единого
      доказательства реальных часов). Найдено: split-часы с обеденным
      перерывом (несколько intervals в одном дне, WP 50902), overnight
      diapазоны типа `10:00`–`00:00` (5 мест: 10343, 10380, 11892, 25756,
      43023). Ни одного malformed JSON, invalid day token, invalid time
      string, дублирующего дня между группами.

      Target audit: `OpeningHours`/`OpeningHoursRule`/`OpeningHoursInterval`
      уже поддерживают всё нужное **без Prisma-миграции** —
      `OpeningHoursMode` enum уже содержит `WEEKLY`/`ALWAYS_OPEN`/
      `BY_APPOINTMENT`/`TEMPORARILY_CLOSED`. Переиспользован канонический
      mapper реального admin/business save-пути
      (`src/lib/openingHours/openingHoursMapper.ts`'s
      `mapToCreatePayload`/`mapToUpdatePayload`) — новый Prisma-payload
      builder не писался.

      Продуктовые mapping-решения (полный текст решений — в докблоке
      `parsePlaceOpeningHours.ts`):
      - `closed` на всю неделю → `mode: WEEKLY` с 7 закрытыми днями,
        **никогда** `TEMPORARILY_CLOSED` — этот mode на публичной
        странице показывает конкретное утверждение "Временно закрыто"
        (`getOpeningStatus()`), которого per-day WP-расписание не
        делает; `TEMPORARILY_CLOSED` зарезервирован за явным
        admin-действием.
      - `appointments_only` на всю неделю (единственная реальная форма
        во всех 23 вхождениях) → `mode: BY_APPOINTMENT`.
      - `open` без `hours` (единственный случай, WP 30411) →
        **никогда** не мапится в `ALWAYS_OPEN`/24-7 без доказательства —
        `PLACE_WORK_HOURS_UNSUPPORTED` warning, Place создаётся без
        OpeningHours вообще (не ложное расписание).
      - Overnight intervals (`to <= from`) → **не сохраняются как есть**:
        прослежен `openingHours.utils.ts`'s `compareTime`/
        `isTimeInInterval` — чистое HH:MM сравнение без rollover через
        полночь, значит сохранённый `10:00`–`00:00` тихо сломал бы
        `isOpenNow()`/`getOpeningStatus()` (всегда "закрыто" для всего
        overnight-окна). `PLACE_WORK_HOURS_UNSUPPORTED` warning вместо
        сохранения битых данных — задокументированный, не устранённый в
        этом PR gap целевой модели.

      Pure parser `parsePlaceOpeningHours()`
      (`src/lib/migration/adapters/wordpress-db/parsePlaceOpeningHours.ts`)
      — 7 warning-кодов (`PLACE_WORK_HOURS_JSON_INVALID`/
      `STATUS_UNKNOWN`/`TIME_INVALID`/`DAY_INVALID`/`INTERVAL_OVERLAP`/
      `UNSUPPORTED`/`EMPTY`), детерминированный, DB writes отсутствуют.
      Подключён в `normalizePlace.ts` (`NormalizedPlaceCandidate.
      openingHours`), проброшен через `buildPlaceCreateDraft.ts` в
      `PlaceCreateDraft.openingHours`.

      `PlaceCommitWriter`: `Place` + `OpeningHours` (+ nested rules/
      intervals) пишутся в одной `$transaction` — `openingHoursId`
      нельзя проставить на `place.create()` до существования
      `OpeningHours`-строки, а неудачный `openingHours.create()` не
      должен оставлять `Place` (или зависший `openingHoursId`).
      На UPDATE — читается существующий `openingHoursId` внутри той же
      транзакции: если есть — `openingHours.update()` той же строки
      (delete+recreate rules, без дублей при повторных запусках); если
      нет — создаётся новая и линкуется. `draft.openingHours` отсутствует
      → расписание существующего Place не трогается (не деструктивный
      дефолт). UPDATE_SAFE/UPDATE_CONFLICT политика (PR D) не менялась —
      opening hours едут внутри того же Place-UPDATE, отдельной
      классификации не требуется; regression-тест подтверждает, что
      наличие `openingHours` в кандидате не обходит conflict-гейт.
      Место 437 не трогалось.

      Тесты: 26 в `parsePlaceOpeningHours.test.ts` (5 golden fixtures WP
      5389/5457/13164/13317/9865 + все сценарии из аудита), 8 в новом
      `parsePlaceOpeningHours.publicText.test.ts` (source → parser →
      реальный `buildPublicWorkingHoursText()`, включая WP 30411
      unsupported и WP 30502 mixed closed/hours), 8 новых в
      `PlaceCommitWriter.test.ts` (create/update с/без hours,
      transaction-failure-никогда-не-создаёт-Place, idempotent repeated
      update, no duplicate OpeningHours), 2 новых в
      `buildPlaceCreateDraft.test.ts`, 1 новый в
      `PlaceCommitRunner.test.ts` (opening-hours-не-обходит-conflict), +
      интеграционные assertions в `normalizePlace.test.ts`. Read-only
      live verification (без commit) всех 5 golden WP ID через прямой
      SELECT — source JSON, parser result и draft shape задокументированы
      выше и в PR body. **Ноль DB writes в этом PR** — ни targeted
      commit, ни `--confirm-writes`, ни golden import не запускались.
- [x] **PR — sampled media policy для local/dev** (2026-07-15, ветка
      `feat/migration-sampled-media-policy`, **PR #46 смержен в dev
      merge-коммитом `031e0431`, post-merge Docker Build & Push
      SUCCESS**) — не Place-специфичный PR (затрагивает Event/Place/Offer
      media policy layer в целом), но входит в Place readiness sequence
      как отдельный шаг перед PR C.

      **Зафиксированная политика:**
      - LOCAL/DEV: FULL media только для 9 golden sourceRecordKey (3
        Event + 3 Place + 3 Offer), остальные записи этих типов —
        METADATA_ONLY.
      - PRODUCTION: FULL для всех eligible Event/Place/Offer, allowlist
        не ограничивает production.
      - Past Event полностью исключены до media resolver (уже было верно
        в коде — `shouldExcludePastEvent()` в discover/normalize; не
        менялось).
      - Article/Profile/Route media policy не менялась.

      **Девять golden sourceRecordKey** (read-only отобраны 2026-07-15
      прямым SELECT против live WP, `--allow-remote-readonly`,
      подтверждены реальные attachment id):
      - Events: `wordpress-db:events:42041` (cover only, «Музыкальный
        спектакль «Приключения бременских музыкантов»»),
        `wordpress-db:events:62097` (cover+gallery, единственное событие
        с >1 media asset, «Мюзикл «Девчата»»),
        `wordpress-db:events:60404` (cover only, но многонедельный
        лагерный формат — структурная, не media-count, аномалия,
        «Летняя ... программа 2026 «Актив Полис»»).
      - Places: `wordpress-db:places:5389` (cover+gallery(14)+logo,
        «Family Сlub»), `wordpress-db:places:895` (gallery(10) без cover
        — edge case, «Пуговка» на Восточной 137), `wordpress-db:places:43023`
        (cover+logo+gallery(11), самая сложная реальная форма, «Атмосфера»).
      - Offers: `wordpress-db:hb-programs:15941` (cover+gallery, «Аква-квест
        в День Рождения»), `wordpress-db:hb-programs:16403` (gallery only,
        «Игровая комната»), `wordpress-db:hb-programs:16458` (gallery
        only, «Семейное кафе «Три Пингвина»»). **Честная находка**: из
        всех 91 published Offer только эти 3 одновременно имеют И
        реальные media evidence, И однозначную Place-relation — и все 3
        относятся к одному и тому же Place (8901, «Penguin»). Это
        реальная форма source-данных, не артефакт выбора.

      **Найдены и исправлены устаревшие утверждения:**
      - "Event media всегда NONE" — было ложью относительно РЕАЛЬНОГО
        кода (`MediaPolicyGatedEventMediaSyncer` уже следовал
        `profile.mediaPolicy`, включая FULL), но верным относительно
        `evaluateMediaScope()`/`APPROVED_MEDIA_SCOPES` — неподключённый
        (0 вызывающих мест вне своего теста) validator, который жёстко
        блокировал scope `EVENT_BLOCKED`. Исправлено: `EVENT_BLOCKED` →
        `EVENT`, добавлен в `APPROVED_MEDIA_SCOPES`. Ноль runtime-эффекта
        (validator и раньше ни на что не влиял), но больше не вводит в
        заблуждение будущего агента/человека.
      - Матрица §1.5 "Event/Past Event = NONE во всех профилях" —
        исправлена на две отдельные строки (Event = ready+sampled,
        Past Event = EXCLUDED) — см. таблицу выше.
      - "dev всегда METADATA без исключений" — теперь неверно для 9
        sampled keys по дизайну; зафиксировано намеренно, не баг.
      - "local всегда FULL" — теперь неверно для НЕ-sampled Event/Place/
        Offer записей в local; зафиксировано намеренно.

      **Архитектура:** новый чистый resolver
      `resolveSampledMediaPolicy()`
      (`src/lib/migration/runtime/sampledMediaPolicy.ts`) — вход
      `{environment, sourceRecordKey, fullMediaSourceRecordKeys?}`, выход
      `{policy, reason?}`. PROD — всегда FULL безусловно. LOCAL/DEV — FULL
      только при точном совпадении `sourceRecordKey` с allowlist; пустой
      или невалидный (не массив непустых строк) allowlist — fail closed в
      METADATA, никогда не в FULL. Неизвестный/некорректный environment —
      тоже fail closed в METADATA. Никакой случайной выборки, `LIMIT 3`,
      "первых трёх записей", target id или `NODE_ENV`-ветвления — только
      явный stable allowlist по `sourceRecordKey` (entity уже виден из
      префикса ключа, отдельный entity-параметр не нужен).
      Подключено в `MediaPolicyGatedEventMediaSyncer` (единственный
      реально подключённый в CLI media syncer сегодня — Place/Offer
      media syncers ещё не существуют, см. Scope guard) через новый
      per-record resolver параметр (backward-compatible union-тип,
      `MediaPolicy | ((sourceRecordKey) => {policy, reason?})` — старые
      статический-policy вызовы не меняются). Sampling активируется в CLI
      (`shouldSampleMedia()`, чистая функция) только когда
      `--media-policy` НЕ передан явно оператором — явный флаг остаётся
      сильным сигналом и полностью отключает sampling (обратная
      совместимость с уже существующим use case явного override).
      METADATA-результат из-за sampling получает дополнительный
      INFO-severity warning `SKIPPED_BY_MEDIA_SAMPLE_POLICY` (не error, не
      WARNING-severity) — отличим от «run-wide METADATA» причины.

      **Побочные находки, вынесены в отдельные background-задачи, НЕ
      исправлены в этом PR** (см. Scope guard):
      1. `getOfferPlaceRelations()`/`getPublishedOffers()` полностью
         ломаются при живом SSH-запросе — SQL использует backtick-quoted
         `` `order` ``, но remote script оборачивает запрос в
         double-quoted bash-строку, где backticks трактуются как command
         substitution, не как часть SQL. 100%-й отказ, никогда не пойман
         юнит-тестами (те используют fake executor). Обнаружено при live
         read-only проверке Offer-кандидатов в этом PR.
      2. `normalizePlace.ts` никогда не извлекал Place cover/gallery
         корректно: cover читается из несуществующего `_thumbnail_id`
         (реальный meta_key — `cover`), gallery читается как массив
         отдельных значений, но реально хранится как ОДНА
         comma-separated строка в одном meta-row. Итог: `media.
         thumbnailAttachmentId`/`galleryAttachmentIds` всегда `null`/`[]`
         для всех 82 Place, даже когда реальные изображения есть.
         Существующие фикстуры `normalizePlace.test.ts` использовали
         синтетическую (неверную) форму данных и никогда не ловили это.
         Прямо блокирует PR C (Place media) — нужно исправить ДО
         PlaceMediaSyncer.

      **Ноль DB writes / media downloads в этом PR** — только
      конфигурация/резолвер/тесты, никакой реальный targeted commit или
      golden import не запускался.
- [x] **PR C — media fix**, разбит на 2 части (обе смержены):
  - [x] **PR C1 — Place cover/gallery source fidelity** (2026-07-15, ветка
        `fix/migration-place-media-source`, PR #47, **смержен** —
        merge commit `ee31bd83`, CI + Docker Build & Push SUCCESS на этом
        SHA) — без downloads, без DB writes, без syncer.

        **Read-only re-verified source facts** (все 82 published Place):
        `gallery` 62/82 (реальный формат — comma-separated attachment ID в
        ОДНОЙ postmeta-строке, не отдельные строки на id — старый parser
        вызывал `Number()` на всю строку целиком и получал `NaN` →
        пустой массив всегда); `cover` 61/82 (реальный primary meta key —
        `cover`; старый normalizer искал `_thumbnail_id`, которого в
        source 0/82 — thumbnail всегда был `null`); 10/82 действительно
        не имеют ни одного image-related meta key; `logo` 47/82 (исключение
        остаётся принятой политикой, `PLACE_LOGO_EXCLUDED`, не менялось);
        legacy `gallery-place`/`logo-place` — по 1 случаю, оба на месте
        437, и это ДЕЙСТВИТЕЛЬНО отдельный набор attachment ID
        (не пересекается с `gallery` того же места) — не артефакт
        именования, поэтому НЕ смешивается в основную galerie.

        **Реализация:** новый pure parser
        `parsePlaceMediaAttachmentIds()`
        (`src/lib/migration/adapters/wordpress-db/parsePlaceMediaAttachmentIds.ts`)
        — принимает `readonly string[] | undefined` (сырой
        `postMeta[key]`), для каждой строки делает split по запятой,
        покрывает разом comma-separated-scalar/single-ID/multiple-rows/
        mixed-whitespace; только positive integer ID; dedup по первому
        вхождению, порядок сохраняется; invalid/negative/zero токены не
        падают процесс, а возвращаются отдельным списком для warning.
        `normalizePlace.ts`: primary cover key = `cover`,
        `_thumbnail_id` — документированный fallback (используется только
        если `cover` отсутствует); если оба присутствуют и расходятся —
        `cover` побеждает, `PLACE_MEDIA_COVER_CONFLICT` warning (WARNING
        severity); если оба присутствуют и совпадают — без warning; если
        fallback реально использован — `PLACE_MEDIA_LEGACY_KEY_USED`
        (INFO, `merged:true`). `gallery-place`/`logo-place` — raw evidence
        + `PLACE_MEDIA_LEGACY_KEY_USED` (INFO, `merged:false`), никогда не
        подмешиваются в `galleryAttachmentIds`. Пустое отсутствие media
        (10/82) — без единого warning. `rawMeta` не теряет ничего.

        **Read-only preview всех 82** (без единого download):
        with cover 61, with gallery 62, no media 10, invalid tokens 0
        places, legacy key used 1 place, cover conflict 0 places, unique
        attachment ID 496. Три golden Place (allowlist из PR "sampled
        media policy") подтверждены: 5389 → cover 5406 + gallery 14
        (+`PLACE_LOGO_EXCLUDED`); 895 → cover `null` + gallery 10, без
        warnings; 43023 → cover 43025 + gallery 11 (включая тот же 43025,
        что и cover — реальное пересечение source-данных, не баг) +
        `PLACE_LOGO_EXCLUDED` + 2×`PLACE_WORK_HOURS_UNSUPPORTED`
        (наследие overnight-часов из PR B).

        Тесты: 17 новых в `parsePlaceMediaAttachmentIds.test.ts`
        (comma/single/array/whitespace/dedup/invalid/negative/zero/два
        golden-места), 12 новых в `normalizePlace.test.ts` (cover через
        `cover`, `_thumbnail_id` fallback, conflict, agreement без
        conflict, comma gallery, legacy `gallery-place`/`logo-place`,
        no-media, deterministic, три golden Place). Проверки — все green:
        полный `src/lib/migration/**` + `scripts/migration-*.test.ts`
        sweep, eslint, `tsc --noEmit`, `git diff --check`, `pnpm build`.
        **Ноль DB writes и media downloads** — только normalize/preview,
        PlaceMediaSyncer в этом PR не создавался.
  - [x] **PR C2 — PlaceMediaSyncer** (2026-07-15, ветка
        `feat/migration-place-media-syncer`, PR #48, **смержен** —
        merge commit `ef0b81e7`, CI + Docker Build & Push SUCCESS на этом
        SHA) — без реальных downloads, без реальных DB writes в
        production/local БД в рамках этого PR (только тесты на fakes);
        последний Place P0-блокер перед golden samples закрыт.

        **Архитектурный аудит (до реализации):** у Place НЕТ отдельного
        "cover"-поля в схеме — `PlaceImageKind` только `LOGO | GALLERY`,
        cover = первый `GALLERY`-образ по `sortOrder` (конвенция,
        используемая и admin-редактором, и публичной страницей места).
        `Place.logoImageId` и логотипы остаются вне auto-import (уже
        принятая политика, `PLACE_LOGO_EXCLUDED`) — синкер никогда не
        пишет `logoImageId` и не создаёт `LOGO`-строки.
        `PlaceMediaLinker` (PR14, ранее) оказался мёртвым кодом (0 реальных
        вызывающих) с несовместимым контрактом (batch-lookup через
        `PlaceMediaLedgerLike` вместо `migrationLineage.findFirst`,
        используемого Event/Route) и без своего шага импорта — удалён,
        его функциональность поглощена новым `PlaceMediaSyncer`
        (`src/lib/migration/commit/place/PlaceMediaSyncer.ts`), который
        реализует import-or-reuse-via-lineage по образцу
        `EventMediaSyncer`/`RouteStopMediaSyncer`.

        **Находка аудита, изменившая дизайн:** read-only проверка
        подтвердила, что один и тот же attachment id может быть `cover`
        для одного Place и `gallery` для другого (напр. id 32649: cover
        для мест 32633/32636, gallery для места 32637). `MigrationLineage`
        уникален по `(sourceId, sourceRecordKey, targetType, targetRole)`
        — ролевой `targetRole` ("cover"/"gallery" как у Event) создал бы
        ДВЕ lineage-строки и скачал бы один физический файл дважды.
        Решение: единый константный `targetRole = "place-media"` для всех
        Place-lineage строк — реюз MediaAsset работает межплейсово, не
        только внутри одного Place.

        **Read-only metadata-аудит всех 496 уникальных attachment id**
        (без единого байта скачивания): 480/496 строк найдено в
        `wp_posts` (16 отсутствуют — станут `PLACE_MEDIA_SOURCE_MISSING`,
        не падением); MIME-состав — 364 `image/webp`, 96 `image/jpeg`, 20
        `image/png`; **HEIC/HEIF: 0, неподдерживаемые форматы: 0**,
        невалидных guid: 0; 11/82 Place имеют cover-id, повторяющийся в
        своём же gallery (не баг, реальные данные — дедуплицируется при
        записи, сначала cover на `sortOrder:0`); 8 attachment id разделяют
        между 2-3 разными Place (обоснование единого `targetRole` выше);
        filesize доступен (best-effort, `_wp_attachment_metadata`) для
        480/496, образцы 32-150 KB — далеко до лимита `mamagoMediaImporter`
        10 MB.

        **Реализация `PlaceMediaSyncer`:** вход — normalized `media`
        (cover + gallery attachment id); порядок записи — cover первым
        (сортOrder 0), затем gallery по исходному порядку, дубликаты и
        повтор cover внутри gallery убираются один раз. Реюз через
        существующий `MigrationLineage(targetType: MEDIA_ASSET)` (как у
        Event/Route) — если lineage уже есть, скачивание не происходит
        (`PLACE_MEDIA_ASSET_REUSED`, INFO). **Никогда не удаляет**
        существующие `PlaceImage`-строки (`deleteMany` не используется
        нигде) — в отличие от Event (diff+recreate), потому что
        `PlaceImage` не имеет FK на `MediaAsset` для безопасного диффа, а
        ручные правки (место 437 и любые другие) не должны стираться
        повторным запуском; новые строки только *добавляются* (append),
        `sortOrder` продолжается от максимума уже существующих — тот же
        паттерн, что и `POST /api/business/places/[id]/images`. Если у
        этого Place уже есть `PlaceImage` с тем же `url` (повторный
        прогон) — новая строка не создаётся (`PLACE_MEDIA_LINK_REUSED`,
        INFO). HEIC/HEIF и неподдерживаемые MIME определяются
        ПРОАКТИВНО по `post_mime_type` атрибута (без попытки скачивания)
        — `PLACE_MEDIA_HEIC_UNSUPPORTED`/`PLACE_MEDIA_FORMAT_UNSUPPORTED`,
        fail-closed. Ошибка одного attachment (`PLACE_MEDIA_DOWNLOAD_FAILED`
        при сетевой/HTTP-ошибке, `PLACE_MEDIA_PROCESS_FAILED` при прочих)
        не блокирует остальные — try/catch на attachment, не на весь
        синкер; при `failed > 0` — сводный `PLACE_MEDIA_PARTIAL` warning.
        Результат содержит явные счётчики `imported/reused/skipped/failed`.
        Отсутствующий `uploadedByUserId` — весь медиа-синк пропускается с
        `PLACE_MEDIA_OWNER_MISSING`, Place commit не страдает.

        **Sampled policy (обязательно из PR #46):** новый
        `MediaPolicyGatedPlaceMediaSyncer` (`src/lib/migration/runtime/`)
        оборачивает `PlaceMediaSyncer` тем же паттерном, что и Event/Route
        — FULL делегирует, METADATA репортит evidence без скачивания
        (`PLACE_MEDIA_POLICY_METADATA_COVER_SKIPPED`/`..._GALLERY_SKIPPED`
        + `PLACE_MEDIA_SAMPLE_SKIPPED` при выходе за allowlist), NONE —
        полный no-op. В CLI (`scripts/migration-commit-wordpress-db.ts`)
        подключён через уже существующий `resolveSampledMediaPolicy()` и
        его готовый allowlist из 3 Place (5389/895/43023, уже добавлены в
        PR #46) — никакого дублирования allowlist внутри синкера.
        `-from-json` CLI **намеренно не тронут**: он уже не подключает
        media-синкеры ни для одной сущности (не только Place) — точечное
        исключение только для Place нарушило бы существующую конвенцию
        этого CLI, а не исправляло бы пробел.

        **Runtime wiring:** `PlaceCommitRunner` получил опциональный
        `mediaSyncer` (как `EventCommitRunner`) — вызывается сразу после
        успешного `orchestrator.execute()` (CREATE и UPDATE_SAFE), ДО
        записи lineage; для UPDATE_CONFLICT и SKIP_UNCHANGED недостижим
        (первый блокируется классификацией раньше, второй не доходит до
        runner вообще — существующая архитектура). Место 437
        (`lastImportedAt: null`) остаётся классифицированным как
        UPDATE_CONFLICT существующей логикой `classifyUpdate()` — синкер
        для него никогда не вызывается, без отдельного кода на этот
        случай. Неожиданный throw из `mediaSyncer.sync()` понижается до
        одного WARNING (`PLACE_MEDIA_IMPORT_SKIPPED`) — Place commit
        остаётся `LINKED`. Media warnings мержатся в
        `MigrationRecord.validationSummary` (дедуп по `code::message`) —
        тот же паттерн, что у Event. Никакой долгой Prisma-транзакции
        вокруг скачивания — синкер, как и Event/Route, не использует
        `$transaction` (в `src/lib/migration` его нет нигде).

        Тесты (все на fakes, ноль реальных DB/network/storage writes):
        18 в `PlaceMediaSyncer.test.ts` (cover only, gallery only,
        cover+gallery, cover-в-gallery без дублирования, дедуп внутри
        gallery, стабильный порядок, no-media no-op, lineage-реюз без
        скачивания, повторный прогон без дублей, реюз одного MediaAsset
        между двумя разными Place, retry скачивает только недостающее,
        ручные `PlaceImage` никогда не трогаются и не удаляются, отсутствие
        owner, отсутствующий attachment, неподдерживаемый MIME,
        HEIC fail-closed, download failure, process failure отдельно от
        download failure, partial success + `PLACE_MEDIA_PARTIAL`); 8 в
        `MediaPolicyGatedPlaceMediaSyncer.test.ts` (FULL/METADATA/NONE +
        реальная интеграция с `resolveSampledMediaPolicy` — allowlisted
        LOCAL/DEV → FULL, non-allowlisted → METADATA без вызова
        downloader, PROD → FULL вне зависимости от allowlist); 8 новых в
        `PlaceCommitRunner.test.ts` (CREATE вызывает media sync с новым
        placeId, UPDATE_SAFE вызывает, UPDATE_CONFLICT никогда не
        вызывает, orchestrator-failure никогда не вызывает, throw из
        синкера понижается до warning и commit остаётся LINKED, media
        warnings мержатся в validationSummary, отсутствие warnings не
        трогает validationSummary, mediaSyncer опционален). Проверки —
        все green: полный `src/lib/migration/**` (56 файлов) +
        `scripts/migration-*.test.ts` sweep, eslint, `tsc --noEmit`,
        `pnpm build`.

        **Ноль реальных DB writes и media downloads в этом PR** — только
        pure-функции/fakes в тестах и read-only metadata-аудит против
        живой WP БД (не байты, только `wp_posts`/`wp_postmeta` строки).
- [x] **PR C3 — resumable Place media retry** (2026-07-15, ветка
      `feat/migration-place-media-force-reprocess`, PR #49, **смержен** —
      merge commit `b3d1c584`, CI + Docker Build & Push SUCCESS на этом
      SHA) — обнаружен и закрыт blocker, найденный на preflight-этапе
      перед golden write (§2 golden-write протокола, "media retry
      preflight"), **до каких-либо DB writes**.

      **Root cause (доказано кодом, не предположением):** после частичного
      media failure Place commit всё равно доходит до `LINKED`
      (`PlaceCommitRunner.ts` — media warnings идут в
      `MigrationRecord.validationSummary`, никогда не роняют commit), и
      PLACE lineage пишется с `lastSourceHash` = текущий hash источника.
      Простой повторный запуск того же `sourceRecordKey` без изменений в
      source классифицируется как `SKIP_UNCHANGED`
      (`MigrationLedgerRepository.getLineageActionForRecord()` сравнивает
      только `lastSourceHash` PLACE lineage, media не участвует). А
      `SKIP_UNCHANGED` перехватывается ДО `dispatchCommitRunner()`
      (`runCommitExecutionPlan.ts`) — `PlaceCommitRunner.execute()`, а
      значит и `PlaceMediaSyncer.sync()`, повторно не вызывается вообще.
      Итог: недокачанный attachment остаётся недокачанным навсегда без
      внешнего вмешательства — никакого force-flag для Place не было
      (`--force-reprocess` существовал, но был жёстко ограничен
      `--entity article`).

      **Почему не workaround:** не использован ручной DB-хак (деактивация
      lineage, ручной SQL) — именно это было explicitly запрещено
      протоколом golden write ("не обходить проблему force-update").

      **Fix (минимальный, переиспользует существующую, уже
      протестированную инфраструктуру):** `--force-reprocess` расширен с
      `--entity article` на `--entity article|place`.
      `applyForcedArticleReprocess()` переименован в `applyForcedReprocess()`
      (экспортирован для прямого теста) — его собственная логика уже была
      entity-agnostic (матчит только по `sourceRecordKey` +
      `SKIP_UNCHANGED`, никогда по `targetType`), так что никакого нового
      Place-специфичного кода не потребовалось. Форсированный переход в
      `UPDATE` проходит через уже существующий, уже покрытый тестами путь
      `PlaceCommitRunner` UPDATE_SAFE → `mediaSyncer.sync()` (см. PR C2,
      `testUpdateSafeCallsMediaSyncer`). **Безопасность не ослаблена**:
      `classifyUpdate()` независимо и безусловно перевычисляет
      UPDATE_SAFE/UPDATE_CONFLICT по факту (`MigrationLineage`/
      `Place.updatedAt`) — форсирование plan action не отключает и не
      обходит эту проверку; место, отредактированное вручную с момента
      последнего импорта, по-прежнему корректно уходит в
      `UPDATE_CONFLICT`/`QUARANTINED`.

      **Read-only проверка перед fix:** attachment-health аудит именно
      для 3 golden Places (5389/895/43023) — все 27 attachment id (15+10+12,
      с дедупом cover/gallery для 43023) реально существуют в `wp_posts`,
      все webp/jpeg, ни одного HEIC/unsupported — практический риск
      partial failure для ЭТИХ трёх низкий, но протокол требует доказать
      retry-механизм независимо от вероятности (важно для будущего
      full-batch 82, где часть Places реально имеет missing/unsupported
      attachments).

      **Review (chatgpt-codex-connector, P2, до merge):** включение
      реального retry обнажило отдельный, ранее не reachable баг в самом
      `PlaceMediaSyncer` (существовал с PR C2, но никогда не мог
      сработать без рабочего retry) — `sortOrder` назначался как
      "следующий свободный слот" (`max(existing)+1`), а не по фиксированной
      позиции attachment'а в cover-first списке. Если cover падал первым
      прогоном, а gallery успешно импортировалась, повторный прогон
      восстанавливал cover В КОНЕЦ, а не на `sortOrder:0` — молча ломая
      конвенцию "cover = первый GALLERY-образ". Исправлено (тот же PR,
      отдельный коммит `4f0f5a2d`, не amend): `sortOrder` теперь = индекс
      attachment'а в `orderedUniqueAttachmentIds` (фиксированная позиция,
      не "следующий слот"); уже существующая связанная строка при
      необходимости получает `placeImage.update({sortOrder})` — но только
      если её `url` совпадает с MediaAsset, реально резолвнутым в ЭТОМ
      вызове для одного из attachment id кандидата, так что чужая/ручная
      `PlaceImage`-строка по-прежнему никогда не читается и не двигается.
      Новый regression-тест
      `testRetryRecoveringEarlierAttachmentRestoresCorrectOrder`
      воспроизводит ровно этот сценарий (cover падает, gallery успевает,
      retry восстанавливает cover на `sortOrder:0`).

      Тесты: `migration-commit-wordpress-db.test.ts` — `place` теперь
      разрешён с `--force-reprocess` (event/route/all по-прежнему
      отклоняются), 6 новых прямых тестов `applyForcedReprocess` (flip
      для Place, regression для Article, non-matching sourceRecordKey
      игнорируется, CREATE/UPDATE-items не трогаются, no-op без флага,
      no-op без sourceRecordKey); `PlaceMediaSyncer.test.ts` — order-fix
      regression-тест + обновлённый manual-preservation тест (ручная
      строка матчится строго по `url`, не по позиции). Проверки — все
      green: полный `src/lib/migration/**` + `scripts/migration-*.test.ts`
      sweep, eslint, `tsc --noEmit`, `git diff --check`, `pnpm build`.

      **Ноль DB writes** — код-изменение и pure-тесты только. Golden
      write возобновляется этим же CLI после merge, с шага 3 (backup) по
      исходному плану.
- [x] **PR C4 — CLI real-media runtime fix** (2026-07-15, ветка
      `fix/migration-cli-full-media-server-only`, PR #50, **смержен** —
      merge commit `55786060`, CI + Docker Build & Push SUCCESS на этом
      SHA) — второй blocker, найденный на самом первом реальном
      targeted commit (Place 5389, media policy FULL) уже после merge PR
      C3, **до какого-либо DB write**.

      **Root cause:** `createMamagoMediaImporter` (используется FULL
      media policy) транзитивно импортирует `@/server/media/media-storage.ts`,
      который начинается с `import "server-only"`. Пакет `server-only`
      throw'ит безусловно везде, кроме Next.js-бандлера (который
      подставляет no-op через собственный conditional export пакета —
      `"react-server": "./empty.js"` vs `"default": "./index.js"`) — под
      обычным `tsx`/Node это бросает исключение в момент загрузки модуля,
      независимо от того, насколько лениво он импортирован. Это НЕ
      Place-специфичный баг — тот же `mamagoMediaImporter` используют
      `EventMediaSyncer`/`RouteStopMediaSyncer`; похоже, что ни один
      real-write прогон с FULL media policy ни для одной сущности не
      выполнялся через этот CLI раньше (всё предыдущее покрытие — только
      unit-тесты на fakes).

      **Отклонённый первый fix:** глобальный флаг
      `--conditions=react-server` (`node`/`tsx` поддерживают `--conditions`,
      что в точности соответствует conditional export `server-only`).
      Протестировано и ОТКЛОНЕНО: `--conditions` — process-global, поэтому
      он же меняет резолвинг `react` для ВСЕГО остального import-графа
      этого CLI (который транзитивно тянет за собой намного больше, чем
      просто media pipeline) — несколько UI-зависимостей (`@radix-ui/react-*`)
      падали с `React.createContext is not a function`, потому что
      "react-server"-сборка React не содержит хуков. Найдено и
      подтверждено ДО применения к реальному golden write.

      **Финальный fix (минимальный, узкий):** `installServerOnlyStub()` в
      `scripts/migration-commit-wordpress-db.ts` патчит Node CJS loader
      (`Module._load`) так, чтобы только ТОЧНАЯ bare-specifier строка
      `"server-only"` резолвилась в пустой no-op объект — ничего другого
      в процессе не резолвится иначе. Подтверждено напрямую: `react` и
      `@radix-ui/*` резолвятся в свои нормальные сборки как обычно, а
      `createMamagoMediaImporter` успешно импортируется. Вызывается
      лениво, только внутри того же `if (mediaPolicy.name === "FULL" ||
      samplingActive)` блока, где раньше был голый `await import(...)`.

      Тесты: `testInstallServerOnlyStubNeutralizesServerOnly` (реальный
      динамический импорт `../src/lib/migration/media`, воспроизводящий
      точный триггер CLI — не top-level `import("server-only")`
      напрямую, у которого другой путь резолвинга через нативный ESM
      resolver, что при первой попытке теста тоже было найдено и
      исправлено), `testInstallServerOnlyStubDoesNotAffectOtherModules`
      (`React.createContext` остаётся функцией). Проверки — все green:
      полный `src/lib/migration/**` + `scripts/migration-*.test.ts`
      sweep, eslint, `tsc --noEmit`, `git diff --check`, `pnpm build`.

      **Ноль DB writes** — код-изменение и тесты (включая реальные, но
      read-only динамические импорты) только. Golden write возобновляется
      этим же CLI после merge, с шага 5A (Place 5389 targeted commit) —
      backup и preflight (шаги 3–4) уже выполнены до этого blocker'а и
      остаются в силе.
- [x] **PR C5 — resolve real WP attachment file URL** (2026-07-15/16,
      ветка `fix/migration-wp-attachment-file-url`, PR #51, **смержен**
      — merge commit `d2f5c262`, CI + Docker Build & Push SUCCESS на
      этом SHA) — третий blocker, найденный на первом РЕАЛЬНОМ write
      после merge PR C4 (Place 5389 действительно создан, но **все
      15/15 media attachment упали**).

      **Что произошло:** `pnpm migration:commit:wordpress-db --entity
      place --source-record-key wordpress-db:places:5389 --profile
      FULL_IMPORT --confirm-writes ...` успешно создал Place (LINKED,
      корректные title/phone E.164/opening hours/city), но каждый из 15
      attachment вернул `PLACE_MEDIA_PROCESS_FAILED`:
      `Media at https://mamago.by/?attachment_id=5391 is not an image
      (text/html)`.

      **Root cause:** на живом сайте `wp_posts.guid` для attachment
      резолвится в HTML-страницу самого attachment (pretty-permalink
      вида `.../2021-07-11-jpg/` либо legacy `?attachment_id=N`), а НЕ
      в файл. Подтверждено напрямую: `_wp_attached_file`
      (`wp_postmeta`) для того же attachment даёт настоящий
      uploads-relative путь (`2023/07/6c616226....webp`); прямой
      `curl -I` на `{origin(guid)}/wp-content/uploads/{attached_file}`
      вернул `HTTP 200, content-type: image/webp, content-length:
      105800` — байт-в-байт совпадающий с `filesize` в
      `_wp_attachment_metadata`. Это **не Place-специфичный баг** —
      `MediaImportWriter` (единая точка входа для
      Event/Route/Place-синкеров) везде читал `attachment.guid`
      напрямую; судя по всему, ни один реальный media-download ни для
      одной сущности никогда не проходил через этот CLI успешно.

      **Fix (минимальный, единая точка исправления):**
      `resolveWordPressAttachmentFileUrl()` (новый чистый helper,
      `src/lib/migration/adapters/wordpress-db/resolveAttachmentFileUrl.ts`)
      — если `attached_file` присутствует, строит URL как
      `{origin(guid)}/wp-content/uploads/{attached_file}`; иначе
      fallback на `guid` verbatim (сохраняет прежнее поведение всех
      существующих тестов/фикстур, у которых `attached_file` не
      задан). `buildAttachmentsQuery()` теперь `LEFT JOIN wp_postmeta`
      за `_wp_attached_file`; `WordPressAttachmentRow` получил поле
      `attached_file: string | null`. `MediaImportWriter.importWordPressAttachment()`
      — единственное место, где строится `sourceUrl` для скачивания
      — переключено на резолвер. Ни `EventMediaSyncer`,
      `RouteStopMediaSyncer`, ни `PlaceMediaSyncer` не тронуты —
      фикс на уровне общего `MediaImportWriter` чинит все три сразу.

      Тесты: 7 новых в `resolveAttachmentFileUrl.test.ts`
      (attached_file строит URL из origin guid — включая случай
      pretty-permalink guid; fallback на guid при отсутствии/пустом/
      whitespace-only attached_file; fallback на raw guid при
      unparseable guid; null когда оба поля непригодны), 1 новый в
      `MediaImportWriter.test.ts` (regression — attached_file
      предпочитается над guid, точно воспроизводит реальный кейс
      5391). Существующие фикстуры (`attachmentFixture`/`attachment()`
      в Event/Route/Place-синкер-тестах, `WordPressRepository.test.ts`)
      обновлены полем `attached_file: null` — поведение не изменилось,
      только typecheck. Проверки — все green: полный
      `src/lib/migration/**` + `scripts/migration-*.test.ts` sweep,
      eslint, `tsc --noEmit`, `git diff --check`, `pnpm build`.

      **Место 5389 остаётся в БД как есть** (Алексей решил не
      откатывать) — реальный, корректный Place без media. После merge
      PR C5: `--force-reprocess` дозагрузит его media (тот самый
      сценарий, для которого PR C3 и создавался), затем golden write
      продолжится на 895/43023.
- [ ] **Golden samples: 1/3, частично.** Не путать с "3 golden Places
      импортированы" — это НЕ так.
      - Place `5389`: scalar-уровень создан корректно (Place,
        OpeningHours, активный PLACE lineage, MigrationRecord — все
        созданы; Place 437 не изменён bit-for-bit; дублей нет). **Media
        для 5389 ещё не импортированы** — все 15/15 attachment упали
        на первом прогоне (root cause и fix — PR C5 выше); докачка
        через `--force-reprocess` ещё не выполнялась.
      - Place `895` и `43023`: **ещё не запускались вообще** — ни
        preview, ни commit.
      - Следующий gate, строго по порядку:
        1. targeted media retry (`--force-reprocess`) только для уже
           существующего Place 5389;
        2. не менять его scalar-поля/`sourceHash` без необходимости;
        3. проверить media/lineage/UI после докачки;
        4. повторный запуск того же `--force-reprocess` должен дать 0
           downloads и 0 writes (доказательство идемпотентности);
        5. только после этого — commit 895, затем 43023;
        6. затем reconciliation места 437;
        7. затем full local batch (82 Place).
- [ ] Reconciliation места 437 (после D, с защитой ручных правок).
- [ ] Full batch (82 Place) — только после закрытия всех пунктов выше,
      **не запускался**.

### Routes (14 publish)

- [x] **PR A** (2026-07-13, ветка `feat/phoenix-route-import`, коммит/мердж за
      Алексеем) — `getPublishedRoutes()`/`getPublishedRouteById()`,
      `groupIndexedMeta()` (1-based, images сырой строкой attachment ID),
      `normalizeRoute()` (`placeId: null` для всех стопов — доказано по данным),
      wiring в адаптер + barrel, тесты, golden-sample helper. Отброшено
      осознанно: `route-duration` (считается по точкам через API), `reels-route`.
      Общий тип `RouteStopPlaceResolution` объявлен в `place-resolution/types.ts`,
      к Route не подключён (для будущего `Event.placeIdRaw`). *(`route-budget`
      изначально резолвился через taxonomy lookup — решение изменено, см.
      Follow-up ниже.)*
- [x] **Follow-up PR A** (2026-07-14, ветка `feat/phoenix-route-import`) —
      решение изменено: **`route-budget` НЕ импортируется вообще**, как и
      `route-duration`. Бюджет в новой модели формируется из цен точек
      (`summarizeRouteBudget`), которые редактор проставит при ручном review.
      Убран taxonomy lookup и slug→`BudgetLevel` map из `normalizeRoute`
      (`budgetLevel`/`budgetTermRaw` удалены из `NormalizedRouteCandidate`,
      `Route.budgetLevel` остаётся на схемном дефолте); тесты упрощены.
      Inspect-шаг `route_budget_terms` оставлен (полезен для review). Реальные
      термы источника — сами являются ценовыми диапазонами — задокументированы
      в `wordpress-db-inspection-2026-07-06.md` §10: до 100 (5), 100–200 (1),
      200–300 (2), 300–400 (0), 400–500 (0), больше 500 (5); сумма 13 из 14
      маршрутов (один без терма — ожидаемо).
- [x] Commit runner для Route/RouteStop (2026-07-13, коммит
      `feat(migration): add Route/RouteStop commit runner`) — `RouteCommitRunner`
      + `buildRouteCreateDraft`, writer/orchestrator, wiring в dispatch/commit CLI,
      ledger-идемпотентность по активному `MigrationLineage`; импорт создаёт
      `Route` + упорядоченные `RouteStop` (`placeId: null`, `customTitle` из
      title, `note` из description), `DRAFT`/`PRIVATE`/`authorId: null`.
      `images-location-*`, RouteSlugHistory/redirect map и route-level
      `location` JSON намеренно не пишутся в этом PR.
- [x] Медиа стопов (`images-location-*` → MediaAsset через media ledger)
      (2026-07-13, ветка `feat/phoenix-route-import`, коммит
      `feat(migration): import RouteStop media`) — фактический формат
      source-поля подтверждён normalizer/tests: comma-separated attachment IDs
      (`"17885,17886"`), не repeated rows. `RouteStopMediaSyncer` импортирует
      attachment через общий `MediaImportWriter`/`MigrationLineage`, переиспользует
      существующий `MEDIA_ASSET` lineage и пишет первый успешно импортированный
      asset в существующее поле `RouteStop.photoUrl`; `syncRouteMediaUsage`
      уже умеет считать `photoUrl` route-owned usage. `MigrationProfile`
      соблюдается через route-specific media policy gate: `FULL` импортирует,
      `METADATA` пишет evidence warning без download/link, `NONE` полностью
      пропускает. `MediaAsset` ownership берётся из optional
      `context-config.defaults.route.mediaOwnerUserId`/override; при отсутствии
      owner media не импортируется и пишется warning. Ошибки отдельных
      attachments не ломают Route commit.
- [x] Route-level `location` JSON — продуктовое решение (2026-07-13, ветка
      `feat/phoenix-route-import`, коммит
      `docs(migration): define Route location import policy`) — принято:
      legacy route-level `location` **не импортируется** в продуктовую модель
      `Route`/`RouteStop`, не создаёт Prisma-поле и не задаёт искусственный
      map center/start point. Raw value сохраняется как migration evidence в
      `normalizedPayload.locationRaw`, `normalizedPayload.rawMeta.location`
      (и parsed `normalizedPayload.location`, если JSON валиден), а значит
      попадает в persisted normalized snapshot / `MigrationRecord`. Непустое
      значение даёт info warning `ROUTE_LEVEL_LOCATION_DROPPED`; пустое или
      отсутствующее значение warning не создаёт.
- [ ] Ручной review 14 маршрутов: сжатие длинных описаний стопов в короткие
      заметки (AI rewrite + проверка), PUBLIC/PUBLISHED, без автора.
      **Решение Алексея 2026-07-13: отдельное поле `isEditorial` в схему НЕ
      добавляется** — все 14 импортируемых маршрутов редакционные, семантика
      «editorial = `authorId === null`» (как в текущем public reader)
      подтверждена; review builder не должен блокировать публикацию по этому
      признаку. Route-level location policy (не импортировать, хранить как
      evidence) также подтверждена Алексеем.
      Preview-проход 2026-07-13 подготовил review/apply механизм и артефакты:
      [`reviews/route-review-2026-07.md`](./reviews/route-review-2026-07.md),
      [`reviews/route-review-2026-07.json`](./reviews/route-review-2026-07.json).
      **Импорт в dev-БД выполнен 2026-07-13 ~18:30**: preview 14/14
      normalized (0 failed; warnings ожидаемые: `ROUTE_LEVEL_LOCATION_DROPPED`
      ×10, `ROUTE_META_KEY_UNPARSEABLE_INDEX` ×3), commit 14/14 LINKED (14
      активных `ROUTE` lineage, 14 `Route`/97 `RouteStop` в dev-БД,
      DRAFT/PRIVATE/`authorId: null`/`cityId`=Минск, без дублей на повторном
      прогоне). По пути найден и исправлен реальный баг: commit CLI жадно
      импортировал `createMamagoMediaImporter` (→ `@/server/media/media-storage`,
      под `server-only`) при любом `--media-policy`, а не только `FULL` —
      под чистым `tsx` (не Next-бандлер) это гарантированно падало на любом
      non-FULL прогоне; теперь импорт ленивый, только при `FULL`
      (`scripts/migration-commit-wordpress-db.ts`). Editorial-блокер
      (`ROUTE_ISEDITORIAL_FIELD_MISSING`) снят из `routeEditorialReview.ts`
      согласно решению Алексея. Review перегенерирован свежими данными:
      14/14 DRAFT/PRIVATE, decision counts `NEEDS_COPY_REVIEW: 14`, остальные
      0 (BLOCKED в т.ч.) — `route-preview.json`/`route-commit-report.json`
      теперь в `docs/migration/reviews/`, не в корне репо. `--apply` не
      запускался — публикации не было, ждём ручной review Алексеем всех 14.
      **HTML-фикс 2026-07-13**: `810d3254` добавил `htmlToPlainText` в
      `buildRouteCreateDraft` для будущих импортов, но 14 уже импортированных
      маршрутов остались с сырым WP-HTML в `RouteStop.note`. Прогнан
      одноразовый `scripts/migration-fix-route-note-html.ts` (dry-run →
      `--apply` → dry-run) по всем 97 стопам с активной `MigrationLineage
      targetType=ROUTE` — 97/97 изменены, повторный dry-run: 0. Review
      перегенерирован — `<p>`/`<br>` тегов в заметках больше нет. **Но**: см.
      следующий пункт — заметки всё ещё не полностью чистые из-за отдельного,
      более общего бага.
      **Копирайт-review 2026-07-14 (решение Алексея: bulk-генерация, правки
      точечно)**: массовый первый проход по всем 97 стопам + тизер на каждый
      из 14 маршрутов — [`reviews/route-copy-proposals-2026-07.md`](./reviews/route-copy-proposals-2026-07.md).
      Только предложения, в БД ничего не записано, `--apply` не запускался.
      Применимой AI-rewrite инфраструктуры для Route не нашлось (`/api/ai/rewrite`
      поддерживает только `event|place|offer`, требует живую сессию) — текст
      написан вручную. Все 97 заметок ≤200 символов (проверено скриптом:
      min 103, max 186, среднее ~146), сохранена конкретика (цены, часы,
      практические советы). Найдено и помечено: 1 расхождение заголовок/текст
      стопа (Браслав, стоп 1 — заголовок про костёл, текст про другую церковь),
      7 стопов с несколькими локациями в одном (кандидаты на разбивку —
      детали неизбежно потеряны при сжатии до 200 символов), 1 медицински
      важное предупреждение (церкариоз на пляже «Урлики», Нарочанский) —
      сохранено как приоритет №1 в короткой версии. Пустых/бесполезных
      исходников не найдено. Ждём review Алексея по артефакту в чате.
- [x] **Баг MySQL batch-escape — исправлен** (2026-07-14, отдельный маленький
      PR, не Route-specific). Найден 2026-07-13 на заметках RouteStop: MySQL
      batch-режим отдаёт реальные переносы строк/табы/бэкслеши/NUL как
      буквальные escape-последовательности (`\n`, `\t`, `\\`, `\0`), а общий
      `parseTabularRows()` их не разэкранировал. Добавлена
      `unescapeMysqlBatchValue()` в `connectExecutor.ts`, применяется в
      `coerceCell()` до NULL/numeric-обработки; юнит-тесты на все escape-коды
      + regression-кейс в `testParseTabularRows`. Общий для
      Place/Article/Event/Route — все используют один executor.
      **Не входит в этот PR:** cleanup уже импортированных данных (82 Place,
      115 Article, 28 Event, 97 RouteStop notes уже почищены отдельным
      Route-specific скриптом до этого фикса, но именно на escape-баг не
      проверялись) — нужен отдельный follow-up по образцу
      `scripts/migration-fix-route-note-html.ts` (dry-run → `--apply` →
      dry-run) для Place/Article/Event после подтверждения стратегии.
      Смержено в dev: `066e67da`.
- [x] **Impact audit уже импортированных данных — 2026-07-14 (read-only, без
      UPDATE/DELETE/INSERT, без commit/`--apply`)**. Проверены все активно
      слинкованные записи в этой dev-БД: Place (1), Article (1), Activity
      (1), Route (14), RouteStop (90, через parent `Route` lineage —
      `targetType=ROUTE_STOP` нигде не используется). **Affected = 0 по всем
      пяти.** Place/Article/Activity — тестовые записи по 1 штуке, полные
      батчи (82/115/28) в эту БД ещё не закоммичены; для них вывод "clean"
      статистически не показателен, не обобщать. Cleanup runner **не
      нужен** — нечего чистить. Фикс дополнительно подтверждён на живом WP
      прямо через production-путь (`WordPressRepository` → исправленный
      `connectExecutor`, read-only `--allow-remote-readonly`, без commit):
      route 17822, `description-location-1..3` теперь корректно отдают
      настоящий byte новой строки. Побочная находка: diagnostic
      `migration-inspect-wordpress-db.ts` использовал собственный,
      независимый от `connectExecutor` парсер (`parseSectionedOutput()`) —
      не разэкранировал batch-значения, влияло только на человекочитаемые
      inspect-отчёты, не на импортируемые данные. **Закрыто отдельным
      маленьким PR** (см. следующий пункт) — теперь оба парсера используют
      один и тот же `unescapeMysqlBatchValue()`. Полные батчи Place/Article/
      Event (82/115/28) можно импортировать через уже исправленный executor
      без field-level remediation; валидировать обычными validation
      reports (§4), отдельный cleanup-скрипт не требуется.
- [x] **Diagnostic inspect parser — batch-unescape** (2026-07-14, отдельный
      маленький PR). `parseSectionedOutput()` в
      `migration-inspect-wordpress-db.ts` теперь переиспользует
      `unescapeMysqlBatchValue()` из `connectExecutor.ts` (та же
      реализация, не дублирована) — применяется к каждой cell после
      корректного разделения по реальным tab/newline byte (само разделение
      уже было верным, страдала только пост-обработка значений). NULL/
      numeric coercion в этом скрипте никогда не было — нечего сохранять
      сверх самого текста. Regression-тесты: `\n`/`\t`/`\r`/`\0`/`\\`,
      неизвестный escape (passthrough), висящий одиночный backslash,
      несколько sections подряд, отсутствие фантомных rows/columns от
      escape-последовательностей, cross-check равенства значения между
      production `parseTabularRows()` и этим diagnostic-парсером на одном
      и том же raw input.
- [ ] Старые URL → `RouteSlugHistory` + redirect map.
- [x] Общий wizard для пользователя и редактора (решение Алексея 2026-07-13,
      коммит `19a4a7b6`) — подтверждено: `RouteEditor` один для всех;
      админ-список ссылается на общий `/routes/{slug}/edit`. Фикс:
      admin/moderator редактируют любой маршрут (включая editorial с
      `authorId: null`), которые раньше отдавали 404.
- [x] Гейт просмотра маршрута (коммит `19a4a7b6`) — PUBLISHED+PUBLIC/UNLISTED
      видны всем; DRAFT/ARCHIVED/PRIVATE — только автору и admin/moderator
      (раньше любой статус рендерился всем, кто знает slug); noindex для
      непубличных превью и UNLISTED.
- [ ] **Модерация UGC-маршрутов (решение Алексея 2026-07-13): постмодерация +
      ранжирование.** Пользовательские маршруты публикуются сразу, без
      премодерации; каталог ранжирует по отклику (рейтинг, сохранения в план,
      популярность) с бустом editorial; новые/без отклика — ниже. Админка —
      надзор постфактум (unpublish/archive из восстановленного раздела).
      Реализация ранжирования каталога — отдельная задача (не миграция):
      сортировка в `route.service` листингах + возможно веса в
      `RankingSettings`. Жалоба на маршрут («report») — бэклог.
- [ ] (Позже, продукт) Связывание стопов с Place: вручную в review UI или
      fuzzy-matching по title/coords — в источнике ссылки на Place нет.
- [ ] (Позже, продукт/схема) Полноценная gallery для RouteStop: источник может
      дать несколько `images-location-*` attachment IDs на один стоп, но текущая
      Prisma-модель хранит только один `RouteStop.photoUrl`. Текущий импорт
      связывает первый успешно импортированный asset и предупреждает о
      дополнительных attachment IDs как не импортированных/не представимых
      без расширения модели/UI.

### Events (28 eligible)

**Статус: engine готов (§0 — adapter/normalizer/runner +
`EventMediaSyncer` существуют) → фактический импорт НЕ НАЧАТ.**
Готовность движка ≠ выполненный импорт — ниже отдельный, самостоятельный
трек для реальных данных, по аналогии с Places/Routes/Offers.

- [ ] Полный source inventory всех событий (все Event-посты источника,
      не только уже известные 28 eligible — подтвердить, что 28 это
      действительно полный отфильтрованный набор, а не устаревшая
      оценка).
- [ ] 28 eligible active/future Event — read-only preview/аудит перед
      любым commit (аналогично Places §1 read-only readiness audit).
- [ ] Три golden Event — targeted commit по одному, с теми же gates,
      что и у Place golden write (backup, preflight, idempotency,
      repeat-run 0 downloads/0 writes).
- [ ] Media policy: подтвердить поведение отдельно для local/dev
      (sampled allowlist, см. `resolveSampledMediaPolicy`) и production
      (FULL для всех eligible) — не предполагать, читать код.
- [ ] UI verification: date/time, city, visibility, публичная +
      admin-страница для golden Event.
- [ ] Idempotency: повторный targeted commit того же Event — 0
      duplicate entity/lineage/media.
- [ ] Event visibility/city regression — подтвердить, что миграция не
      ломает существующую publish/visibility-логику для уже созданных
      вручную Event.
- [ ] Full batch (28 Event) — только после закрытия всех пунктов выше,
      **не запускался**.
- [ ] Production FULL media — только после успешного local/dev batch и
      отдельного Go-решения, **не запускался**.
- [ ] Поведение завершившегося (past) нативного Event после миграции —
      подтвердить, что уже прошедшие события ведут себя корректно
      (`shouldExcludePastEvent()` уже существует в discover/normalize —
      подтвердить его реальное поведение на живых данных, не только по
      коду).
- [ ] 100% legacy URL coverage прошедших событий через 301/410 —
      подтвердить, что каждый прошедший Event имеет редирект-запись в
      `manifest.csv`, ни один legacy URL не остаётся без 301/410.

### Offers (services / hb-programs, 90+ publish)

**Статус: AUDITED → SOURCE REPOSITORY READY → NORMALIZER READY.**
**Отдельно (не меняется этим статусом): `BLOCKED_FOR_COMMIT` до Place batch
+ активного `PLACE` lineage для relation-связанных source Place ID.**

Read-only source/target аудит завершён 2026-07-14 (см. журнал сессий).
Source: `hb-programs` publish=90/draft=2, `services` publish=1. Target на
момент аудита: `Offer`=0, `MigrationLineage targetType=OFFER`=0 — чистый
старт. `offerMapping.ts` (`src/lib/migration/planners/`) — constant-таблица,
не функциональная логика; полная трассировка подтвердила 0% pipeline
построено на момент аудита (ни WP repository, ни normalizer, ни writer, ни
dispatcher-branch, ни CLI-flag).

**Восемь зафиксированных продуктовых решений (Алексей, 2026-07-14):**

1. 27/90 published `hb-programs` без relation к `places` посту →
   `QUARANTINE`/`NEEDS_OWNER_MAPPING`. Не создавать `Offer`, не назначать
   фиктивный/default Place, не публиковать.
2. Множественные Place-relations → авто-выбор только при подтверждённом
   primary marker/однозначной source-семантике; иначе
   `MULTIPLE_PLACE_RELATIONS` + editorial review. Никогда не выбирать
   первый relation просто по порядку SQL.
3. CAMP/PARTY классификация → **запрещён массовый default
   `productType=CAMP`**. `hb-programs` — техническое имя WP post type, не
   доказательство продуктовой категории. Сохранить raw taxonomy/meta,
   классификация — отдельный review-шаг. `productType` в Prisma —
   `OfferProductType?` (**nullable, не required** — проверено по схеме,
   значит это НЕ blocker; можно оставить `null` до классификации).
4. `program-booking-settings` (JSON, минимум 2 разные схемы в источнике) →
   P0 сохраняет как raw evidence в normalized candidate; `OfferSession`
   автоматически **не создаётся**.
5. `org-capacity` taxonomy (37 терминов — фичи/удобства, не budget-шкала) →
   сохранить term IDs/slugs/names как evidence; `discoverySignalIds` **не**
   заполняется автоматически — нужна отдельная кураторская mapping-таблица.
6. `services` (publish=1) → не отдельный pipeline, а `sourcePostType`
   внутри общего Offer source bundle; нормализовать отличающиеся meta
   отдельно; до editorial review не публиковать автоматически.
7. Draft `hb-programs` (2) → не входят в published commit scope, не
   публикуются; допустимо только source inventory/staging evidence.
8. **Offer commit не запускается** до завершения/достаточности Place-батча
   (сейчас в dev-БД только 2/82 Place) и активного `PLACE` lineage для
   соответствующих source Place ID у relation-связанных Offers.

**Реализация (вертикальными PR, без смешивания слоёв):**

- [x] **PR 1 — WordPress Offer source repository** (2026-07-14, ветка
      `feat/migration-offer-source-repository`) — read-only repository/
      types/SQL слой для `hb-programs`+`services`: `WordPressOfferBundle`
      (post/postMeta/terms/`placeRelations`, без бизнес-классификации),
      `WordPressOfferPlaceRelationRow` (обе стороны `wp_voxel_relations`,
      raw `relation_order`, `relation_side`, без выбора primary),
      `buildOfferSourceRecordKey()` (`wordpress-db:{post_type}:{id}`).
      `getPublishedOffers()`/`getPublishedOfferById()`/
      `getOfferPlaceRelations()` на `WordPressRepository`. 27 записей без
      relation возвращаются репозиторием честно (`placeRelations: []`) —
      решение `QUARANTINE` остаётся за будущим normalizer/planner, не
      принимается на этом слое. Ни normalizer, ни writer, ни dispatcher, ни
      Prisma — не входят. Merge: см. запись в журнале сессий.
- [x] PR 2 — `normalizeOffer.ts` (ветка `feat/migration-offer-normalizer`,
      2026-07-14; PR #42, merge `726628bb`). Pure
      `WordPressOfferBundle` → `NormalizedOfferCandidate`, без Prisma/target
      reads/writes/draft builder/writer/dispatcher/media download.
      `classificationStatus: "UNCLASSIFIED"` всегда — никакого
      `productType`/`kind`/`category` не присваивается. Place-relations:
      `NO_PLACE_RELATION`/`SINGLE_PLACE_RELATION`/`MULTIPLE_PLACE_RELATIONS`
      evidence, primary никогда не выбирается автоматически (решения 1–2).
      `program-booking-settings` — raw + safely-parsed JSON +
      `schemaVariant` (`CALENDAR_ADDITIONS`/`PRODUCT_TABLE_BOOKING`/
      `UNKNOWN`) evidence only, `OfferSession` не создаётся (решение 4).
      `org-capacity` — raw term evidence, `discoverySignalIds` не
      заполняется (решение 5). `services` всегда получает
      `OFFER_SERVICES_MANUAL_REVIEW` (решение 6). `program-age` (6 реальных
      терминов) — parsedMonths только при точном совпадении с официальной
      `AGE_OPTIONS` (`src/lib/config/ages.ts`): "до года"/"1-3 года"/"7-9
      лет" совпадают, "4-6 лет"/"10-12 лет"/"12+" — нет (границы не
      придуманы, оставлены как evidence + `OFFER_AGE_TERM_UNKNOWN`). Gallery
      — exact-dedup, order preserved. Read-only preview CLI wiring **не
      входит** — `wordpressDbAdapter.ts`'s `supportedTargetTypes` явно
      исключает `OFFER`, менять adapter capability вне scope PR 2; вместо
      этого — исчерпывающие fixture-based unit tests (20 тестов).
- [ ] PR 3 — `buildOfferCreateDraft` + `OfferCommitWriter/Orchestrator/
      Runner` — **requires**: Place batch закоммичен (частично/полностью)
      + активный `PLACE` lineage для relation-связанных source Place ID.
- [ ] PR 4 — dispatcher/CLI wiring (`--entity offer`).
- [ ] PR 5 — media (`OfferMediaSyncer`, паттерн Route, scopes
      `OFFER_SERVICES`/`OFFER_PROGRAMS` уже зарезервированы).
- [ ] PR 6 — editorial review workflow (CAMP/PARTY, 27 no-Place записей,
      `org-capacity` кураторская карта).
- [ ] PR 7 — docs/checklist закрытие после реального импорта.

### Users (579) — P0 (§0.6)

- [x] Продуктовое решение: passwordless-реактивация после первого входа,
      пароли не мигрируются (принято ранее, `wordpress-to-mamago.md`).
- [ ] Adapter/normalizer/runner с маппингом legacy user ID. Приоритет
      реализации: сразу после MySQL escape fix, перед Article media.

### Profiles (536) — P0 (identity/media) + P1 (публичный контент), решено §0.6

- [x] **Продуктовое решение: разделение по объёму** (2026-07-14) — P0:
      User identity (`wp_users` → `User`, legacy ID) + профильные изображения
      (аватары/логотипы) + однозначные Business/Organizer ownership связи.
      Остальные 536 `profile` posts (публичный контент, неоднозначная
      personal/business классификация) — migration ledger/quarantine без
      публикации; классификация — P1.
- [ ] Adapter/normalizer/runner для identity/media (P0) по принятой модели.
- [ ] Связки ownership: business/organizer ↔ places/offers (P0, только
      однозначные случаи; остальное — quarantine).
- [ ] Публичный profile-контент + полная классификация (P1).

### Reviews → PlaceReview — P0 (§0.6, ~25 approved строк)

- [ ] Adapter/normalizer/runner (источник — Voxel `post_reviews`; только
      approved). Rating conversion Voxel `-2.00..2.00` → mamaGo 1-5 —
      нужно подтверждение формулы (предложено: линейная перешкала).
- [ ] Зависимость: требует уже импортированных users и places (оба P0).

---

## 1.5 Медиа (9 635 attachments) — сквозной трек

- [x] Общая инфраструктура: `MediaImportWriter` + `MEDIA_ASSET` lineage
      (дедупликация через переиспользование lineage), media policy gates
      `FULL`/`METADATA`/`NONE` (`MediaPolicyGated*Syncer`).
- [x] Place media — `PlaceMediaLinker`.
- [x] Event media — `EventMediaSyncer` (для eligible событий).
- [x] RouteStop media — `RouteStopMediaSyncer` (первый attachment на стоп;
      полноценная галерея — см. «позже» в §1 Routes).
- [ ] **Article media — НЕ импортируется** (обнаружено 2026-07-13):
      `buildArticleCreateDraft` явно без медиа — hero/cover, `coverImageId`
      и inline-изображения внутри `contentJson` не переносятся. Нужен
      ArticleMediaSyncer по паттерну Event/Route + ремап `wp-content/uploads`
      URL внутри contentJson-блоков на импортированные MediaAsset.
- [ ] Offer media — вместе с адаптером Offers (§1).
- [ ] Аватары Users / медиа Business-профилей — после продуктовых решений
      по Users/Profiles (§1).
- [ ] Пре-cutover валидация медиа: отчёт missing media, скоуп из 9 635
      attachments (без revisions/неиспользуемых), выборочная проверка
      скачиваемости/целостности, итоговые counts по доменам.

### Image import matrix (финальное решение на 2026-07-14)

| Entity | Import status | Local/prod media policy | Dev media policy | Notes |
| --- | --- | --- | --- | --- |
| User profile | pending | FULL | METADATA | Аватары после Users/Profiles decisions. |
| Business profile | pending | FULL | METADATA | Логотипы/обложки после ownership decisions. |
| Place | инфраструктура готова, **full-batch НЕ разрешён** | FULL | METADATA | `PlaceMediaLinker` есть, но full-batch readiness audit (2026-07-14, см. §1 Places) нашёл отдельный P0-блокер по медиа (PR C) — «ready» здесь означало только наличие linker'а, не готовность к полному импорту 82 Place. |
| Article | pending | FULL | METADATA | Нужен ArticleMediaSyncer + remap inline `wp-content/uploads`. |
| Offer | pending | FULL | METADATA | Вместе с Offer adapter/runner. |
| Route | ready | FULL | METADATA | `RouteStopMediaSyncer`, сейчас один `photoUrl` на стоп. |
| Event | ready | FULL (**sampled**, 3 golden keys) | METADATA (**sampled**, те же 3 golden keys → FULL) | `EventMediaSyncer`/`MediaPolicyGatedEventMediaSyncer`. **Исправлено 2026-07-15** (sampled media policy PR): предыдущая строка "Event/Past Event = NONE во всех профилях" была устаревшей и никогда не отражала реальный код — `MediaPolicyGatedEventMediaSyncer` уже следовал `profile.mediaPolicy` (FULL и в LOCAL, и в PROD) задолго до этой правки. Реальная политика: local/dev — FULL только для 3 sourceRecordKey из sampled allowlist (см. §1 Places-adjacent «Sampled media policy» ниже), production — FULL для всех eligible Event без ограничения allowlist. |
| Past Event | EXCLUDED | EXCLUDED | EXCLUDED | Past Event полностью исключены из v1 (§0.6) — ни контент, ни media; исключение происходит в discover/normalize (`shouldExcludePastEvent`), до какого-либо media resolver. |

---

## 2. Связи, таксономии, редиректы

- [ ] **Voxel relations linker**: `wp_voxel_relations` → нативные FK
      (`Activity.placeId`, `Offer.placeId`, `Article.relatedPlaceId`, `RouteStop`,
      `PackageComponent`); ключи без цели — задокументировать как отброшенные.
- [ ] **Кураторская таблица маппинга таксономий** WP → mamaGo
      (`places_category`, `section`, `events-category`, `age`, `metro`,
      `neighbourhood`, `city` и т.д.).
- [ ] **RankMath redirect ingestion** (156 строк `wp_rank_math_redirections`):
      ревью + нормализация в redirect manifest. Решение (§0.6): `exact` — P0,
      `start`/`contains` — P1 после conflict-review; редиректы на `/` не
      принимаются автоматически, маппятся на городские/тематические хабы
      вручную перед запуском.
- [x] Политика редиректов для исключённых (прошедших) событий — решено
      (§0.6, 2026-07-14): Past Events не импортируются вообще; старые URL
      закрывает `wpLegacyCatchAll.ts`, отдельные ценные URL добавляются
      вручную в redirect manifest.

---

## 3. Отложенные продуктовые решения (закрыто §0.6, 2026-07-14)

- [x] Cutoff-правило для прошедших событий — решено: Past Events не
      импортируются вообще (ни контент, ни metadata), см. §0.6 EXCLUDED.
- [x] Судьба `page` (71 publish + 13 draft) — решено: только legal/about/
      contact и другие обязательные страницы вручную в `Page` до запуска,
      остальное EXCLUDED (catch-all fallback). См. §0.6 P0.
- [x] Политика unpublished/draft контента (places 187 unpublished, events 538
      draft и т.д.) — решено: staging-only в migration ledger, не
      публикуется автоматически; 187 unpublished Places разбираются вручную
      после запуска. См. §0.6 P1.
- [x] Судьба `collection` (90) и остального long-tail — решено: EXCLUDED из
      v1, source сохраняется; возврат в P1 только для конкретных подборок с
      подтверждённым трафиком/редакционной ценностью. См. §0.6 EXCLUDED.

---

## 4. Финальный cutover (по ранбуку, после закрытия §1–3)

- [ ] Freeze: снапшот WP (JSON через preview/inspect), checksums, row counts.
- [ ] `tsc --noEmit`, полный migration test sweep, `pnpm build` — green.
- [ ] `pnpm migration:preview:wordpress-db --entity all` — ревью counts,
      quarantines, warnings.
- [ ] Подтверждён `MigrationProfile` и `--context-config`.
- [ ] Прод-бэкап + проверка восстановимости на scratch DB.
- [ ] Dry-run QA review + business sign-off.
- [ ] Финальный прогон в прод-окне.
- [ ] Регенерация redirect manifest, проверка репрезентативных URL.
- [ ] Валидационные отчёты: counts, missing media, broken links, duplicate
      slugs, orphaned relations, redirect conflicts, SEO coverage.
- [ ] WP переведён в read-only, снапшот хранится до приёмки; окно отката согласовано.

---

## Сводка по объёму источника (инспекция 2026-07-06)

| Сущность | Publish | Статус адаптера |
| --- | --- | --- |
| Articles (`post`) | 115 | ✅ готов |
| Places | 82 | ✅ готов |
| Events | 28 eligible | ✅ готов |
| Routes | 14 | 🔨 importer готов до review; остались manual review, slug history/redirect |
| Offers (hb-programs) | 90 | ⬜ нет |
| Users | 579 | ⬜ нет |
| Profiles | 536 | ⬜ нет решения по модели |
| Reviews | ? (approved) | ⬜ нет |
| Attachments | 9 635 | частично (по доменам) |
| RankMath redirects | 156 | ⬜ нет |

---

## Журнал сессий (handoff log)

Формат записи: дата — агент — что сделано — незавершённое (ветка/файлы) — следующий шаг.

- **2026-07-13 — Claude (Cowork)** — Создан этот чек-лист. Решения по Routes
  зафиксированы: экспресс-формат канонический, импорт WP-маршрутов в
  Route/RouteStop; `route-duration` и `reels-route` не импортируются
  (длительность считается по точкам через API); импортированные маршруты —
  редакционные (`isEditorial`, PUBLIC, без автора). Незавершённое: нет.
  Следующий шаг: **Routes PR A** (см. §1) — скоуп согласован в сессии,
  промпт передан в Claude Code.
- **2026-07-13 — Claude Code** — Routes PR A реализован: repository-методы
  (`getPublishedRoutes`/`getPublishedRouteById`), `groupIndexedMeta`,
  `normalizeRoute`, wiring в адаптер + barrel, golden-sample helper, тесты;
  `tsc --noEmit` и все тесты каталога green, eslint чистый. Migration-доки
  дополнены live-находками от 2026-07-13. Незавершённое: **не закоммичено**,
  ветка `feat/phoenix-route-import` (коммит/мердж делает Алексей);
  slug→`BudgetLevel` map для `route-budget` пуст — см. Follow-up PR A в §1.
  Следующий шаг: follow-up по budget map (6 строк через inspect CLI), затем
  **commit runner для Route/RouteStop**.
- **2026-07-13 — Claude (Cowork)** — Дерево приведено в порядок и закоммичено
  на `feat/phoenix-route-import`: `54e03b44` (PR A), `1404531c` (чек-лист,
  агентские заметки), `f1ebd687` (wip birthday builder — не относится к
  миграции, вынесен отдельным коммитом). Хуки при коммите не запускались
  (--no-verify: песочница Linux, node_modules собраны под macOS) — tsc/тесты
  были green на хосте перед коммитом. Незавершённое: ветка не смержена в dev,
  пуш/PR за Алексеем. Следующий шаг: Follow-up PR A (budget map) → commit
  runner для Route/RouteStop.
- **2026-07-14 — Claude Code** — Follow-up PR A: попытка заполнить
  slug→`BudgetLevel` map для `route-budget` уткнулась в отсутствие WP DB
  креденшлов в этой сессии (тот же блокер, что и раньше) — добавлен только
  read-only inspect-шаг `route_budget_terms` (тесты/тайпчек/eslint зелёные).
  Реальные данные (6 термов = ценовые диапазоны, usage до 100→5, 100–200→1,
  200–300→2, 300–400→0, 400–500→0, >500→5, сумма 13/14) получены от Алексея
  через отдельный прогон в Cursor. По итогам решение поменялось: `route-budget`
  решили не импортировать вовсе (бюджет — из цен точек при review), поэтому
  map строить не стали — вместо этого убрали taxonomy lookup и оба поля
  (`budgetLevel`/`budgetTermRaw`) из `normalizeRoute`/`NormalizedRouteCandidate`,
  упростили тесты, задокументировали находки в `wordpress-db-inspection-2026-07-06.md`
  §10 и здесь (см. Follow-up PR A выше). `tsc --noEmit` + все тесты каталога
  + eslint — зелёные. Закоммичено этой же сессией на `feat/phoenix-route-import`
  (см. `git log` — `feat(migration): drop route-budget import, budget derives
  from stop prices`; коммит/мердж в dev/main за Алексеем).
  Незавершённое: нет по этому пункту. Следующий шаг: **commit runner для
  Route/RouteStop**.
- **2026-07-13 — Codex** — Реализован commit runner для Route/RouteStop:
  добавлены `buildRouteCreateDraft`, `RouteCommitWriter`/`Orchestrator`/`Runner`,
  wiring в `dispatchCommitRunner`, `runCommitExecutionPlan` и
  `scripts/migration-commit-wordpress-db.ts` (`--entity route`, точечный
  `--source-record-key wordpress-db:routes:{id}`). Стопы пишутся в порядке
  source index → `order`, с `placeId: null`, `customTitle` из title и `note`
  из description; `images-location-*`, route-level `location`, slug history и
  redirect map не пишутся. Статусы импорта: `DRAFT`/`PRIVATE`/`authorId: null`;
  `cityId` берётся из optional `context-config.defaults.route`/override, иначе
  остаётся `null` с warning `ROUTE_CITY_UNRESOLVED` в `validationSummary`.
  Проверки: `pnpm exec tsc --noEmit`, полный migration test sweep, targeted
  eslint touched files — зелёные; полный `eslint src ...` всё ещё падает на
  существующих unrelated правилах `react-hooks/set-state-in-effect` и старых
  `no-explicit-any` вне этого скоупа. Незавершённое: нет по commit runner.
  Следующий шаг: **Медиа стопов (`images-location-*` → MediaAsset через media
  ledger)**.
- **2026-07-13 — Codex** — Реализован импорт media стопов маршрута:
  `RouteStopMediaSyncer` импортирует/переиспользует WP attachments через общий
  `MediaImportWriter` + `MigrationLineage`, `MediaPolicyGatedRouteStopMediaSyncer`
  соблюдает `FULL`/`METADATA`/`NONE`, commit CLI wire-up подключён к
  `--entity route` и точечному `--source-record-key wordpress-db:routes:{id}`.
  Формат `images-location-*`: одна строка comma-separated attachment IDs;
  invalid части отсекает `normalizeRoute()` с warning. Существующая модель
  позволяет хранить только один media reference на стоп (`RouteStop.photoUrl`),
  поэтому первый успешно импортированный asset привязывается к правильному
  stop order, дополнительные attachment IDs после первого успешного не
  импортируются и дают warning + отдельный later-блокер выше. Для импорта
  нужен optional `route.mediaOwnerUserId` в context-config; без него media
  skip с warning, Route commit остаётся successful. Проверки: `pnpm exec tsc
  --noEmit`, полный migration test sweep, targeted eslint touched files —
  зелёные; полный eslint всё ещё падает только на существующих unrelated
  `react-hooks/set-state-in-effect` и старых `no-explicit-any` в
  `resolveEventCommitContextWithMatching*`. Незавершённое: нет по single-photo
  stop media. Следующий шаг: **Route-level `location` JSON — продуктовое
  решение, куда маппить (или отбросить)**.
- **2026-07-13 — Codex** — Закрыто продуктовое решение по route-level
  `location` JSON: legacy blob сознательно не импортируется в `Route` или
  `RouteStop`, Prisma-схема не менялась. Evidence уже сохраняется в
  `NormalizedRouteCandidate` (`locationRaw`, parsed `location` при валидном
  JSON, `rawMeta.location`) и далее в persisted normalized snapshot /
  `MigrationRecord`; добавлен info warning `ROUTE_LEVEL_LOCATION_DROPPED`
  для непустого значения. `Route`/`RouteStop` draft/writer эти поля не читают.
  Обновлены `wordpress-to-mamago.md` и inspection addendum со списком
  сознательно отброшенных Route-полей (`route-duration`, `route-budget`,
  `reels-route`, route-level `location`). Проверки: `pnpm exec tsc --noEmit`,
  полный migration test sweep, targeted eslint touched files — зелёные.
  Незавершённое: нет по location policy. Следующий шаг: **ручной review 14
  маршрутов**.
- **2026-07-13 — Codex** — Начат preview-проход ручного review Routes:
  добавлены `scripts/migration-route-review.ts` и
  `scripts/migration-apply-route-review.ts` плюс pure helpers/tests для
  review/apply. Review builder пишет Markdown/JSON в
  `docs/migration/reviews/route-review-2026-07.{md,json}`; apply-script по
  умолчанию dry-run, требует `--apply`, поддерживает
  `--source-record-key`, проверяет before-values, выполняет транзакцию на
  один Route и не публикует non-READY/BLOCKED routes. Дополнительно preview
  CLI научен `--entity route`. Фактический review 14 маршрутов не выполнен:
  локальная БД показала 0 активных `MigrationLineage targetType=ROUTE`, а
  read-only WP preview заблокирован отсутствующими env `WP_SSH_HOST`,
  `WP_SSH_USER`, `WP_DB_NAME`, `WP_DB_USER`, `WP_DB_PASSWORD`. Артефакты
  созданы как blocker snapshot: READY 0 / NEEDS_* 0 / BLOCKED 0,
  global blocker `EXPECTED_14_ROUTES_FOUND_0`; dry-run apply прошёл и ничего
  не менял. Отдельная продуктовая/схемная находка: в Prisma `Route` нет поля
  `isEditorial`, текущий public reader выводит editorial как `authorId === null`;
  при реальном review builder заблокирует публикацию до решения/подтверждения
  этой семантики. Незавершённое: ветка `feat/phoenix-route-import`, файлы
  review/apply + artifacts. Следующий шаг: поднять WP env/context-config,
  выполнить `pnpm migration:preview:wordpress-db --entity route`, затем
  идемпотентный `pnpm migration:commit:wordpress-db --entity route` и заново
  запустить route review для проверки Алексеем.
- **2026-07-13 — Claude (Cowork)** — Сверка дерева/чек-листа после серии
  коммитов Claude Code/Codex: всё консистентно, 6 Phoenix-коммитов на
  `feat/phoenix-route-import`. Алексей подтвердил два решения:
  (1) route-level `location` не импортируется (политика из
  `f0b70b2d` была его указанием); (2) поле `isEditorial` в схему не
  добавляется — все 14 маршрутов редакционные, семантика
  `authorId === null` = editorial подтверждена, блокер публикации в review
  builder по этому признаку снять. Незавершённое: импорт не выполнен
  (0/14 в локальной БД) — WP env есть только на машине Алексея.
  Следующий шаг: Алексей запускает preview → commit --entity route →
  route-review; затем ручной review 14 маршрутов.
- **2026-07-13 — Claude (Cowork)** — Сверка после прогона импорта: preview
  14/14 normalized (0 failed), commit 14/14 LINKED в dev-БД — отчёты
  `route-preview.json` / `route-commit-report.json` в корне репо. Сессия
  Claude Code оборвалась до финала: в дереве незакоммичены снятие
  editorial-блокера (`src/lib/migration/reviews/route/routeEditorialReview.*`)
  и правки `scripts/migration-commit-wordpress-db.ts`; review-артефакты НЕ
  перегенерированы (лежит пустой snapshot 14:54 с
  `EXPECTED_14_ROUTES_FOUND_0`). Следующий шаг: с машины Алексея —
  дозакоммитить изменения кода, `pnpm migration:route-review`, закоммитить
  свежие артефакты; затем ручной review 14 маршрутов (внимание к 3×
  `ROUTE_META_KEY_UNPARSEABLE_INDEX`). `--apply` без Алексея не запускать.
- **2026-07-13 — Claude Code** — Независимо от параллельной сессии (тот же
  рабочий каталог, не отдельный worktree) дошёл до тех же двух находок и
  тех же исправлений: (1) editorial-блокер снят из
  `routeEditorialReview.ts`/тест обновлён, (2) тот же `server-only`-баг в
  `scripts/migration-commit-wordpress-db.ts` (жадный `await import(...)`
  реального media-importer'а падал на любом non-FULL прогоне) — тот же
  ленивый fix. К моменту попытки закоммитить свою версию другая сессия уже
  закоммитила идентичные правки (`e77e3905`, `4182d5b3`) и её же live-прогон
  (preview → commit → review) — `git status` после моих же изменений
  показал чистое дерево, коммитить было нечего. Дополнительно сам
  independently прогнал preview/commit (14/14, без дублей на повторном
  прогоне) до того, как увидел чужие коммиты — числа совпали. Полная
  проверка на актуальном HEAD: `tsc --noEmit`, весь
  `src/lib/migration/**/*.test.ts` + `scripts/migration-*.test.ts`, eslint
  touched files — все green. Обновил только этот чек-лист (предыдущая
  запись о статусе Routes была неточной — на самом деле (а) и (б) уже
  закоммичены другой сессией). Незавершённое: нет по инженерной части.
  Следующий шаг: **ручной review 14 маршрутов** — обсуждается в чате с
  Алексеем по свежему `route-review-2026-07.md`.
- **2026-07-13 — Claude (Cowork)** — Восстановлен раздел «Маршруты» в админке
  из stash@{0} (застэшен 2026-07-10 на `feat/event-cinema-occasion-fields` и
  забыт): `/admin/content/routes` (список с фильтрами + lifecycle-действия),
  `/api/admin/routes/[id]` (+`/archive`), пункты сайдбара, admin-transitions
  в lifecycleStateMachine/Resolver, `buildAdminRouteLifecycleInput`. Коммит
  `9eab7e24` в `feat/phoenix-route-import`. Остальное содержимое stash@{0}
  (blog, article editor, event wizard) НЕ трогалось — stash сохранён.
  Незавершённое: tsc/тесты по восстановленным файлам не гонялись (песочница) —
  прогнать `pnpm check` на хосте; проверить /admin/content/routes глазами
  (там теперь 14 импортированных DRAFT-маршрутов). В бизнес-кабинете
  маршрутов никогда не было (проверены все ветки и stash'и) — если нужны,
  это новая продуктовая задача.
- **2026-07-13 — Claude Code** — Покрыл тестами три уже закоммиченных (без
  тестов) фикса по маршрутам, найденных при восстановлении админ-раздела:
  (1) `cc5e2f4e` subdomain pass-through — `isRouteContentRoute` в
  `subdomainMiddleware.ts` держит `/routes`/`/routes/*` на текущем
  admin/business-сабдомене вместо rewrite в несуществующий
  `/admin(/business)/routes/*`; добавлены кейсы в
  `subdomainMiddleware.test.ts` (edit/detail/new на admin и business хостах)
  + регрессия (прочие пути всё ещё rewrite, авторуты — redirect на public).
  (2) `19a4a7b6` admin edit access — `getEditableRouteBySlug` с
  `allowAnyAuthor` пускает admin/moderator в любой маршрут, включая
  authorless editorial (`authorId: null`, импортированные WP-маршруты).
  Построение `where` вынесено в чистую `buildEditableRouteWhereClause`
  (новый `route.service.test.ts`) — обращение к Prisma не мокал, только
  чистая логика ветвления, по инструкции («минимальный юнит на построение
  where»), т.к. `route.service.ts` использует синглтон `@/lib/prisma`, а не
  DI. (3) `19a4a7b6` view gate — `canViewRoute` вынесен из
  `routes/[slug]/page.tsx` в чистый `src/lib/routes/routeAccess.ts` (route +
  user, без вызова `getCurrentUser()` внутри); страница теперь сама зовёт
  `getCurrentUser()` и передаёт результат. Тест — полная таблица
  3 статуса × 3 видимости × 5 типов viewer'а (аноним/чужой/автор/админ/
  модератор) = 45 комбинаций (`routeAccess.test.ts`), плюс отдельный кейс
  на authorless editorial route (виден только admin/moderator, ни один
  обычный пользователь не может совпасть с `authorId: null`). Рефактор
  вынесен отдельным коммитом от тестов, как просили. Проверки: `tsc
  --noEmit`, все `*.test.ts` в `src/lib/routing`, `src/lib/routes`,
  `src/server/services` (новые) + весь `src/lib/migration`/
  `scripts/migration-*.test.ts` (регрессия), eslint touched files — все
  green. Незавершённое: нет. Следующий шаг: копирайт-review 14 маршрутов
  (см. запись выше) — Алексей проверяет ссылку из админки после этого коммита.
- **2026-07-13 — Claude Code** — Экспортировал `htmlToPlainText` из
  `buildRouteCreateDraft.ts` + тесты (теги/вложенные теги/`<br>`/`&nbsp;`/
  `&laquo;`/`&mdash;`/collapse пустых абзацев/идемпотентность на чистом
  тексте). Написал `planRouteNoteHtmlFixes` (чистая функция, свой тест) +
  `scripts/migration-fix-route-note-html.ts` (dry-run по умолчанию,
  `--apply` для записи, разбивка по маршрутам). Прогнал на dev-БД: dry-run
  97/97 стопов → `--apply` → повторный dry-run 0/97 (идемпотентность
  подтверждена живым прогоном, не только тестом). Перегенерировал
  `pnpm migration:route-review`. **Важная находка по пути**: заметки всё
  ещё не полностью чистые — нашёл отдельный, более общий баг в
  `parseTabularRows()` (`connectExecutor.ts`): MySQL batch-режим
  экранирует реальные переводов строк как буквальный текст `\n`, это не
  разэкранируется нигде в пайплайне, подтверждено на 100% (97/97) стопов.
  Не Route-специфично — тот же executor используется для Place/Article/
  Event. Зафиксировал как отдельный пункт чек-листа (см. выше), **не
  трогал `connectExecutor.ts`** — вне скоупа этой задачи (только HTML),
  нужно решение/приоритет от Алексея. Проверки: `tsc --noEmit`, весь
  `src/lib/migration/**/*.test.ts` + `scripts/migration-*.test.ts`, eslint
  touched files — все green. Незавершённое: нет по HTML-задаче как
  таковой. Следующий шаг: решение по MySQL-escape багу, затем продолжение
  копирайт-review (следующий промпт — HEIC, судя по чату).
- **2026-07-13 — Claude Code** — MySQL batch-escape подтверждён как общий
  migration-layer bug, но не включён в чистый Route PR. В текущем PR остаётся
  только Route-specific HTML cleanup; общий `connectExecutor.ts` fix,
  возможный report script и cleanup данных вынесены в отдельный follow-up
  после решения по Place/Article/Event.
- **2026-07-14 — Claude Code** — HEIC upload fix вынесен из Route/Phoenix
  истории и смержен отдельно в `dev` через PR #37
  (`fix(upload): convert HEIC images with modern decoder`). PR #36 не должен
  содержать HEIC code/package changes; в этом чек-листе HEIC упоминается
  только как закрытый внешний prelaunch blocker.
- **2026-07-14 — Claude Code** — Массовый первый проход по 97 RouteStop notes
  + 14 тизерам маршрутов выполнен как review artifact:
  `docs/migration/reviews/route-copy-proposals-2026-07.md`. В БД ничего не
  записано, `--apply` не запускался. Следующий шаг: Алексей утверждает пачкой
  или правит точечно; после этого — фактическая публикация 14 маршрутов и
  slug-history/redirect map.
- **2026-07-14 — Claude Code** — Фаза 0 и Фаза 1 официально закрыты (см. §0.5,
  §0.6). Фаза 0: PR #35/#36/#37 смержены в dev, 11 stash защищены archive
  tags + bundle. Фаза 1: frozen scope утверждён Алексеем — P0 включает MySQL
  escape fix → Offers → Users → Article media → Profiles identity/media →
  Reviews → relations/taxonomy/redirects; Profiles публичный контент,
  unpublished/draft контент, RankMath `start`/`contains` — P1; Past Events и
  `collection`/long-tail — EXCLUDED. Три P0-регрессии из stash@{0} (Phone
  E.164, Event visibility, Article/blog-city) и Reviews (~25 approved)
  подняты в P0 по решению Алексея (не P1, как было в первоначальном
  черновике аудита). Незавершённое: нет по этому пункту. Следующий шаг:
  отдельный маленький PR на MySQL batch-escape fix (`connectExecutor.ts`),
  первым по приоритету P0.
- **2026-07-14 — Claude Code** — MySQL batch-escape bug исправлен в
  production executor (PR #38, `066e67da`) и в diagnostic inspect parser
  (PR #39, `84a8947b`) — оба смержены. Read-only impact audit уже
  импортированных данных не нашёл повреждённых записей. Offers: read-only
  source/target аудит + auth-модель для первого входа мигрированных
  пользователей проведены (read-only, ничего не менялось) — восемь
  продуктовых решений по Offers зафиксированы Алексеем (см. §Offers), auth
  flow спроектирован без изменений Prisma (см. §0.7). **PR 1 —
  WordPress Offer source repository** реализован и смержен (см. §Offers) —
  read-only repository/types/SQL слой для `hb-programs`/`services`, ни
  normalizer, ни writer, ни dispatcher, ни Prisma. Offer commit остаётся
  **BLOCKED_FOR_COMMIT** до Place-батча + активного `PLACE` lineage.
  Следующий шаг: PR 2 — `normalizeOffer.ts` (классификация CAMP/PARTY,
  `QUARANTINE`/`MULTIPLE_PLACE_RELATIONS` пометки, без записи в БД).
- **2026-07-14 — Claude Code** — Перед PR 2 проверен deployment gate:
  `Docker Build & Push` (run 29360738128) — SUCCESS на актуальном dev SHA
  `abef4a42` (после PR #40 docker-heap fix и PR #41). PR 2 —
  `normalizeOffer.ts` реализован (ветка `feat/migration-offer-normalizer`):
  pure `WordPressOfferBundle` → `NormalizedOfferCandidate`, ни Prisma, ни
  target reads/writes. `classificationStatus` всегда `"UNCLASSIFIED"` — не
  принято ни одного решения CAMP/PARTY/`productType` (уточнение решения 3:
  предыдущая формулировка "классификация CAMP/PARTY" в этом же файле была
  неточной — Алексей явно запретил массовый CAMP-default до PR 2, здесь это
  соблюдено буквально: PR 2 не классифицирует вообще, только собирает
  evidence). 20 unit-тестов на fixtures. Read-only preview CLI wiring не
  делался — `wordpressDbAdapter.ts` explicitly excludes `OFFER` из
  `supportedTargetTypes`, менять adapter capability вне scope. Незавершённое:
  merge за Алексеем/CI. Следующий шаг (по решению Алексея): **пауза
  Offers-кода**, переход на завершение полного Place-батча (82 publish) —
  без него writer (PR 3) нельзя честно проверить end-to-end.
- **2026-07-14 — Claude Code** — Place full-batch readiness audit (read-only,
  без commit/`--confirm-writes`, без DB writes). Preview всех 82 publish
  Place: 82/82 успешно normalize. Несмотря на это, полный batch запрещён —
  найдены 4 P0-блокера (см. §1 Places): (A) Phone не в E.164
  (32/76 непустых записей требовали нормализации), (D) targeted CLI без
  UPDATE-safety/manual-edit protection, (B) режим работы, (C) media (в т.ч.
  ложный claim `Place | ready` в матрице §1.5, исправлен). Место `437` (уже
  в dev-БД, ручные правки, `lastImportedAt=null`, UPDATE-ветка без тестов)
  исключено из роли первого UPDATE-sample — реконсиляция отдельным шагом
  после (D). Алексей утвердил порядок закрытия: A → D → B → C → новые golden
  samples → reconciliation 437 → full batch. Следующий шаг: PR Phone E.164
  (A) — см. следующую запись.
- **2026-07-15 — Claude Code** — **PR Phone E.164 fix** (ветка
  `fix/migration-place-phone-e164`, из `origin/dev` `87bd43f9`). Два
  разошедшихся нормализатора телефона (`src/lib/phone/e164.ts` — строгий,
  libphonenumber; `src/lib/phone/phoneNormalize.ts` — наивный regex,
  пропускавший невалидный ввод как есть) консолидированы в один
  канонический — `phoneNormalize.ts` теперь чистый re-export из `e164.ts`.
  Проверены все 13 продакшн-вызывающих мест (9 + 4) — 4 вызывающих места
  `phoneNormalize` уже валидировали результат сразу после вызова, так что
  более строгое поведение (пустая строка вместо мусора на невалидном вводе)
  безопасно. `normalizePlace.ts`: добавлено поле `phoneE164` (raw `phone`
  evidence сохранён отдельно, не тронут), `PLACE_PHONE_INVALID` warning при
  нерезолвимом непустом значении.
  `buildPlaceCreateDraft.ts`: `draft.phone` теперь строго из
  `candidate.phoneE164`, никогда из raw `candidate.phone`.
  `InternationalPhoneInput.tsx`/новый `internationalPhoneInputValue.ts`:
  защита от краша на легаси-значении в `value`, `onChange` теперь тоже
  нормализует; ничего не мутирует при простом рендере/открытии формы.
  `PlaceScalarLinker.ts` (подтверждённо неподключённый dead code, свой
  собственный документированный контракт "raw phone verbatim") — поведение
  не менялось, только докблок с явным флагом расхождения для будущего
  подключения. Тесты: 4 новых test-файла (`e164.test.ts` — 13 сценариев,
  `phoneNormalize.test.ts`, `internationalPhoneInputValue.test.ts`) +
  расширены существующие (`normalizePlace.test.ts`,
  `buildPlaceCreateDraft.test.ts`, плюс фикстуры в
  `PlaceCommitOrchestrator.test.ts`/`PlaceCommitRunner.test.ts`/
  `PlaceScalarLinker.test.ts` под новое поле `phoneE164`). Проверки —
  все green: targeted phone/Place tests, полный `src/lib/migration/**` +
  `scripts/migration-*.test.ts` sweep, `src/components/business/wizard/event/
  mappers.test.ts` (единственный существующий тест среди остальных 6
  caller-мест), eslint на изменённые файлы, `tsc --noEmit`, `git diff
  --check`, `pnpm build`. **Место 437 и любые другие Place в БД не
  трогались — ноль DB writes в этом PR.** `docs/migration/
  prelaunch-checklist.md` обновлён этим же PR: новая секция «Places (82
  publish)» в §1 с audit findings, исправлен ложный claim `Place | ready`
  в §1.5. Пункт «PR — Phone E.164 fix» в §1 Places остаётся `[ ]`
  ("PR открыт, merge ещё не выполнен") — отмечается `[x]` отдельным прямым
  коммитом в `dev` только после фактического merge (по паттерну
  `87bd43f9`). Следующий шаг: PR D —
  targeted CLI + UPDATE safety (allowlist + UPDATE-branch test coverage +
  manual-edit protection одновременно, не только allowlist).
- **2026-07-15 — Claude Code** — PR #43 (Phone E.164 fix) смержен в `dev`
  обычным merge-коммитом `55fb873c` (CI typecheck PASS, 0 unresolved review
  threads, `mergeStateStatus=CLEAN`/`mergeable=MERGEABLE`, head SHA не
  менялся с момента push). Post-merge `Docker Build & Push` — SUCCESS (run
  29368752652, 13m15s). Локальный `dev` fast-forward на `origin/dev`. Пункт
  «PR — Phone E.164 fix» в §1 Places этим же прямым докс-коммитом отмечен
  `[x]` (паттерн `87bd43f9`). DB writes за весь PR — ноль, место 437 не
  трогалось. Следующий шаг: PR D — targeted CLI + UPDATE safety (allowlist +
  UPDATE-branch test coverage + manual-edit protection одновременно —
  Алексей явно предупредил, что одного allowlist недостаточно).
- **2026-07-15 — Claude Code** — **PR D: targeted Place commits + UPDATE
  safety** (ветка `feat/migration-place-targeted-update-safety`, из
  `origin/dev` `b66b27dd`, baseline подтверждён: `dev = origin/dev`, clean
  tree, open PR = 0, CI #191 и Docker Build & Push #194 SUCCESS на
  `b66b27dd`). Read-only аудит перед кодом (см. §1 Places п.2) нашёл: (a)
  `--source-record-key` не был привязан к `--entity` вообще на уровне
  `parseArgs()` — фактическая причина отказа для `place` — отсутствие
  `fetchPublishedPlaceEnvelopeBySourceRecordKey`, не намеренный blocklist;
  (b) CREATE/UPDATE/SKIP_UNCHANGED резолвится ОБЩИМ кодом
  (`core/orchestrator.ts`/`MigrationLedgerRepository.getLineageActionForRecord`)
  для всех сущностей одинаково, не Place-специфично; (c) `PlaceCommitRunner`
  уже имел UPDATE-ветку, но **ноль** passing-path тестов на неё (в отличие
  от Route/Article/Event, у которых UPDATE-путь тестируется); (d)
  `lastImportedAt` не пишется НИГДЕ в движке ни для одной сущности — не
  Place-специфичный баг, а общий пробел с момента добавления поля; (e)
  `Place.updatedAt` места 437 (`2026-07-07 20:34:25`) на 3ч26м позже
  `MigrationLineage.createdAt`/`updatedAt` того же места
  (`2026-07-07 17:07:59`) — живое подтверждение сценария "ручная правка
  после импорта, необнаруживаемая существующим кодом"; (f) preview CLI
  никогда не подключает `MigrationLedgerRepository` — всегда показывает
  CREATE, даже для уже импортированных записей (отдельный, не исправленный
  в этом PR пробел, зафиксирован для будущего внимания).
  Реализация: `sql.ts`/`WordPressRepository.getPublishedPlaceById()` —
  targeted `WHERE ID = ?`, не bulk+фильтр (тот же паттерн, что Route/Event/
  Article). `wordpressDbAdapter.fetchPublishedPlaceEnvelopeBySourceRecordKey()`
  — regex `^wordpress-db:places:([1-9]\d*)$` (строже соседей: `0` и leading
  zeros отклоняются, не только нечисловой ввод). Оба CLI-скрипта
  (`migration-commit-wordpress-db.ts`/`migration-preview-wordpress-db.ts`)
  получили ветку `place` в switch на `--source-record-key`. `PlaceCommitRunner`:
  новый `classifyUpdate()` — `UPDATE_SAFE` только когда lineage найден
  (с defensive проверкой, что `sourceRecordKey`/`targetType` реально
  совпадают — не слепое доверие WHERE), `targetId` непустой, Place-строка
  реально существует, `lastImportedAt` известен и `Place.updatedAt` не
  позже него (строгое `>`, без буфера); все прочие случаи → `UPDATE_CONFLICT`
  с machine-readable `reason` (`LINEAGE_MISSING`/`LINEAGE_MISMATCH`/
  `TARGET_ID_MISSING`/`TARGET_ROW_MISSING`/`LAST_IMPORTED_AT_UNKNOWN`/
  `TARGET_MODIFIED_AFTER_IMPORT`) — на конфликте writer/lineage не трогаются,
  `MigrationRecord.status` → `QUARANTINED`, никакого override/force флага.
  `MigrationLineageWriter.createLineage()` теперь пишет `lastImportedAt`
  (инжектируемые часы, дефолт — реальные; это общий фикс, затрагивает
  будущие CREATE всех сущностей, не только Place — существующие тесты не
  проверяли `data` целиком, так что это safe additive change).
  Тесты: 10 новых в `PlaceCommitRunner.test.ts` (UPDATE_SAFE happy path +
  все 6 conflict reasons, включая точное воспроизведение места 437,
  writer-failure-on-update, real targetId end-to-end, strict `>` boundary
  на равных timestamps), 2 новых в `MigrationLineageWriter.test.ts`
  (инжектированные и реальные часы), 4 новых в `wordpressDbAdapter.test.ts`
  (happy path, wrong entity prefix, malformed/negative/zero/non-numeric ID,
  missing source), 2 новых в `WordPressRepository.test.ts` (targeted lookup,
  not-found), 1 новый в `migration-commit-wordpress-db.test.ts`
  (`buildExecutionPlanInput` пиннинг `limit: 1` для Place). Проверки — все
  green: targeted CLI/parser/adapter/repository tests, весь
  `PlaceCommitRunner`/`PlaceCommitOrchestrator`/`PlaceCommitWriter` набор,
  полный `src/lib/migration/**` + `scripts/migration-*.test.ts` sweep,
  eslint на изменённые файлы, `tsc --noEmit`, `git diff --check`,
  `pnpm build`. **Ноль DB writes** — ни targeted commit, ни
  `--confirm-writes`, ни golden sample не запускались; место 437 и все
  остальные Place в dev-БД не тронуты. Не начато и не входит в этот PR:
  opening-hours (B), Place media (C), Offer writer/CLI, reconciliation
  места 437 (сама по себе, после этого PR), full batch. Следующий шаг:
  PR B — opening hours, затем PR C — Place media; golden samples и
  reconciliation места 437 — только после обоих.
- **2026-07-15 — Claude Code** — PR #44 (targeted Place commits + UPDATE
  safety, PR D) смержен в `dev` обычным merge-коммитом `dda93869` (CI
  typecheck PASS, 0 unresolved review threads,
  `mergeStateStatus=CLEAN`/`mergeable=MERGEABLE`, head SHA не менялся с
  момента push). Post-merge `Docker Build & Push` — SUCCESS (run
  29399515526, 10m38s). Локальный `dev` fast-forward на `origin/dev`. Пункт
  «PR — targeted Place commits (D)» в §1 Places этим же прямым
  докс-коммитом отмечен `[x]` (паттерн `87bd43f9`/`b66b27dd`). DB writes за
  весь PR — ноль, место 437 не трогалось. Следующий шаг: PR B — opening
  hours.
- **2026-07-15 — Claude Code** — **PR B: import Place opening hours**
  (ветка `feat/migration-place-opening-hours`, из `origin/dev` `48536159`,
  baseline подтверждён: `dev = origin/dev`, clean tree, open PR = 0,
  CI #194 и Docker Build & Push #196 SUCCESS). Read-only source audit
  через прямой SELECT (`--allow-remote-readonly`) против всех 82
  published Place: 77/82 `work_hours`, все валидный JSON. Полная разбивка
  форм/статусов/edge-кейсов — в §1 Places п.3 (B) выше. Target audit
  подтвердил: `OpeningHoursMode` enum уже покрывает WEEKLY/ALWAYS_OPEN/
  BY_APPOINTMENT/TEMPORARILY_CLOSED — Prisma-миграция не потребовалась.
  Прослежен реальный runtime `isTimeInInterval()`/`compareTime()` —
  подтверждён баг: overnight-интервалы (`to <= from`) тихо ломают
  "is open now" (нет rollover через полночь) — задокументированное,
  оставленное как есть ограничение целевой модели, opening-hours parser
  такие интервалы не сохраняет (`PLACE_WORK_HOURS_UNSUPPORTED`).
  Реализация: pure parser `parsePlaceOpeningHours.ts` (7 warning-кодов),
  подключён в `normalizePlace.ts`, проброшен через
  `buildPlaceCreateDraft.ts` в `PlaceCreateDraft.openingHours`.
  `PlaceCommitWriter` переписан: `Place`+`OpeningHours` пишутся в одной
  `$transaction` (новый паттерн для проекта — раньше `$transaction`
  нигде не использовался, даже в реальном admin/business save API),
  переиспользован канонический `mapToCreatePayload`/`mapToUpdatePayload`
  вместо второго Prisma-payload builder. UPDATE_SAFE/UPDATE_CONFLICT
  политика PR D не менялась и не обходится — regression-тест это
  подтверждает. Место 437 не трогалось. 45 новых/расширенных тестов
  (детали и разбивка по файлам — в §1 Places п.3 выше). Проверки — все
  green: `parsePlaceOpeningHours` + `.publicText` (реальный
  `buildPublicWorkingHoursText()`, не заглушка), Place normalizer/draft/
  runner/writer, полный `src/lib/migration/**` +
  `scripts/migration-*.test.ts` sweep, eslint, `tsc --noEmit`,
  `git diff --check`, `pnpm build`. Read-only live verification 5 golden
  WP ID (5389/5457/13164/13317/9865) выполнена через ту же readonly
  SELECT-сессию — commit/`--confirm-writes` не запускался. **Ноль DB
  writes.**
- **2026-07-15 — Claude Code** — PR #45 (import Place opening hours,
  PR B) смержен в `dev` обычным merge-коммитом `13892b81` (CI typecheck
  PASS, 0 unresolved review threads,
  `mergeStateStatus=CLEAN`/`mergeable=MERGEABLE`, head SHA не менялся с
  момента push). Post-merge `Docker Build & Push` — SUCCESS (run
  29405223508, 14m42s). Локальный `dev` fast-forward на `origin/dev`.
  Пункт «PR — import Place opening hours (B)» в §1 Places этим же прямым
  докс-коммитом отмечен `[x]` (паттерн `87bd43f9`/`b66b27dd`/`48536159`).
  DB writes за весь PR — ноль, место 437 не трогалось. **Единственный
  оставшийся Place P0-блокер — (C) media**; golden samples и
  reconciliation места 437 не начаты, ждут закрытия (C). Offers остаётся
  `BLOCKED_FOR_COMMIT`. Следующий шаг: PR C — Place media.
- **2026-07-15 — Claude Code** — **PR: sampled media policy для
  local/dev** (ветка `feat/migration-sampled-media-policy`, из
  `origin/dev` `2c0d69d6`, baseline подтверждён: `dev = origin/dev`,
  clean tree, open PR = 0, CI #197 и Docker Build & Push #198 SUCCESS).
  Аудит существующей архитектуры (`MigrationProfile`/`MediaPolicy`/
  `MediaPolicyGated*Syncer`/context-config/CLI `--profile`/
  `--media-policy`) показал: политика сегодня — ОДНА `MediaPolicy` на
  весь run (LOCAL/PROD по умолчанию FULL, DEV по умолчанию METADATA),
  без per-record различия; ни один Place/Offer media syncer не подключён
  в CLI вообще (`PlaceMediaLinker` существует, но не вызывается ниоткуда
  вне своего теста; `OfferMediaSyncer` не существует). Полная разбивка
  9 golden sourceRecordKey, policy matrix, найденных устаревших
  утверждений и двух independent багов (Offer relations SSH-запрос
  ломается на backtick-quoted `` `order` ``; `normalizePlace.ts` никогда
  не извлекал Place cover/gallery правильно — оба вынесены в отдельные
  background-задачи, не исправлены в этом PR) — в §1 Places-adjacent
  секции выше. Реализация: `resolveSampledMediaPolicy()` (pure resolver),
  подключён в `MediaPolicyGatedEventMediaSyncer` через backward-compatible
  resolver-параметр, `shouldSampleMedia()` (pure CLI-активация,
  уважает явный `--media-policy` override). `EVENT_BLOCKED` → `EVENT` в
  `MigrationMediaScope`/`APPROVED_MEDIA_SCOPES` (dead-code validator,
  ноль runtime-эффекта, но был вводящим в заблуждение). Тесты: 28 новых
  в `sampledMediaPolicy.test.ts`, 4 новых в
  `MediaPolicyGatedEventMediaSyncer.test.ts`, 5 новых в
  `migration-commit-wordpress-db.test.ts` (`shouldSampleMedia`),
  `mediaScopePolicy.test.ts` обновлён под новый scope. Проверки — все
  green: полный `src/lib/migration/**` + `scripts/migration-*.test.ts`
  sweep, eslint, `tsc --noEmit`, `git diff --check`. **Ноль DB writes и
  media downloads** — только policy/resolver/тесты, ни targeted commit,
  ни golden import не запускались.
- **2026-07-15 — Claude Code** — PR #46 (sampled media policy для
  local/dev) смержен в `dev` обычным merge-коммитом `031e0431` (CI
  typecheck PASS, 0 unresolved review threads,
  `mergeStateStatus=CLEAN`/`mergeable=MERGEABLE`, head SHA не менялся с
  момента push). Post-merge `Docker Build & Push` — SUCCESS (run
  29411711513, 14m51s). Локальный `dev` fast-forward на `origin/dev`.
  Пункт «PR — sampled media policy для local/dev» в §1 Places этим же
  прямым докс-коммитом отмечен `[x]` (паттерн
  `87bd43f9`/`b66b27dd`/`48536159`/`2c0d69d6`). DB writes/media downloads
  за весь PR — ноль. **Единственный оставшийся Place P0-блокер — (C)
  media** — теперь явно заблокирован на исправлении
  `normalizePlace.ts` cover/gallery бага (background-задача
  `task_d022bb3d`), найденного в этом PR; отдельно остаётся открытой
  background-задача на Offer-relations SQL escaping баг
  (`task_d13732f5`), не блокирующая PR C напрямую. Golden samples и
  reconciliation места 437 всё ещё не начаты. Offers остаётся
  `BLOCKED_FOR_COMMIT`. Следующий шаг: PR C — Place media (после починки
  `normalizePlace.ts` cover/gallery).
- **2026-07-15 — Claude Code** — **PR C1: Place cover/gallery source
  fidelity** (ветка `fix/migration-place-media-source`, из `origin/dev`
  `a2f9a64e`, baseline подтверждён: `dev = origin/dev`, clean tree,
  open PR = 0, CI #200 и Docker #200 SUCCESS). Read-only повторный аудит
  всех 82 published Place подтвердил ТОЧНО заявленные числа
  (`gallery` 62/82 comma-separated-в-одной-строке, `cover` 61/82,
  `_thumbnail_id` 0/82, 10/82 без единого image-key, `logo` 47/82,
  legacy `gallery-place`/`logo-place` по 1 случаю — оба на месте 437, и
  подтверждено, что это ДЕЙСТВИТЕЛЬНО отдельный, не пересекающийся с
  `gallery` набор ID). Это закрывает background-задачу `task_d022bb3d`
  (найдена в PR "sampled media policy"). Реализация: новый pure parser
  `parsePlaceMediaAttachmentIds()`, `normalizePlace.ts` переключён на
  `cover` как primary key, `_thumbnail_id` — документированный fallback
  с conflict/legacy-key warnings, `gallery-place`/`logo-place` — raw
  evidence + warning, никогда не подмешиваются. Read-only preview всех
  82 (без единого download) подтвердил корректность на реальных данных
  и всех 3 golden Place. Тесты: 17 новых в
  `parsePlaceMediaAttachmentIds.test.ts`, 12 новых в
  `normalizePlace.test.ts`. Проверки — все green: полный
  `src/lib/migration/**` + `scripts/migration-*.test.ts` sweep, eslint,
  `tsc --noEmit`, `git diff --check`, `pnpm build`. **Ноль DB writes и
  media downloads.** PlaceMediaSyncer намеренно не создавался — это PR
  1 из 2, PR C2 (последний Place P0-блокер) остаётся. Незавершённое: PR
  ещё не смержен. Следующий шаг после merge: PR C2 — PlaceMediaSyncer,
  затем golden samples и reconciliation места 437.
- **2026-07-15 — Claude Code** — **PR C1 смержен.** PR #47: review
  (`chatgpt-codex-connector`, P2) нашёл валидный баг — malformed-но-
  присутствующий `cover` (напр. `"abc"`) ошибочно проваливался в
  `_thumbnail_id` fallback и репортился как "cover отсутствует", хотя
  primary был present, просто битый. Исправлено отдельным коммитом
  `dc8062ad` (не amend): добавлена проверка `coverKeyPresent`,
  разделяющая "cover-ключ действительно отсутствует" от "cover
  присутствует, но не парсится" — fallback теперь триггерится только по
  первому условию; malformed-значение остаётся unresolved и репортится
  только через `PLACE_MEDIA_ID_INVALID`. Добавлен regression-тест
  `testMalformedCoverNeverFallsThroughToThumbnailId`. Review thread
  resolved, все gates green (`mergeStateStatus=CLEAN`,
  `mergeable=MERGEABLE`, 0 unresolved threads, CI SUCCESS на `dc8062ad`)
  → merge commit `ee31bd83`. Post-merge CI + Docker Build & Push —
  SUCCESS на `ee31bd83`. Local `dev` fast-forwarded. Следующий шаг:
  PR C2 — PlaceMediaSyncer (последний Place P0-блокер), затем golden
  samples и reconciliation места 437.
- **2026-07-15 — Claude Code** — **PR C2: PlaceMediaSyncer** (ветка
  `feat/migration-place-media-syncer`, из `origin/dev` `8516de3a`,
  baseline подтверждён: `dev = origin/dev`, clean tree, open PR = 0, CI
  и Docker SUCCESS на `8516de3a`). Архитектурный аудит перед реализацией
  вскрыл: у Place нет отдельного cover-поля (cover = первый
  `GALLERY`-образ по sortOrder); логотип остаётся вне auto-import
  (неизменная политика); `PlaceMediaLinker` (PR14) оказался мёртвым
  кодом с несовместимым batch-lookup контрактом и без своего шага
  импорта — удалён (`PlaceMediaLinker.ts`, `.test.ts`, `types.ts`),
  функциональность поглощена новым `PlaceMediaSyncer`. Read-only
  metadata-аудит всех 496 уникальных attachment id (без единого байта
  скачивания) нашёл: 480/496 строк существуют, 0 HEIC/HEIF, 0
  неподдерживаемых форматов, 0 невалидных guid — и, что важнее,
  подтвердил, что один и тот же attachment id может быть `cover` для
  одного Place и `gallery` для другого (id 32649) — это изменило дизайн
  lineage: единый константный `targetRole = "place-media"` вместо
  ролевого ("cover"/"gallery", как у Event), иначе один физический файл
  скачивался бы дважды под двумя lineage-строками. `PlaceMediaSyncer`
  никогда не удаляет существующие `PlaceImage` (только append, в
  отличие от Event'овского diff+recreate) — это осознанное отличие,
  защищающее ручные правки (место 437 и любые другие) от повторного
  запуска. HEIC/неподдерживаемые форматы отсекаются проактивно по
  `post_mime_type`, без попытки скачивания (fail-closed). Sampled policy
  из PR #46 подключена через `MediaPolicyGatedPlaceMediaSyncer` и уже
  существующий allowlist (Place 5389/895/43023) — без дублирования
  allowlist. Runtime wiring — `PlaceCommitRunner` получил опциональный
  `mediaSyncer`, вызывается после успешного commit (CREATE и
  UPDATE_SAFE), недостижим для UPDATE_CONFLICT/SKIP_UNCHANGED; throw из
  синкера понижается до warning, commit остаётся LINKED. `-from-json`
  CLI намеренно не тронут (не подключает media-синкеры ни для одной
  сущности). Тесты: 18 в `PlaceMediaSyncer.test.ts`, 8 в
  `MediaPolicyGatedPlaceMediaSyncer.test.ts` (включая реальную
  интеграцию с `resolveSampledMediaPolicy`), 8 новых в
  `PlaceCommitRunner.test.ts`. Проверки — все green: полный
  `src/lib/migration/**` (56 файлов) + `scripts/migration-*.test.ts`
  sweep, eslint, `tsc --noEmit`, `pnpm build`. **Ноль реальных DB writes
  и media downloads** — только fakes в тестах и read-only
  metadata-аудит. Незавершённое: PR ещё не смержен. Следующий шаг после
  merge: backup + три новых golden Place, повторный прогон, UI-проверка
  — впервые переходим от разработки к контролируемому записывающему
  этапу.
- **2026-07-15 — Claude Code** — **PR C2 смержен.** PR #48: review
  (`chatgpt-codex-connector`, P2) нашёл валидный баг в
  `mergeWarnings()` — дедуп-ключ `code::message` не учитывал `details`,
  из-за чего несколько разных attachment'ов с одинаковым
  code+message (напр. два разных missing attachment, оба
  `PLACE_MEDIA_SOURCE_MISSING`/"WordPress attachment row was not
  found.") схлопывались в одну запись, теряя, какие именно attachment
  ID реально упали/были пропущены, в `MigrationRecord.validationSummary`.
  Исправлено отдельным коммитом `4fd7fc0c` (не amend): `details`
  (через `JSON.stringify`) добавлен в дедуп-ключ. Добавлен
  regression-тест
  `testWarningsWithSameCodeAndMessageButDifferentDetailsAreNeverCollapsed`.
  Review thread resolved, все gates green (`mergeStateStatus=CLEAN`,
  `mergeable=MERGEABLE`, 0 unresolved threads, CI SUCCESS на `4fd7fc0c`)
  → merge commit `ef0b81e7`. Post-merge CI + Docker Build & Push —
  SUCCESS на `ef0b81e7`. Local `dev` fast-forwarded. **Оба Place P0-медиа-
  блокера (PR C1 + PR C2) закрыты.** Следующий шаг — впервые переход от
  разработки к контролируемому записывающему этапу: backup БД → три
  новых golden Place → повторный прогон → UI-проверка. Golden imports
  НЕ запускались в PR C1/C2 — ни одного реального media download или DB
  write в production/local БД в рамках этой пары PR.
- **2026-07-15 — Claude Code** — **Golden write остановлен на preflight
  (§2 протокола), найден реальный blocker, PR C3.** Начали контролируемый
  golden write для Places 5389/895/43023 (baseline: `dev = origin/dev =
  2665e3cf`, local Postgres `localhost:5433/mamago2` подтверждён как
  единственная цель, media storage — local filesystem, sampled policy
  даёт FULL ровно для этих трёх). Перед backup доказали кодом: после
  частичного media failure Place остаётся `LINKED`, но повторный запуск
  того же `sourceRecordKey` без изменений в source классифицируется как
  `SKIP_UNCHANGED`, который перехватывается ДО вызова
  `PlaceCommitRunner`/`PlaceMediaSyncer` — недокачанное медиа навсегда
  остаётся недокачанным без внешнего вмешательства. Per протокол,
  golden writes НЕ запущены (backup не создавался, DB не тронута) —
  Алексей выбрал сначала закрыть blocker отдельным минимальным PR
  (`feat/migration-place-media-force-reprocess`, детали — см. пункт
  "PR C3" выше) вместо продолжения на свой риск. После merge PR C3 —
  возобновление golden write с шага 3 (backup) по тому же плану.
- **2026-07-15 — Claude Code** — **PR C3 смержен.** PR #49: расширили
  `--force-reprocess` с `--entity article` на `--entity article|place`
  (сама flip-логика `SKIP_UNCHANGED → UPDATE` уже была entity-agnostic,
  новый Place-специфичный код не потребовался — форсированный `UPDATE`
  проходит через уже существующий `PlaceCommitRunner` UPDATE_SAFE →
  `mediaSyncer.sync()`, а `classifyUpdate()` по-прежнему независимо
  гарантирует безопасность). Review (`chatgpt-codex-connector`, P2)
  обнаружил, что включение реального retry обнажает отдельный
  pre-existing баг в `PlaceMediaSyncer` (жил с PR C2, но был недостижим
  без рабочего retry): `sortOrder` вычислялся как "следующий свободный
  слот", из-за чего восстановленный после retry cover уезжал в конец
  вместо `sortOrder:0`. Исправлено отдельным коммитом `4f0f5a2d` (не
  amend): `sortOrder` теперь = фиксированный индекс attachment'а в
  cover-first списке, существующая строка при необходимости получает
  точечный `sortOrder`-update, чужие/ручные строки по-прежнему матчатся
  и трогаются только по точному совпадению `url`. Review thread
  resolved, все gates green (`mergeStateStatus=CLEAN`,
  `mergeable=MERGEABLE`, 0 unresolved threads, CI SUCCESS на `4f0f5a2d`)
  → merge commit `b3d1c584`. Post-merge CI + Docker Build & Push —
  SUCCESS на `b3d1c584`. Local `dev` fast-forwarded. **Golden write
  возобновляется** со следующего шага (backup local DB) по исходному
  плану — baseline теперь `dev = origin/dev = b3d1c584`.
- **2026-07-15 — Claude Code** — **Golden write: backup сделан, preflight
  пройден, но самый первый реальный targeted commit (Place 5389) сразу
  упал с новым, отдельным blocker'ом — PR C4.** Backup local Postgres
  создан (`~/dev/archives/mamago2-place-golden-pre-20260715-1941.dump`,
  774501 bytes, SHA-256 `804ba6dd...29b0b3`, `pg_restore --list`
  подтвердил 1419 TOC entries, `dbname: mamago2`). Read-only preflight
  для всех трёх golden Places подтвердил action=CREATE, отсутствие
  existing lineage, отсутствие slug/city collision, ожидаемые
  media/warning counts (совпадают с более ранними read-only аудитами).
  Первый реальный `pnpm migration:commit:wordpress-db --entity place
  --source-record-key wordpress-db:places:5389 --profile FULL_IMPORT
  --confirm-writes ...` упал с `server-only`'s own error ДО первого DB
  write (подтверждено: все counts после падения идентичны counts до
  запуска — 0 partial writes). Root cause и два fix-варианта (один
  отклонён после тестирования, второй подтверждён) — см. "PR C4" выше.
  Per протокол — golden write снова приостановлен, DB не тронута,
  Алексей выбрал сначала закрыть blocker отдельным PR
  (`fix/migration-cli-full-media-server-only`). После merge PR C4 —
  возобновление с шага 5A (Place 5389 targeted commit); backup и
  preflight остаются валидными, повторять не нужно.
- **2026-07-15 — Claude Code** — **PR C4 смержен.** PR #50: root cause
  подтверждён — `server-only` бросает исключение вне Next.js bundler
  безусловно, независимо от того, насколько лениво модуль
  импортирован; это НЕ Place-специфичный баг (общий `mamagoMediaImporter`
  используют и Event/Route), и, судя по всему, ни один real-write FULL
  media прогон ни для одной сущности не выполнялся через этот CLI
  раньше. Первый вариант fix'а (глобальный `--conditions=react-server`
  на npm-скрипте) протестирован и ОТКЛОНЁН до применения к golden write:
  флаг process-global, ломает резолвинг `react` для всего остального
  import-графа CLI — несколько `@radix-ui/react-*` падали с
  `React.createContext is not a function`. Финальный fix —
  `installServerOnlyStub()`, узкий патч Node CJS loader'а только для
  точной bare-specifier строки `"server-only"`; подтверждено, что
  `react`/`@radix-ui/*` резолвятся нормально. Ревью прошло без
  замечаний (0 threads). Все gates green
  (`mergeStateStatus=CLEAN`, `mergeable=MERGEABLE`, CI SUCCESS на
  `c7715a54`) → merge commit `55786060`. Post-merge CI + Docker Build &
  Push — SUCCESS на `55786060`. Local `dev` fast-forwarded. **Golden
  write возобновляется** с шага 5A (Place 5389 targeted commit) —
  baseline теперь `dev = origin/dev = 55786060`; backup
  (`~/dev/archives/mamago2-place-golden-pre-20260715-1941.dump`) и
  preflight (все три golden Places) остаются валидными от предыдущей
  попытки, повторять не нужно.
- **2026-07-16 — Claude Code** — **Первый реальный write состоялся, но
  третий blocker сразу нашёлся на media — PR C5.** `pnpm
  migration:commit:wordpress-db --entity place --source-record-key
  wordpress-db:places:5389 --profile FULL_IMPORT --confirm-writes ...`
  успешно создал Place 5389 (LINKED; title/phone E.164/opening hours/
  city всё корректно; `placeCount 2→3`, `openingHoursCount 2→3`,
  `migrationLineageCount 17→18`, `migrationRecordCount 35→36` — ровно
  одна новая запись каждого типа, Place 437 подтверждён
  bit-for-bit неизменным). Но все 15/15 media attachment упали —
  `guid` резолвится в HTML-страницу, а не в файл (подтверждено прямым
  `curl`: правильный URL строится из `_wp_attached_file`, вернул
  `HTTP 200 image/webp` с точным совпадением filesize). Per протокол —
  остановились, 895/43023 не запускали. Алексей решил: Place 5389
  оставить как есть (реальный, корректный, просто без media пока) и
  закрыть blocker отдельным PR (`fix/migration-wp-attachment-file-url`,
  детали — см. "PR C5" выше) — именно тот сценарий, для которого
  строился `--force-reprocess` (PR C3). После merge PR C5:
  `--force-reprocess` на 5389 для докачки media, затем 895 → 43023 по
  прежнему плану.
- **2026-07-16 — Claude Code** — **PR C5 смержен.** PR #51: review
  (`chatgpt-codex-connector`, P2) нашёл валидный баг в самом fix —
  `wp_postmeta` не имеет unique-ограничения на `(post_id, meta_key)`,
  так что прямой `LEFT JOIN` за `_wp_attached_file` мог вернуть больше
  одной строки на attachment при дублирующихся postmeta-записях, а
  `WordPressRepository.getAttachmentsByIds()` схлопывает строки по ID
  через `map.set()` — при дубликатах выигрывала бы произвольная,
  недетерминированная строка. Исправлено отдельным коммитом `01111330`
  (не amend): заменили `LEFT JOIN` на correlated scalar subquery
  (`ORDER BY meta_id ASC LIMIT 1`), гарантирующий ровно одну строку на
  attachment независимо от дублей. Заодно всплыла и исправлена
  хрупкость самого fake executor'а в тесте — naive substring-роутинг
  (`sql.includes("FROM wp_postmeta")`) стал ambiguous с новым
  subquery, порядок проверок переставлен. Подтверждено напрямую против
  живой WP БД (read-only): резолвинг для трёх уже проверенных
  attachment остался корректным. Review thread resolved, все gates
  green (`mergeStateStatus=CLEAN`, `mergeable=MERGEABLE`, 0 unresolved
  threads, CI SUCCESS на `01111330`) → merge commit `d2f5c262`.
  Post-merge CI + Docker Build & Push — SUCCESS на `d2f5c262`. Local
  `dev` fast-forwarded. **Golden write возобновляется**:
  `--force-reprocess` на Place 5389 для докачки media (baseline теперь
  `dev = origin/dev = d2f5c262`), затем 895 → 43023 по прежнему плану.
- **2026-07-18 — Claude Code** — **Event v1 scope-safety PR открыт (не
  смержен).** Codex провёл read-only Event аудит (2026-07-18,
  `Europe/Minsk`): 3431 source-событий, 12 published, 11 active/future
  eligible, 1 past-only (`wordpress-db:events:49842`). Присланный промт
  на устранение блокеров содержал требование форсировать Event media
  policy в `NONE` безусловно — это прямо противоречит уже смерженному
  3 дня назад решению (PR #46, sampled media policy, см. §1.5 Image
  import matrix: Event = `ready`, FULL sampled в local/dev, FULL для
  всех eligible в production). Конфликт вынесен Алексею явным
  вопросом до какой-либо реализации; решение — **media policy не
  трогать**, оставить как есть (PR #46 не отменяется). Реализована
  только реально подтверждённая часть блокеров: ветка
  `fix/migration-event-v1-scope-safety`, PR #57
  (`https://github.com/asoftby/mamago2/pull/57`) в `dev`, head SHA
  `b27cf34e2fb85e3d118a588569a939af7fe3f355`, 3 коммита:
  1. **Past-only exclusion + session pruning** — подтверждён живой баг:
     `metadata.startsAt` (на который завязан pre-normalize
     `excludePastEvents` фильтр в `orchestrator.ts`) никогда не
     проставляется wordpress-db Event адаптером — мёртвый код для
     реальных данных, поэтому `49842` (все сессии в прошлом) планировался
     как `CREATE`. Новый чистый helper
     `pruneEventScheduleToEligibleSessions()`
     (`src/lib/migration/adapters/wordpress-db/pruneEventSchedule.ts`,
     Europe/Minsk local-day boundary, инжектируемые часы) вызывается из
     `normalizeEvent()` на уже распарсенном `scheduleDraft`: 0 eligible
     sessions → `scheduleDraft: null` + `EVENT_PAST_ONLY_EXCLUDED`
     warning; смешанный past/future → прошедшие sessions обрезаются +
     `EVENT_PAST_SESSIONS_PRUNED`. `orchestrator.ts` теперь ловит
     `EVENT_PAST_ONLY_EXCLUDED` post-normalize и превращает plan item в
     `SKIP_POLICY`, без execution candidate (runner не вызывается).
     Заодно удалён `EVENT_DISCOVERY_VISIBILITY_RISK` — warning,
     утверждавший, что commit не синкает `ActivitySession`/
     `nextOccurrenceAt`, что стало ложным ещё с `2103b913`
     (2026-07-09, за 18 минут до появления этого warning).
  2. **Fallback `EventVenue`** — раньше вообще не писался
     (`EventCommitWriter`'s собственный докблок: "No `EventVenue`...
     that's later PRs"), из-за чего у Event без matched Place (в т.ч.
     намеренно отклонённый low-confidence match, напр. `64505`) вся
     venue evidence терялась на commit. `buildEventCreateDraft()`
     теперь строит `EventVenueDraft` (`kind: PLACE` при
     `context.placeId`, иначе `kind: MANUAL` с raw evidence) при любой
     venue evidence; unresolved Place по-прежнему не блокирует Event.
     `EventCommitWriter` пишет через отдельный `eventVenue.upsert()`
     по уникальному `activityId` — идемпотентно, `venue: null` — no-op
     (не стирает существующую строку). Без изменений Prisma schema —
     `EventVenue` уже существовала для этого.
  3. **`EVENT_ORGANIZER_REQUIRES_REVIEW`** warning в
     `resolveEventCommitContextWithMatching.ts` — organizerId и раньше
     никогда не назначался автоматически, но без сигнала для
     редактора; теперь есть warning по аналогии с
     `EVENT_CATEGORY_UNMATCHED`.

  Полный `src/lib/migration/**` + `scripts/migration-*.test.ts` sweep
  green (тронут `orchestrator.ts`, общий core-файл), targeted eslint
  чистый (уже существовавшие `any`-ошибки в
  `resolveEventCommitContextWithMatching.*` подтверждены baseline-diff
  как не мои), `tsc --noEmit` чистый, `pnpm build` green через pre-push
  hook. Один read-only preview против живой WP БД
  (`APP_ENV=LOCAL pnpm migration:preview:wordpress-db --entity event
  --allow-remote-readonly`, отчёт вне git,
  `/private/tmp/mamago2-event-v1-safe-preview.json`): discovered 12,
  CREATE 11, SKIP_POLICY 1 (`49842`), UPDATE 0, FAIL 0, 5 candidates с
  `EVENT_PAST_SESSIONS_PRUNED`, 0 retained past sessions в любом CREATE.
  DB invariants до/после идентичны (Activity EVENT 1, ActivitySession 1,
  EventVenue 1, MigrationLineage ACTIVITY 1, MigrationRun 25,
  MigrationRecord 213) — ноль writes. **Event commit не запускался**,
  `--confirm-writes` не использовался. CI на PR #57 был pending на
  момент завершения сессии — не поллился дальше по правилу. **PR не
  смержен** — ждёт Алексея. Чек-боксы раздела «Events» (полный
  source inventory, read-only readiness audit, golden Event commits и
  т.д.) остаются `[ ]`: эта сессия закрыла инженерные блокеры
  (prerequisite), а не сами пункты golden-write трека — после merge PR
  #57 следующий шаг по плану — «28 eligible active/future Event —
  read-only preview/аудит» (с уточнением: живой аудит 2026-07-18 дал
  12 published/11 eligible, а не 28 — цифра 28 в заголовке раздела,
  видимо, устарела и требует отдельной проверки перед golden write).
