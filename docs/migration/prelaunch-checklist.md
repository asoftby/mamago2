# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

**Обновлено:** 2026-07-27  
**Base:** `dev` @ `da243212ae661fb384f4abf762fa4f076347efcb` — PR #84 merged  
**Текущая фаза:** `ACTIVITIES — Slice 16 dependency inventory`  
**Текущий gate:** `BLOCKED_SOURCE_SNAPSHOT_UNAVAILABLE`

> Подробная история Slices 1–15 сохранена в Git и в профильных proof-документах.
> Этот файл содержит только актуальное состояние, обязательные gates и оставшийся
> критический путь до запуска.

---

## 1. Неподвижные правила

1. Перед Prisma/auth/migration работой читать `CLAUDE.md` и профильные runbooks.
2. Запрещены `prisma migrate dev`, `prisma db push`, reset и destructive cleanup.
3. WordPress — строго read-only source. Разрешены только заранее определённые `SELECT`.
4. Для каждой новой сущности: один environment gate, один SSH probe и один
   агрегированный immutable source capture.
5. Первый полный write-run выполняется последовательно с `stop-on-first-error`,
   без автоматических retry, cleanup и rollback уже записанного prefix.
6. Snapshot, manifest и canonical hashes фиксируются до первого write.
7. После batch обязателен cumulative DB/storage audit и один общий idempotency rerun.
8. Аномалии не исправляются внутри clean batch: они переносятся в документированный backlog.
9. Media выполняются только по заранее подготовленному manifest и отдельному gate.
10. Один связный vertical slice → одна ветка → один Draft PR.
11. Production разрешён только после local golden, local batch, idempotency proof и Go/No-Go.
12. Raw immutable snapshots запрещено хранить только в `/tmp`.
13. Source-of-truth snapshots хранятся в долговечном приватном non-Git пути:

```text
/Users/shapovalovalexey/.mamago2/migration-snapshots/<entity>/
```

`/tmp` разрешён только для производных временных файлов. Raw snapshot никогда не
коммитится в Git.

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
| Content authorship | READ-ONLY RECONCILED | 0 exact, 10 targets absent, 1 conflict, 1 partial |
| Activities | NOT STARTED / BLOCKED | Durable Activity snapshot и Slice 16 inventory |
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

---

## 4. Текущий blocker — ACTIVITIES Slice 16

Старый raw Users snapshot находился только в `/tmp` и был удалён системой между
2026-07-23 и 2026-07-27. Его запрещено молча перегенерировать или подменять
санитизированными manifests.

Принятое решение: не восстанавливать Users snapshot. Создать первый отдельный
immutable snapshot сущности Activity в долговечном приватном пути.

### Разрешённый Slice 16 scope

- [ ] Подтвердить `environment = LOCAL`, clean branch и exact base.
- [ ] Выполнить ровно один SSH probe.
- [ ] Создать один агрегированный read-only Activity snapshot.
- [ ] Сохранить snapshot вне `/tmp` и вне Git.
- [ ] Зафиксировать file manifest, размеры, SHA-256 и общий canonical hash.
- [ ] Зафиксировать masked source fingerprint и версию capture query.
- [ ] Посчитать source records по post type/status.
- [ ] Выделить exact Activity dependencies для 10 `TARGET_NOT_MIGRATED` users.
- [ ] Построить User/Place/media dependency matrix.
- [ ] Классифицировать Activity records: `CREATE`, `EXCLUDED`, `MANUAL`, `BLOCKED`.
- [ ] Выбрать один минимальный golden Activity candidate.
- [ ] Доказать нулевые DB/storage/media/authorship writes.
- [ ] Обновить runbook о долговечном хранении snapshots.

Slice 16 заканчивается planning/proof. Activity golden write и authorship write в
этом slice запрещены.

---

## 5. Обязательный P0 остаток до запуска

### 5.1 Activities и content authorship

- [ ] Завершить Slice 16 durable snapshot + dependency inventory.
- [ ] Принять product-решение: Activity migration входит в launch P0 или authorship
      формально переносится в P1.
- [ ] Если Activity входит в P0: реализовать golden vertical slice.
- [ ] Выполнить clean Activity batch последовательно.
- [ ] Выполнить один общий Activity rerun.
- [ ] Повторить read-only authorship reconciliation после Activity migration.
- [ ] Выполнить golden authorship write только для появившегося exact candidate.
- [ ] Выполнить batch только для exact/conflict-free authorship relations.
- [ ] `user:521` оставить manual conflict до отдельного founder decision.
- [ ] `user:91` разобрать после полного Article/Route lineage review.

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
- [ ] Mobile/desktop critical navigation smoke test.

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
операции завершены, но production provider, Activities decision, Events tail,
Routes review, media, SEO/regressions и весь RC/cutover цикл ещё не закрыты.

Крупных P0 блоков осталось **9**:

1. Activity snapshot/inventory и authorship decision.
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
Phase: ACTIVITIES — Slice 16 dependency inventory
Base: dev @ da243212ae661fb384f4abf762fa4f076347efcb
Current decision: BLOCKED_SOURCE_SNAPSHOT_UNAVAILABLE
Authorized resolution: first durable Activity immutable snapshot
Database writes: forbidden
Activity/authorship writes: forbidden
```

Выполнить environment gate → один SSH probe → один Activity capture в
`~/.mamago2/migration-snapshots/activities/` → все дальнейшие inventory и planning
операции выполнять локально без повторных WordPress reads.
