# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный рабочий чек-лист до полного завершения миграции WordPress → mamaGo 2.0 и production cutover.

**Обновлено:** 2026-07-23
**Текущая ветка следующей фазы:** `codex/users-activation-endpoints`
**Base:** `dev` @ `289ec055baa908258a5957292593a9313ca6eafa`

> Подробный исторический журнал предыдущей версии чек-листа сохранён в Git
> в merge-коммите `a2dd28a0eef93cf1cbb70dbae5132201b220879e` и его предках.
> Этот файл теперь содержит только актуальное состояние, обязательные gates и
> оставшиеся работы.

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

---

## 2. Текущий прогресс

| Трек | Статус | Что остаётся |
| --- | --- | --- |
| Migration engine | COMPLETE | Только regression/production validation |
| Places | CORE COMPLETE | Финальная production validation и media/cutover checks |
| Routes | IMPORTED 14/14 | Ручной review, publish, slug history и redirects |
| Events | PARTIAL | 5 eligible CREATE и 67 sessions, затем общий proof |
| Offers | SAFE CANONICAL COMPLETE 63/63 | Только отдельные future gates для media и backlog H/I |
| Users source planning | COMPLETE | Ничего повторно не исследовать |
| Users activation architecture | COMPLETE | Slices 1–3 merged via PR #70–#72 |
| Users migration | CLEAN LOCAL SCOPE COMPLETE | Slice 5: 564/564 local, production import not started |
| Users manual/ownership planning | READ-ONLY PLANNING COMPLETE | Slice 6: manual backlog + ownership/authorship plans; no writes yet |
| Profiles/ownership/media | NOT STARTED | После Users identity foundation |
| Reviews | NOT STARTED | После Users + Places identity mappings |
| Article media | NOT STARTED | Cover + inline media remap |
| Redirects/pages/SEO | PARTIAL | Exact redirects, mandatory pages, final SEO audit |
| Product regressions | PARTIAL | Event city discovery и Article blog-city visibility |
| RC / production cutover | NOT STARTED | Freeze, backup, rehearsal, validation, Go/No-Go |

---

## 3. Завершено

### 3.1 Migration foundation

- [x] `MigrationRun`, `MigrationRecord`, `MigrationLineage` и idempotent commit flow.
- [x] Targeted `--source-record-key` для реализованных сущностей.
- [x] Immutable source snapshot pattern.
- [x] Canonical hash, lineage uniqueness и rerun classification.
- [x] Local/dev/prod migration profiles.
- [x] Production cutover runbook.
- [x] Safety policy: sequential first write, stop-on-first-error, no auto cleanup.

### 3.2 Places / Articles / Events / Routes foundation

- [x] Place adapter/normalizer/draft/writer/runner foundation.
- [x] Article adapter/normalizer/draft/writer/runner foundation.
- [x] Event adapter/normalizer/draft/writer/runner foundation.
- [x] Route adapter/normalizer/draft/writer/runner foundation.
- [x] Route local import: 14/14.
- [x] Place phone E.164 normalization and guarded update safety.
- [x] Place opening-hours parsing/import support.
- [x] Route admin lifecycle section.

### 3.3 OFFERS — завершено

- [x] Source inventory and classification: 99 published source records.
- [x] Canonical scope: 91.
- [x] Safe canonical scope: 63.
- [x] Offer vertical slice: source → normalize → draft → validate → write →
      lineage → idempotency.
- [x] Unicode whitespace normalization for single-line fields.
- [x] Guarded relation collapse for multiple rows resolving to one Place.
- [x] Golden CREATE and guarded title remediation.
- [x] Batch 1: 20 records + idempotency rerun.
- [x] Batch 2: 20 CREATE.
- [x] Batch 3: 20 CREATE.
- [x] Batch 4: 3 CREATE.
- [x] Final all-63 rerun: `63 SKIP_UNCHANGED`, `0 CREATE`, `0 UPDATE`.
- [x] Duplicate Offers: 0.
- [x] Duplicate lineage: 0.
- [x] Forbidden-table deltas: 0.
- [x] Media importer calls: 0 (`media policy: NONE`).
- [x] PR #69 merged into `dev`.

Merge proof:

```text
PR: #69
head: 1fca8c8bd7c74f3523e55e43f39cab3f88ffda4a
merge commit: a2dd28a0eef93cf1cbb70dbae5132201b220879e
CI before merge: SUCCESS
```

OFFERS больше не запускать повторно.

Оставшийся OFFERS backlog:

```text
class H: 28 — отсутствует обязательная Place relation
class I: 8 — noncanonical `offers` alias, исключён
Offer media: deferred, требует отдельного manifest/write gate
production Offer execution: не выполнялся
```

### 3.4 USERS — source planning завершён

- [x] Один environment gate.
- [x] Один SSH probe.
- [x] Один агрегированный read-only source capture.
- [x] Immutable Users snapshot.
- [x] Inventory, identity, ownership и role classification.
- [x] Activation/reactivation policy planning.
- [x] Profile-media inventory.
- [x] Golden samples.
- [x] Deterministic Batch 1 planning.
- [x] Implementation gap analysis.

Source summary:

```text
source users: 579
usermeta rows: 10,829
content/authorship rows: 21,595
comments/reviews: 1
Voxel relations: 1,129
profile-media references: 94
ownership evidence rows: 21,781
raw snapshot SHA-256:
569c59f2e0d0a277a98ff5f7fe418170b123c77901c5c42064cecbaa2338f5a4
```

Classification:

```text
A — clean new user:              514
B — exact existing-user link:      0
C — exact business ownership:     38
D — content author:               12
E — duplicated legacy email:       0
F — conflicting local collision:   0
G — invalid/missing email:          0
H — privileged/manual review:     15
I — suspicious identity:           0
J — technical anomaly:             0
--------------------------------------
total:                            579
clean scope:                      564
manual/blocked scope:              15
```

Fixed policy:

- WordPress password hashes не захватываются и не импортируются.
- Автоматическое наследование `ADMIN` запрещено.
- Один exact local-email match остаётся в privileged class H.
- Existing local User не перезаписывается автоматически.
- Profile media на planning-фазе: `NONE`.
- Batch 1: 20 class A records, deterministic order, expected `CREATE`.

Golden samples:

```text
ordinary user: wordpress-db:user:7
business owner: wordpress-db:user:38
privileged/local collision: wordpress-db:user:1
```

Повторные SSH/WordPress reads и перегенерация Users snapshot не нужны.

### 3.5 USERS — architecture gate завершён

- [x] 12 architecture outputs созданы.
- [x] Manifest checksums проверены.
- [x] Current credentials/auth paths проинвентаризированы.
- [x] Activation state/password/token/login/session/ownership architecture решена.
- [x] Threat model и test plan подготовлены.
- [x] Implementation slices определены.
- [x] Decision: `READY_FOR_PRISMA_AUTH_FOUNDATION_IMPLEMENTATION`.
- [x] Repository и DB не изменялись во время architecture gate.

Primary local evidence:

```text
/tmp/scratchpad/users/architecture/users-activation-architecture-decision.md
/tmp/scratchpad/users/architecture/users-architecture.manifest.json
```

Не повторять architecture analysis. Реализация должна следовать проверенному
решению из указанных artifacts.

---

## 4. USERS Slice 1 — завершён

### 4.1 Prisma/auth foundation

**Статус:** COMPLETE.

Рабочая ветка:

```text
codex/users-auth-foundation
base: dev @ a2dd28a0eef93cf1cbb70dbae5132201b220879e
```

Обязательный scope Slice 1 определяется architecture decision и должен включать
только минимальную foundation для безопасного pending/activation flow.

- [x] Architecture decision отражён в schema/auth implementation и checklist.
- [x] Реализованы минимальные Prisma schema changes.
- [x] Создана reviewable Prisma migration без unrelated local drift.
- [x] Backfill не требуется: 15 существующих users сохранили status/hash.
- [x] Работоспособность 5 существующих sessions сохранена.
- [x] Реализована безопасная nullable-password/pending-state semantics.
- [x] Добавлены fail-closed gates в оба credentials login path, session creation и validation.
- [x] Activation token records и email в Slice 1 не создавались; schema table —
      отдельный следующий slice по architecture decision.
- [x] User migration runner не начинался.
- [x] Добавлены schema/auth unit и integration regressions.
- [x] Проверены registration, login, reset gate, phone-stub compatibility,
      admin/business access boundary.
- [x] `tsc --noEmit` PASS.
- [x] Production build PASS.
- [x] Adversarial auth/security review PASS.
- [x] PR #70 смержен в `dev`.

Local proof boundary:

```text
USERS Slice 1: COMPLETE
Prisma/auth foundation: implemented
local migration: applied; status UP TO DATE
existing users before/after: 15 / 15
existing sessions before/after: 5 / 5
UserActionToken records before/after: 0 / 0
pending createSession: DENIED
ACTIVE and LIMITED session policy: PASS
ACTIVE → PENDING session revocation: PASS
concurrent invalidation: PASS
pending password reset bypass: DENIED
activation endpoints: NOT STARTED
User migration: NOT STARTED
```

Slice 1 запрещено смешивать с:

- WordPress User CREATE;
- activation email delivery;
- profile media;
- full ownership transfer;
- Batch 1;
- production execution.

### 4.2 Следующие USERS slices

- [x] Slice 2 — activation token service: hash-only storage, purpose scope,
      TTL, single use, invalidation, concurrency safety.
- [x] Slice 3 — activation request/complete endpoints, generic public responses,
      rate limits, password setup and audit.
- [x] Slice 4 — User migration source/normalize/draft/validate/writer/lineage;
      local golden proof: two CREATE, one privileged BLOCKED, one common rerun.
- [x] Slice 5 — clean local User batch import: 562 CREATE + 2 existing golden
      SKIP_UNCHANGED; one rerun 564 SKIP_UNCHANGED.
- [ ] Business ownership access proof — separate later slice.
- [ ] Slice 7 — clean Batch 1 (20 records) + audit.
- [ ] Slice 8 — remaining clean users in sequential batches.
- [ ] Slice 9 — one common clean-scope idempotency rerun.
- [ ] Slice 10 — privileged/manual class H resolution policy/tooling.
- [ ] Profile media — отдельный later gate, не смешивать с first User proof.

Slice 2 proof boundary:

```text
USERS Slice 1: COMPLETE — merged via PR #70
USERS Slice 2: COMPLETE
token storage: SHA-256 hash only
raw token storage: none
purpose: MIGRATED_ACCOUNT_ACTIVATION
TTL: 60 minutes; expiresAt > now is valid, expiresAt <= now is expired
issuance eligibility: PENDING_ACTIVATION and deletedAt IS NULL only
unresolved: usedAt IS NULL and invalidatedAt IS NULL
concurrent issuance: one unresolved winner
atomic consumption: one winner; User eligibility included in conditional UPDATE
final proof fixtures: temporary only, cleaned
email delivery: NOT STARTED
activation endpoints: NOT STARTED
User migration: NOT STARTED
```

Slice 3 email safety policy:

```text
LOCAL: external email delivery forbidden
DEV: external email delivery forbidden
PRODUCTION: delivery only after explicit Go/No-Go and production-only flag
```

Slice 3 local proof:

```text
request endpoint: generic 202 for pending/unknown/ineligible
public response: no delivery status, token, hash, User id or internal state
request body: strict JSON, byte-limited, normalized email
client IP: trusted proxy headers only behind explicit TRUST_PROXY_HEADERS policy
complete endpoint: atomic passwordHash + ACTIVE + emailVerifiedAt + token usedAt
sibling tokens: invalidated
sessions: revoked
request/completion audit: recorded without raw token/password
rate limits: IP + normalized-email/token keys, fail closed
LOCAL/DEV external provider calls: 0; result DELIVERY_DISABLED
PRODUCTION gate: NODE_ENV + APP_ENV + enable flag + approval flag required;
all gates still return PROVIDER_UNAVAILABLE until a later provider review
external email provider integration/production delivery: NOT STARTED
WordPress User mass migration: NOT STARTED
mass email campaign: NOT STARTED
ownership/profile media: NOT STARTED
final cleanup: users 15, sessions 5, action tokens 0, pending 0,
activation audit fixtures 0, activation rate-limit rows 0, provider calls 0
```

USERS completion criteria:

```text
clean scope imported or explicitly dispositioned
no legacy password hashes imported
no automatic ADMIN grants
unique email/lineage proven
activation flow security proven
ownership access gated correctly
one common idempotency rerun passed
profile media handled by separate manifest/gate
```

---

## 5. Осталось до технического cutover

Ниже — обязательный P0 остаток в рекомендуемом порядке.

### 5.1 USERS + activation

- [x] Prisma/auth foundation.
- [x] Activation tokens and endpoints.
- [x] User migration vertical slice (local golden scope only).
- [ ] 564 clean users: batches + one common rerun.
- [ ] 15 privileged/manual users: explicit disposition, без auto ADMIN.
- [ ] Ownership access proof.
- [ ] User/profile media gate.

### 5.2 EVENTS

Текущий известный статус:

```text
eligible imported: 4/9
remaining CREATE: 5
pending materialized sessions: 67
```

- [ ] Проверить актуальный Docker/CI gate перед write.
- [ ] Final preview оставшихся eligible records.
- [ ] Sequential targeted commits.
- [ ] Session count validation.
- [ ] Common idempotency rerun.
- [ ] Public URL/city visibility verification.

Event images остаются excluded согласно frozen scope.

### 5.3 ROUTES

- [ ] Ручной review 14/14 импортированных маршрутов.
- [ ] Проверить stops, descriptions, images и city mappings.
- [ ] Publish approved routes.
- [ ] Slug history и redirect map.
- [ ] Public URL validation.

### 5.4 ARTICLE MEDIA

- [ ] ArticleMediaSyncer.
- [ ] Cover media manifest.
- [ ] Inline `wp-content/uploads` remap.
- [ ] Local FULL proof.
- [ ] Dev metadata-only policy proof.
- [ ] Production FULL manifest/gate.
- [ ] Storage and dedup audit.

### 5.5 PROFILES / OWNERSHIP / MEDIA

- [ ] User identity mapping завершить через USERS runner.
- [ ] Business/Organizer exact ownership links.
- [ ] User and Business avatars/logos.
- [ ] Неоднозначные profile posts → quarantine/ledger.
- [ ] Public profile content classification оставить P1, если не требуется P0.

### 5.6 REVIEWS

- [ ] Подтвердить точный approved source scope.
- [ ] Users + Places dependency gate.
- [ ] Review adapter/normalizer/draft/writer/lineage.
- [ ] Golden sample.
- [ ] Full small batch.
- [ ] Idempotency rerun.
- [ ] Public rating aggregates validation.

### 5.7 REDIRECTS / PAGES / SEO

- [ ] RankMath `exact` redirects subset.
- [ ] Все redirects на `/` вручную перемапить на релевантные hubs.
- [ ] Legal/about/contact mandatory pages.
- [ ] WordPress catch-all validation.
- [ ] Canonical/no-trailing-slash validation.
- [ ] City-scoped slugs and canonical URLs.
- [ ] Sitemap/robots/noindex launch gate.
- [ ] Redirect manifest minimum and collision audit.

`start`/`contains` redirects остаются P1 после conflict review.

### 5.8 PRODUCT REGRESSIONS — P0

- [ ] Event visibility and city discovery: созданное событие должно появляться
      в правильном городе, на нужной дате и не отдавать 404.
- [ ] Article admin/blog city visibility: опубликованная статья должна
      отображаться в блоге выбранного/default города.
- [ ] Полный smoke test auth, business cabinet, admin lifecycle и public pages.

Place phone E.164 issue уже исправлен.

### 5.9 RELEASE CANDIDATE / PRODUCTION

- [ ] Freeze source snapshot for production.
- [ ] Зафиксировать production migration manifests и checksums.
- [ ] Fresh production backup.
- [ ] Проверить restore procedure без destructive rehearsal на production.
- [ ] Full local rehearsal на production-like data.
- [ ] Dev metadata-only rehearsal.
- [ ] Cumulative DB/storage delta report.
- [ ] Forbidden tables/fields audit.
- [ ] Redirect and SEO validation report.
- [ ] Docker Build & Push на exact RC SHA — GREEN.
- [ ] Go/No-Go checklist.
- [ ] Sequential production migration.
- [ ] Post-migration validation.
- [ ] One allowed production idempotency rerun where explicitly planned.
- [ ] DNS/cutover/noindex switch.
- [ ] Monitoring and rollback decision window.

---

## 6. Что сознательно не входит в P0

- Past Events и их изображения.
- Event images.
- Noncanonical Offer class I.
- Offer class H без Place — до отдельного editorial/mapping решения.
- Full public profile content classification.
- RankMath `start`/`contains` redirects.
- Draft/unpublished long-tail content bulk publication.
- Historical bookings, WooCommerce/LatePoint и social feeds.
- Collections и редкие custom post types без отдельного business decision.

---

## 7. Текущий следующий шаг

```text
Phase: USERS — Slice 6 manual/privileged backlog and ownership planning
Branch: codex/users-manual-ownership-planning
Base SHA: 2e67adc7bfabbd1054f7fe1e125ea6c8bc3934e6
Source/architecture discovery: COMPLETE — не повторять
Slice 1: COMPLETE — PR #70 merged
Slice 2: COMPLETE — PR #71 merged
Slice 3: COMPLETE — PR #72 merged
Slice 4: COMPLETE — local golden proof
Slice 5: COMPLETE — 564/564 clean local scope + one common rerun
Slice 6: COMPLETE — read-only planning (this Draft PR)
Mass/production User writes: NOT STARTED
```

Следующее одно действие:

> После review и merge Slice 6 начать отдельный Slice 7 ownership vertical
> slice golden proof (первый реальный ownership/authorship write для одного
> golden-примера). Не начинать production writes, email delivery, bulk
> ownership transfer или media import.

---

## 8. Краткий handoff — 2026-07-23

- PR #69 переведён из Draft и смержен в `dev`.
- Merge SHA: `a2dd28a0eef93cf1cbb70dbae5132201b220879e`.
- OFFERS safe canonical: 63/63 COMPLETE.
- All-63 rerun: PASS.
- OFFERS production/media: не выполнялись.
- USERS immutable snapshot и planning: COMPLETE.
- USERS activation architecture: COMPLETE.
- Architecture decision: `READY_FOR_PRISMA_AUTH_FOUNDATION_IMPLEMENTATION`.
- Новая ветка: `codex/users-auth-foundation`.
- USERS Slice 1 Prisma/auth foundation: COMPLETE, local proof PASS.
- PR #70 merge commit: `76504ef15781927d27dafcce6863609f52ccfdfc`.
- Existing users/sessions at proof boundary: 15 / 5; action tokens: 0.
- USERS Slice 2 token service: COMPLETE — merged via PR #71.
- Token policy: SHA-256 hash of 32 random bytes, 60-minute TTL, purpose scope,
  invalidation and atomic one-time consume.
- Final proof fixtures cleaned: users 15, sessions 5, action tokens 0, pending 0.
- Future email policy: LOCAL/DEV external delivery forbidden; PRODUCTION only
  after explicit Go/No-Go and a production-only flag.
- PR #71 merge commit: `289ec055baa908258a5957292593a9313ca6eafa`.
- USERS Slice 3 activation request/complete endpoints: COMPLETE — PR #72 merged,
  merge SHA `82350ade626ae09968a8e1b30a51e9f46db47432`;
  external provider integration and production delivery remain NOT STARTED.
- USERS Slice 4 local golden vertical slice: COMPLETE.
- `wordpress-db:user:7`: CREATE, rerun SKIP_UNCHANGED.
- `wordpress-db:user:38`: CREATE as role USER, rerun SKIP_UNCHANGED;
  business ownership deferred.
- `wordpress-db:user:1`: BLOCKED / PRIVILEGED_ACCOUNT_COLLISION on both runs;
  privileged account fingerprint unchanged.
- Migrated security defaults: PENDING_ACTIVATION, passwordHash null,
  emailVerifiedAt null, role USER; sessions/action tokens/provider calls 0.
- Golden cumulative delta: Users +2, MigrationLineage +2,
  MigrationRecord +6 (three first-run attempts + three rerun attempts);
  Business/Place/Offer/MediaAsset 0.
- Full/mass/production User migration, external email delivery, ownership and
  profile media: NOT STARTED.
- USERS Slice 5 clean local batch: COMPLETE.
- Clean scope: 564; manual/privileged excluded: 15; imported manual: 0.
- First run: CREATE 562, SKIP_UNCHANGED 2, BLOCKED 0, ERROR 0.
- Exactly one common rerun: SKIP_UNCHANGED 564; additional reruns 0.
- Slice 5 deltas: Users +562, MigrationLineage +562,
  MigrationRecord +1128; Session/UserActionToken/Business/Place/Offer/
  Article/Route/MediaAsset 0.
- All 564 migrated Users remain PENDING_ACTIVATION with passwordHash null,
  emailVerifiedAt null and role USER; emails/provider calls 0.
- Production User migration, production email delivery, ownership transfer and
  profile media: NOT STARTED.
- В этой docs-операции DB, WordPress, storage, media и network writes не
  выполнялись.

```text
USERS Slice 6: COMPLETE — read-only planning

manual/privileged:
  source users: 15
  imported: 0
  automatic mutations: 0
  backlog manifest: created
  manual decisions: required

business ownership:
  business-linked users: 38
  ownership writes: 0
  role changes: 0
  planning manifest: created

content authorship:
  content-author users: 12
  authorship writes: 0
  planning manifest: created

email delivery: 0
provider calls: 0
profile media: NOT STARTED
production User migration: NOT STARTED
```

- USERS Slice 6 manual/privileged backlog and ownership planning: COMPLETE —
  полностью read-only; analyzer использует read-only Prisma-расширение,
  блокирующее любые write-операции и `$executeRaw*` до обращения к БД, плюс
  узкий read-only repository interface без write-методов.
- Manual/privileged backlog: 15/15 sourceRecordKey, дубликаты и пропуски
  запрещены типами; `wordpress-db:user:1` присутствует,
  imported/lineage: NO, recommendedDisposition `KEEP_EXISTING_TARGET_UNCHANGED`
  (existing ADMIN target), automaticRoleChange `FORBIDDEN`.
- Manual dispositions: KEEP_EXISTING_TARGET_UNCHANGED 1,
  MANUAL_LINK_AFTER_IDENTITY_VERIFICATION 0, MANUAL_CREATE_PENDING_ACCOUNT 0,
  EXCLUDE_FROM_MIGRATION 9, REQUIRES_FOUNDER_DECISION 5 (сумма 15).
- Business ownership plan (38 users, сопоставление только через точную
  `MigrationLineage`): reconciled User lineages 38/38; exact candidates 36;
  already satisfied 0; missing target 0; conflicts 0; ambiguous/manual 2
  (partial Place-lineage coverage); unsupported 0. Ownership writes 0,
  role changes 0.
- Content authorship plan (12 users): reconciled User lineages 12/12; exact
  candidates 0; already satisfied 0; missing target 10; conflicts 1
  (Activity.ownerUserId уже указывает на другого пользователя — required,
  non-null поле); ambiguous/manual 1 (partial Article/Route coverage);
  unsupported 0. Authorship writes 0.
- Sanitised manifests: `docs/migration/manual-user-backlog.json`,
  `docs/migration/business-ownership-plan.json`,
  `docs/migration/content-authorship-plan.json`; canonical (order/timestamp/
  path-independent) SHA-256 hashes recorded in
  `docs/migration/users-slice6-planning-proof.json`.
- No-write proof: User/Session/UserActionToken/Business/Place/Offer/Article/
  Route/Activity/MediaAsset/MigrationLineage/MigrationRecord delta 0;
  ownership/authorship relation hash unchanged; role/status distribution hash
  unchanged; passwordHash/emailVerifiedAt non-null counts delta 0.
- Adversarial review (17 сценариев): дефектов не найдено, batch-исправлений
  не потребовалось.
- Email delivery, provider calls, profile media import, production User
  migration: NOT STARTED.
