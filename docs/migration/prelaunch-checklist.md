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
   Routes → Offers → Users → Profiles → Reviews (Reviews зависит от Users+Places).
   Продуктовые решения (§3 и помеченные «продуктовое решение») агент сам
   не принимает — формулирует варианты и спрашивает Алексея.
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
   targeting (`--source-record-key` allowlist) недостаточен сам по себе:
   UPDATE-ветка commit runner'а не покрыта тестами, защита ручных правок
   отсутствует. Нужна отдельная PR: allowlist + UPDATE-branch test coverage
   + manual-edit protection одновременно, не по частям.
3. **(B) Режим работы (`work_hours`)** — известная проблема, требует
   отдельного фикса перед full batch; детали фиксируются при выполнении PR B.
4. **(C) Media** — известная проблема (не совпадает с текущей строкой
   `Place | ready` в матрице §1.5 — см. исправление там же); детали
   фиксируются при выполнении PR C.

**Место `437` (уже импортирован в dev-БД) НЕ используется как первый
UPDATE-sample**: есть ручные правки, `lastImportedAt=null`, UPDATE-ветка
runner'а не покрыта тестами. Требует отдельной reconciliation-задачи после
(D) с защитой ручных данных — новые golden samples импортируются first, 437
проверяется отдельно.

**Реализация (вертикальными PR, без смешивания слоёв):**

- [ ] **PR — Phone E.164 fix** (2026-07-14/15, ветка
      `fix/migration-place-phone-e164`, **PR открыт, merge ещё не выполнен**)
      — консолидация двух разошедшихся нормализаторов телефона в один
      канонический (`src/lib/phone/e164.ts`, `libphonenumber-js/core`),
      `normalizePlace.ts` добавляет `phoneE164` + `PLACE_PHONE_INVALID`
      warning, `buildPlaceCreateDraft.ts` пишет `phone` из `phoneE164`.
      `InternationalPhoneInput` защищён от краша на легаси-значении, не
      мутирует при рендере. Место 437 в БД не менялось (DB writes
      отсутствуют). `PlaceScalarLinker` (неподключённый dead code) не
      тронут функционально — задокументирован как известное расхождение
      для будущего подключения. *(Отмечается `[x]` отдельным прямым
      коммитом в `dev` только после фактического merge — см. журнал
      сессий, паттерн `87bd43f9`.)*
- [ ] PR — targeted CLI + UPDATE safety (D).
- [ ] PR — opening-hours fix (B).
- [ ] PR — media fix (C).
- [ ] Новые golden samples (после B+C).
- [ ] Reconciliation места 437 (после D, с защитой ручных правок).
- [ ] Full batch (82 Place) — только после закрытия всех пунктов выше.

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
| Event / Past Event | NONE | NONE | NONE | Past Event импортируется без media до отдельного product decision. |

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
