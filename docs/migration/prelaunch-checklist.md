# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

**Обновлено:** 2026-07-27  
**Base:** `dev` @ `f9791a45679dfcb77065329c2a918d56fde2a761` — PR #86 merged  
**Текущая фаза:** `USERS — Slice 17 published Article dependency proof (user:575)`  
**Текущий gate:** `READY`

> Подробная история Slices 1–16 сохранена в Git и в профильных proof-документах.
> Этот файл содержит только актуальное состояние, обязательные gates и оставшийся
> критический путь до запуска.

---

## 1. Неподвижные правила

1. Этот файл — источник истины по текущему состоянию prelaunch-миграции.
2. Перед Prisma/auth/migration работой читать `CLAUDE.md` и профильные runbooks.
3. Запрещены `prisma migrate dev`, `prisma db push`, reset и destructive cleanup.
4. Первый полный write-run каждой сущности выполняется последовательно с
   `stop-on-first-error`, без автоматических retry, cleanup и rollback.
5. WordPress — только read-only source. Production writes разрешаются отдельным
   Go/No-Go gate.
6. Immutable source snapshot, manifest и canonical hashes фиксируются до write.
7. После batch — cumulative DB/storage audit и один общий idempotency rerun.
8. Аномалии не чинятся по ходу batch: они переносятся в документированный backlog.
9. VPN и сетевые маршруты автоматически не меняются. Маршрут — informational signal.
10. Media выполняются только по заранее подготовленному manifest и отдельному gate.
11. Ветки сущностей не смешиваются. Один связный vertical slice → один Draft PR.
12. Production разрешён только после local golden, local batch и idempotency proof.
13. **Immutable source snapshots запрещено хранить только в `/tmp`.** `/tmp`
    допускается лишь для производных временных файлов (промежуточные
    выгрузки, диагностика), не для source-of-truth. Snapshot должен
    храниться в долговечном приватном non-Git пути
    (`~/.mamago2/migration-snapshots/<entity>/`), с ограниченными
    permissions (0700 на директории, 0600 на файлах). Причина: USERS
    snapshot в `/tmp/scratchpad/users/` был потерян между сессиями
    (`/tmp` не переживает reboot), что заблокировало Slice 16 до создания
    отдельного Activity snapshot по новому, долговечному пути.
14. Юнит/интеграционные тесты не должны зависеть от внешних immutable
    snapshot-путей (например `/tmp/scratchpad/users/`). Тесты либо
    используют уже закоммиченные sanitized fixtures
    (`docs/migration/*.json`), либо создают собственные временные fixtures
    внутри теста. Production-анализаторы (CLI-скрипты) продолжают
    принимать внешний snapshot-путь как параметр без изменений.

---

## 2. Текущий прогресс

| Трек | Статус | Что остаётся |
| --- | --- | --- |
| Migration engine | COMPLETE | Только regression и production validation |
| Places | CORE COMPLETE | Media, production validation, public/city audit |
| Offers | LOCAL SAFE SCOPE COMPLETE 63/63 | Production execution, media, backlog H/I |
| Routes | IMPORTED 14/14 | Ручной review, publish, slug history, redirects, public validation |
| Events | PARTIAL 4/9 | 5 CREATE, 67 sessions, общий rerun, city/public validation |
| Users clean migration | LOCAL COMPLETE 564/564 | Production import и activation delivery |
| Users activation architecture | COMPLETE | Production email provider и delivery Go/No-Go |
| Business-linked Users | **FULLY CLOSED** | 38/38 ownership, 38/38 `BUSINESS_OWNER`; backlog 0 |
| Users manual/privileged | PLANNED 15 | 5 founder decisions, 9 exclusions, 1 existing ADMIN unchanged |
| Content authorship | SLICE 17 COMPLETE | 9/10 users → P1 (expired-only Activities); user:575 → `ARTICLE_GOLDEN_REQUIRED`, golden candidate `wordpress-db:post:56250` |
| Activities | SLICE 16 COMPLETE | 0/63 authored events P0-eligible (all expired) → reclassified `P1_HISTORICAL_EXPIRED_ACTIVITY` |
| User/Business profile media | NOT STARTED | Manifest, local proof, production gate |
| Article media | NOT STARTED | Cover + inline remap, storage/dedup proof |
| Reviews | NOT STARTED | Scope, vertical slice, batch, aggregates |
| Redirects/pages/SEO | PARTIAL | Exact redirects, pages, canonical/sitemap/robots/noindex audit |
| Product regressions | PARTIAL | Event discovery/404, Article city visibility, full smoke |
| RC / production cutover | NOT STARTED | Freeze, backup, rehearsal, Go/No-Go, migration, DNS |

---

## 3. Завершено и не должно повторяться

### 3.1 Foundation

- [x] `MigrationRun`, `MigrationRecord`, `MigrationLineage`.
- [x] Canonical hashes, lineage uniqueness, idempotent classification.
- [x] Local/dev/prod profiles и production cutover runbook.
- [x] Safety policy: sequential first write, CAS/conditional updates,
      stop-on-first-error, no automatic cleanup after partial batch.

### 3.2 Offers

- [x] 99 published source records inventoried.
- [x] Canonical scope 91; safe canonical scope 63.
- [x] Full source → normalize → draft → validate → write → lineage flow.
- [x] 63/63 imported locally.
- [x] Final rerun: `63 SKIP_UNCHANGED`.
- [x] Duplicate lineage/offers: 0.
- [x] Forbidden-table and media-call audit: clean.

Deferred:

```text
class H: 28 — missing required Place relation
class I: 8 — noncanonical alias
Offer media: separate gate
production Offer execution: not started
```

### 3.3 Users identity and activation foundation

- [x] Immutable Users planning capture completed from 579 source users.
- [x] Legacy password hashes excluded.
- [x] Automatic ADMIN inheritance forbidden.
- [x] Prisma/auth pending-activation foundation.
- [x] Hash-only activation token service.
- [x] Activation request/complete endpoints and security proofs.
- [x] Clean local User scope imported: 564/564.
- [x] One common rerun: 564 `SKIP_UNCHANGED`.
- [x] Migrated users remain `PENDING_ACTIVATION`, nullable password,
      no sessions/tokens/provider calls during migration.

### 3.4 Business-linked Users — fully closed

- [x] Slice 6: ownership planning for 38 users.
- [x] Slices 7–8: 36 exact ownership writes and rerun proof.
- [x] Slices 9–10: role elevation for the same 36 users and rerun proof.
- [x] Slice 11: read-only reconciliation of users 89/130.
- [x] Slices 12–13: partial-coverage ownership writes using only migrated
      published Places; excluded draft/unpublished Places untouched.
- [x] Slice 14: users 89/130 elevated to `BUSINESS_OWNER`.

Final proof:

```text
Business ownership:       38/38 COMPLETE
BUSINESS_OWNER elevation: 38/38 COMPLETE
Business-linked backlog:  0
Excluded unpublished/draft Places: untouched
```

### 3.5 Content authorship reconciliation

- [x] Slice 15 merged via PR #84, merge SHA
      `da243212ae661fb384f4abf762fa4f076347efcb`.
- [x] Read-only manifest regenerated and byte-identical to Slice 6.
- [x] Actual target fields confirmed:
  - `Article.authorUserId` — nullable;
  - `Route.authorId` — nullable;
  - `Activity.ownerUserId` — required/non-null.
- [x] Database writes: 0.

Current classification:

```text
TARGET_NOT_MIGRATED:       10
EXISTING_AUTHOR_CONFLICT:   1 — wordpress-db:user:521
PARTIAL_LINEAGE:            1 — wordpress-db:user:91
EXACT_LINK_CANDIDATE:       0
ALREADY_SATISFIED:          0
UNSUPPORTED_TARGET:         0
```

Authorship write запрещён до появления хотя бы одного exact/conflict-free target.

### 3.6 Activities — Slice 16 dependency inventory

- [x] First standalone immutable Activity snapshot (not a USERS re-capture),
      stored at `~/.mamago2/migration-snapshots/activities/`.
- [x] 1 SSH probe, 1 aggregated read-only session; `wp_users` never queried.
- [x] Full dependency inventory for the 10 `TARGET_NOT_MIGRATED` content-author
      users: 65 authored records classified.
- [x] Database writes: 0.

Findings:

```text
Authored events:   63 — ALL post_status=expired -> EXCLUDED
                   (Phoenix v1 Activity migration has always been
                    publish-only; site-wide only 9 publish events exist,
                    none belong to these users)
Authored articles:  2 (wordpress-db:user:575) — both publish -> CREATE
MANUAL / BLOCKED:   0 / 0

Decision: the 63 expired events are P1_HISTORICAL_EXPIRED_ACTIVITY —
  explicitly NOT extended into launch P0. Importing 63 historical expired
  events would not create meaningful prelaunch value and contradicts the
  frozen scope. This does not block launch.

Only remaining P0-relevant authorship path: wordpress-db:user:575's 2
  published Articles, via the existing Article write path (Gate 9) — see
  Slice 17 below. user:521 (existing author conflict) and user:91
  (partial lineage) stay deferred, unrelated to the Activity decision.
```

### 3.7 Test suite snapshot-independence (adversarial fix)

A full local regression sweep surfaced 4 test files quietly depending on the
lost `/tmp/scratchpad/users/` path (Rule 13/14):

- [x] `planning/user-ownership/buildPlanningManifests.test.ts` — switched to a
      self-generated synthetic snapshot fixture (ephemeral temp dir).
- [x] `planning/user-ownership/readOnlyIntegration.test.ts` — switched to
      `committedClassificationFixture.ts`, sourced from the already-committed
      sanitised Slice 6 manifests (real 15/38/12 sourceRecordKeys, no data
      lost).
- [x] `planning/business-linked-tail/reconcileBusinessLinkedTail.integration.test.ts`
      — switched to a dedicated test-only DB namespace + synthetic snapshot
      fixture (mirrors the `BusinessOwnershipGoldenRunner` integration test
      convention).
- [x] `commit/user/UserCleanBatch.test.ts` (2 tests) — genuinely
      unfixable without either the full lost 579-user raw snapshot or
      weakening hardcoded production invariants (`USER_SNAPSHOT_SHA256`,
      `CLEAN_USER_COUNT`, golden users 7/38). Explicitly `test.skip()`'d with
      an inline comment; not silently deleted. Founder decision: skip and
      merge, do not recapture USERS for this.

Full `src/lib/migration` suite (sequential, `--test-concurrency=1`): **155
pass, 2 skipped, 0 fail.** (Running the same suite fully parallel produces
transient Serializable write-conflict failures in unrelated integration
tests sharing the local DB — a concurrency artifact of the test run, not a
regression; each of those files passes cleanly in isolation.)

### 3.8 Articles — Slice 17 published Article dependency proof

- [x] Read-only proof for exactly the 2 published Articles authored by
      `wordpress-db:user:575` (`wordpress-db:post:56250`,
      `wordpress-db:post:57731`), sourced from Slice 16's durable Activity
      snapshot and the committed Slice 16 manifest — no new SSH probe, no
      new WordPress query, no new source snapshot.
- [x] Both classified `ARTICLE_TARGET_NOT_MIGRATED` (no Article lineage,
      no MigrationRecord history for either key); user:575's own USER
      lineage confirmed active.
- [x] Decision: **`ARTICLE_GOLDEN_REQUIRED`**. Golden candidate selected
      deterministically: `wordpress-db:post:56250`.
- [x] New fully self-contained test suite (28 tests: pure classification,
      synthetic-fixture orchestration, real-DB integration with synthetic
      950xxx IDs) — no dependency on `/tmp` or the durable home-directory
      snapshot in any test.
- [x] Database writes: 0 (Article/authorship/User-role/media all 0).

Canonical manifest hash: `833e67d396300bd42d67a7218a0340770b7ff9544b68535d90e453c036710b8b`
(`docs/migration/users-slice17-article-authorship-proof.json`).

---

## 4. Текущее решение — ACTIVITIES / AUTHORSHIP scope

Slice 16 закрыл неопределённость по Activities: расширять launch P0 на historical
expired Events не нужно. Все 63 expired Activities и связанная с ними authorship
переносятся в `P1_HISTORICAL_EXPIRED_ACTIVITY` — это не launch blocker.

Slice 17 (read-only) подтвердил: обе опубликованные статьи `wordpress-db:user:575`
(`wordpress-db:post:56250`, `wordpress-db:post:57731`) — **`ARTICLE_TARGET_NOT_MIGRATED`**,
без единого lineage-конфликта. Ни одна ещё не мигрирована как Article; USER
lineage для user:575 активна и присутствует. Решение: **`ARTICLE_GOLDEN_REQUIRED`**
— нужен отдельный Article golden migration slice до authorship write. Golden
candidate выбран детерминированно: `wordpress-db:post:56250` (обе статьи
одинаково минимальны — по одному `_thumbnail_id`, без gallery; выбор по меньшему
legacy post ID).

`user:521` (existing author conflict) остаётся manual conflict до отдельного
founder decision. `user:91` (partial lineage) остаётся backlog после полного
Article/Route lineage review. Expired Activities не трогать.

---

## 5. Обязательный P0 остаток до запуска

### 5.1 Activities и content authorship

- [x] Завершить Slice 16 durable snapshot + dependency inventory.
- [x] Принять product-решение: expired Activities → `P1_HISTORICAL_EXPIRED_ACTIVITY`,
      не входят в launch P0.
- [x] Slice 17: проверить, входят ли 2 опубликованные статьи user:575 в
      canonical Article launch scope; проверить текущие Article lineages.
      Результат: обе `ARTICLE_TARGET_NOT_MIGRATED`, decision `ARTICLE_GOLDEN_REQUIRED`.
- [ ] Article golden migration slice: смигрировать golden candidate
      `wordpress-db:post:56250` (переиспользуя существующий Article write path).
- [ ] После Article migration повторить read-only authorship reconciliation.
- [ ] Выполнить golden authorship write только для появившегося exact
      candidate (user:575).
- [ ] `user:521` оставить manual conflict до отдельного founder decision.
- [ ] `user:91` разобрать после полного Article/Route lineage review.
- [ ] Expired Activities (63) не мигрировать в рамках P0.

### 5.2 Users production и activation

- [ ] Зафиксировать dispositions для 15 manual/privileged users:
  - 1 existing ADMIN — оставить неизменным;
  - 9 exclusions — подтвердить;
  - 5 `REQUIRES_FOUNDER_DECISION` — принять решения.
- [ ] Интегрировать и проверить production email provider.
- [ ] Сохранить LOCAL/DEV delivery hard-disabled.
- [ ] Подготовить production User manifest и checksums.
- [ ] Провести production-like rehearsal Users + activation.
- [ ] Подготовить controlled activation delivery после migration Go/No-Go.
- [ ] Решить P0/P1 для User/Business avatars и logos.
- [ ] Если media остаётся P0 — выполнить отдельный manifest/golden/batch/rerun.

### 5.3 Events

Текущий известный scope:

```text
eligible imported: 4/9
remaining CREATE: 5
pending materialized sessions: 67
```

- [ ] Проверить exact Docker/CI environment gate.
- [ ] Preview 5 оставшихся eligible Events.
- [ ] Выполнить sequential targeted commits.
- [ ] Проверить 67 sessions и cumulative deltas.
- [ ] Выполнить один общий rerun.
- [ ] Проверить city/date discovery и отсутствие 404.

Event images остаются вне P0 frozen scope.

### 5.4 Routes

- [ ] Ручной review 14/14 импортированных Routes.
- [ ] Проверить stops, descriptions, RouteStop images и city mappings.
- [ ] Publish approved Routes.
- [ ] Зафиксировать slug history и redirect map.
- [ ] Выполнить public URL validation.

### 5.5 Places, Offers, Articles и media

- [ ] Финальная production validation Places.
- [ ] Place media manifest, storage и dedup audit.
- [ ] Production execution Offers safe scope 63/63.
- [ ] Offer media gate либо явный перенос в P1.
- [ ] Исправить Article visibility по selected/default city.
- [ ] Реализовать Article cover manifest.
- [ ] Выполнить inline `wp-content/uploads` remap.
- [ ] Local FULL media proof.
- [ ] Dev metadata-only proof.
- [ ] Production FULL manifest/gate.

### 5.6 Reviews

- [ ] Подтвердить approved source scope.
- [ ] Проверить Users + Places dependency gate.
- [ ] Реализовать Review vertical slice.
- [ ] Выполнить golden sample, small batch и rerun.
- [ ] Проверить public rating aggregates.

Founder decision допускает перенос Reviews в P1 только с явной фиксацией, что
старые рейтинги/отзывы не являются launch blocker.

### 5.7 Redirects, mandatory pages и SEO

- [ ] Импортировать RankMath `exact` redirects subset.
- [ ] Все redirects на `/` вручную перемапить на релевантные hubs.
- [ ] Подготовить legal/about/contact pages.
- [ ] Проверить WordPress catch-all.
- [ ] Проверить canonical и no-trailing-slash.
- [ ] Проверить city-scoped slugs и canonical URLs.
- [ ] Проверить sitemap/robots/noindex launch gate.
- [ ] Проверить redirect manifest minimum и collisions.

`start`/`contains` redirects остаются P1 после conflict review.

### 5.8 Product regressions — launch blockers

- [ ] Event появляется в правильном городе и на правильной дате.
- [ ] Event public URL не отдаёт 404.
- [ ] Published Article отображается в блоге selected/default city.
- [ ] Auth и migrated-account activation smoke test.
- [ ] Business cabinet smoke test.
- [ ] Admin lifecycle smoke test.
- [ ] Public Places/Offers/Events/Articles/Routes smoke test.
- [ ] Mobile/desktop критический navigation smoke test.

### 5.9 Release candidate и production cutover

- [ ] Freeze production source snapshots.
- [ ] Зафиксировать production manifests и checksums.
- [ ] Сделать fresh production backup.
- [ ] Подтвердить restore procedure без destructive production rehearsal.
- [ ] Выполнить full local rehearsal на production-like data.
- [ ] Выполнить dev metadata-only rehearsal.
- [ ] Подготовить cumulative DB/storage delta report.
- [ ] Выполнить forbidden tables/fields audit.
- [ ] Подготовить redirect/SEO validation report.
- [ ] Docker Build & Push на exact RC SHA — GREEN.
- [ ] Финальный Go/No-Go.
- [ ] Последовательная production migration.
- [ ] Post-migration validation.
- [ ] Разрешённые production idempotency reruns.
- [ ] DNS cutover и noindex switch.
- [ ] Monitoring и rollback decision window.

---

## 6. Не входит в обязательный P0 без отдельного решения

- Past Events и Event images.
- **63 expired Activities и связанная authorship (Slice 16) —
  `P1_HISTORICAL_EXPIRED_ACTIVITY`.**
- Noncanonical Offer class I.
- Offer class H без Place relation.
- Draft/unpublished long-tail bulk publication.
- Full public profile content classification.
- RankMath `start`/`contains` redirects.
- Historical bookings, WooCommerce/LatePoint и social feeds.
- Collections и редкие custom post types.

---

## 7. Оценка готовности к запуску

Это операционная оценка, а не календарный прогноз:

```text
Core migration mechanics:       ~80% complete
Local clean data work:           ~70% complete
Production/cutover readiness:    ~30% complete
Overall strict prelaunch:        ~60–65% complete
Remaining strict P0 work:        ~35–40%
```

Почему остаток всё ещё значительный: самые рискованные Users identity/ownership
операции завершены, но production provider, Events tail, Routes review, media,
SEO/regressions и весь RC/cutover цикл ещё не закрыты.

Крупных P0 блоков осталось **9**:

1. Article dependency proof для user:575 (Slice 17) — единственный оставшийся
   authorship P0-путь; expired Activities вынесены в P1.
2. Users production activation и manual dispositions.
3. Events tail.
4. Routes review/publish.
5. Places/Offers/Article production media/content closure.
6. Reviews либо явный P1 defer.
7. Redirects/pages/SEO.
8. Product regression suite.
9. RC rehearsal и production cutover.

---

## 8. Следующее одно действие

```text
Phase: ARTICLES — golden migration slice for wordpress-db:post:56250
Base: dev @ a98616f0dbf4066cdbbc73593359620fff181edf (PR #87 merged)
Prerequisite (Slice 17, COMPLETE, read-only):
  both published Articles for wordpress-db:user:575 are ARTICLE_TARGET_NOT_MIGRATED
  decision: ARTICLE_GOLDEN_REQUIRED
  golden candidate selected: wordpress-db:post:56250 (deterministic tie-break)
Scope for the next slice:
  - Article golden vertical slice for wordpress-db:post:56250 only
  - reuse the existing Article write path (Gate 9's ArticleCommitRunner family)
  - after import, re-run authorship reconciliation
  - authorship write for user:575 only once an EXACT_AUTHORSHIP_CANDIDATE exists
Explicitly out of scope:
  - the second article (wordpress-db:post:57731) — separate future step
  - expired Activities (63) — P1_HISTORICAL_EXPIRED_ACTIVITY, не трогать
  - user:521 — manual conflict, отдельный founder decision
  - user:91 — partial-lineage backlog
Database writes: forbidden until this scope is explicitly authorized
```
