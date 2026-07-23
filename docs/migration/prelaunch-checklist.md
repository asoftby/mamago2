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
| Users ownership golden proof | GOLDEN PROOF COMPLETE | Slice 7: 1/38 Business+Place link written; remaining 35, role elevation, media NOT STARTED |
| Users ownership batch write | 36/38 EXACT CANDIDATES WRITTEN | Slice 8: 35 more written; 2 partial-lineage (89, 130) + role elevation NOT STARTED |
| Users role elevation golden proof | GOLDEN PROOF COMPLETE | Slice 9: 1/36 USER->BUSINESS_OWNER written; remaining 35 role elevations NOT STARTED |
| Users role elevation batch | 36/36 ELIGIBLE OWNERS ELEVATED | Slice 10: all remaining 35 elevated; users 89/130 + authorship/media/email NOT STARTED |
| Users business-linked tail reconciliation | READ-ONLY FINDINGS COMPLETE | Slice 11: both 89/130 = TARGET_PLACE_NOT_MIGRATED (draft/unpublished scope), no writes |
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
Phase: USERS — Slice 11 targeted read-only reconciliation (users 89/130)
Branch: codex/users-business-linked-tail-reconciliation
Base SHA: f2004de9b669c33c4b59981660dd62d42b61d626 (dev, PR #79 merged)
Source/architecture discovery: COMPLETE — не повторять
Slice 1: COMPLETE — PR #70 merged
Slice 2: COMPLETE — PR #71 merged
Slice 3: COMPLETE — PR #72 merged
Slice 4: COMPLETE — local golden proof
Slice 5: COMPLETE — 564/564 clean local scope + one common rerun
Slice 6: COMPLETE — read-only planning, merged via PR #75
Slice 7: COMPLETE — 1/38 business-ownership golden write + rerun proof, merged via PR #76
Slice 8: COMPLETE — 35/38 more business-ownership writes (36/38 total) + rerun proof, merged via PR #77
Slice 9: COMPLETE — 1/36 USER->BUSINESS_OWNER golden role elevation + rerun proof, merged via PR #78
Slice 10: COMPLETE — remaining 35 role elevations (36/36 total) + rerun proof, merged via PR #79
Slice 11: COMPLETE — read-only reconciliation: both 89/130 = TARGET_PLACE_NOT_MIGRATED, 0 writes
Mass/production User writes: NOT STARTED
```

Следующее одно действие:

> После review и merge Slice 11 решить отдельно: (a) расширить Place
> migration scope на draft/unpublished content для users 89/130 (отдельное
> product-решение, ранее уже помечено вне текущего scope), или (b) начать
> content authorship planning->write vertical slice (12 users). Не
> начинать production writes, email delivery, Place migration scope
> expansion, content authorship writes или media import без отдельного
> явного разрешения.

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

## 9. Краткий handoff — 2026-07-23 (Slice 7)

```text
USERS Slice 7: COMPLETE — ownership vertical slice golden proof

golden candidate: wordpress-db:user:38 (1 of 38 business-linked users)
selection: single exact Place, no conflict, no partial lineage
first run: CREATE — Business +1, Place ownership linked, BUSINESS lineage +1
rerun: SKIP_UNCHANGED — zero further mutation
role changes: 0 (target User stays role=USER, status=PENDING_ACTIVATION)

deferred:
  remaining exact candidates: 35
  partial-lineage candidates: wordpress-db:user:89, wordpress-db:user:130
  manual/privileged users: 15
  content authorship: 12
  role elevation USER -> BUSINESS_OWNER: NOT STARTED
  profile media, activation/email delivery: NOT STARTED
```

- USERS Slice 7 ownership vertical slice golden proof: COMPLETE — first
  DB-write slice of the ownership workstream, scoped to exactly one of the
  36 `EXACT_LINK_CANDIDATE` entries from Slice 6's plan
  (`docs/migration/business-ownership-plan.json`), chosen by explicit
  criteria: single unambiguous owned Place, full lineage coverage, no
  existing Business conflict.
- New module `src/lib/migration/commit/business-ownership/
  BusinessOwnershipGoldenRunner.ts`: atomic (Serializable) transaction —
  create `Business` for the migrated User, link `Place.ownerBusinessId`,
  write `MigrationLineage` (targetType `BUSINESS`) and `MigrationRecord`
  bookkeeping. Every precondition (User/Place lineage active, Place
  currently unowned, User has no existing Business, User role still
  `USER`) is re-verified from a fresh read inside the transaction, not
  trusted from the outer plan.
- The golden candidate (`wordpress-db:user:38`) is hardcoded in
  `scripts/migration-business-ownership-golden.ts` rather than accepted as
  a CLI argument, so the script cannot be pointed at any other candidate,
  the manual/privileged backlog, content authorship, or role elevation —
  all of those remain out of scope for this slice.
- First run: `CREATE` — deltas: Business +1, MigrationLineage +1,
  MigrationRecord +1; User/Session/UserActionToken/Place/Offer/Article/
  Route/Activity/MediaAsset counts and the User role/status distribution
  hash unchanged; target User role/status/passwordHash/emailVerifiedAt
  unchanged.
- Rerun: `SKIP_UNCHANGED` — identical Business id returned, zero further
  writes.
- Role is intentionally left at `USER` — Slice 6 already separated the
  ownership action from the role recommendation
  (`ELIGIBLE_FOR_BUSINESS_OWNER_AFTER_OWNERSHIP_WRITE`); the actual
  `USER → BUSINESS_OWNER` elevation is deferred to its own future slice
  with independent authorization, rollback, and idempotency proof.
- Remaining 35 exact candidates, the 2 partial-lineage cases (users 89,
  130), all 15 manual/privileged users, all 12 content-author users,
  profile media, and activation/email delivery: NOT STARTED.

## 10. Краткий handoff — 2026-07-23 (Slice 8)

```text
USERS Slice 8: COMPLETE — business ownership batch write

scope: remaining 35 EXACT_LINK_CANDIDATE (36 total minus user:38, done in Slice 7)
excluded: users 89/130 (partial lineage), manual/privileged (15), content authorship (12)
mode: sequential, stop-on-first-error, no batching/retry/rollback

first run: 35/35 CREATE — Business +35, Place ownership linked x35,
           BUSINESS lineage +35, MigrationRecord +35, per-step audit clean
rerun:     35/35 SKIP_UNCHANGED — zero further writes
role changes: 0 (all 35 owners remain role=USER)

combined ownership progress: 36/38 business-linked users written
remaining: wordpress-db:user:89, wordpress-db:user:130 (manual review)
```

- USERS Slice 8 business ownership batch write: COMPLETE — reused the
  exact Slice 7 write path (`BusinessOwnershipGoldenRunner`) per candidate
  via a new sequential `BusinessOwnershipBatchRunner`, with no relaxed
  guards and no new write logic. The batch manifest is rebuilt live from
  the immutable snapshot + current DB state (reusing the tested Slice 6
  `planBusinessOwnership` reconciliation) rather than trusted from the
  static committed plan file, so it naturally excludes anything already
  written or reclassified since Slice 6.
- First run: 35/35 `CREATE`, 0 `BLOCKED`, `stoppedEarly: false`. Deltas:
  Business +35, MigrationLineage +35, MigrationRecord +35;
  User/Session/UserActionToken/Place/Offer/Article/Route/Activity/
  MediaAsset counts and the User role/status distribution hash: unchanged.
  A per-step audit callback re-verified these invariants after every
  single candidate, not just at the end.
- Rerun proof: re-processing the same fixed 35-candidate list (bypassing
  the live "already satisfied" filter, which — correctly — excludes
  completed work from the production CLI's own manifest) confirms all 35
  now resolve to `SKIP_UNCHANGED` with zero further writes.
- Role stays `USER` for all 35 owners — verified individually, not just by
  an aggregate distribution hash.
- Combined ownership progress: 36 of the 38 business-linked users now have
  a real Business + Place link (1 from Slice 7, 35 from Slice 8). The
  remaining 2 (`wordpress-db:user:89`, `wordpress-db:user:130`) stay
  deferred — partial Place-lineage coverage, requires manual review, not a
  batch write.
- Adversarial note: an earlier draft of the batch integration test wrote
  its fixtures under the shared production `MigrationSource`
  (`users-immutable-snapshot`) instead of an isolated per-test namespace,
  leaking 4 orphaned `MigrationRecord`/`MigrationRun` rows into real
  migration bookkeeping (caught before this PR, before any push). Fixed by
  isolating the test under its own namespace (mirroring the Slice 7
  integration test's convention) and deleting the 4 leaked rows; verified
  DB state returned to the exact expected baseline before proceeding.
- Role elevation `USER → BUSINESS_OWNER`, the 2 partial-lineage cases,
  manual/privileged users (15), content authorship (12), profile media,
  and activation/email delivery: NOT STARTED.

## 11. Краткий handoff — 2026-07-23 (Slice 9)

```text
USERS Slice 9: COMPLETE — BUSINESS_OWNER role elevation golden proof

candidate: wordpress-db:user:38 (Business+Place link written in Slice 7)
prerequisites verified: User lineage, Business lineage, Business.ownerUserId
                         match, >=1 Place linked via ownerBusinessId

first run: ELEVATE — role USER -> BUSINESS_OWNER (only field changed)
rerun:     SKIP_UNCHANGED — zero further mutation

untouched, verified byte-for-byte: status (PENDING_ACTIVATION), passwordHash,
  emailVerifiedAt, email, Business row, Place.ownerBusinessId, sessions (0),
  action tokens (0)
all table counts: 0 delta (no new MigrationLineage/MigrationRecord —
  role elevation is a single-field mutation of an already-migrated User,
  not a new migrated entity)

deferred: remaining 35 role elevations, users 89/130, manual/privileged (15),
          authorship (12), media, activation/email
```

- USERS Slice 9 BUSINESS_OWNER role elevation golden proof: COMPLETE —
  first privilege-elevation write in the ownership workstream, scoped to
  exactly one candidate (`wordpress-db:user:38`), the same User whose
  Business + Place ownership link was written in Slice 7.
- New module `src/lib/migration/commit/business-ownership/
  RoleElevationGoldenRunner.ts`: guards on the User/Business
  `MigrationLineage` already existing, `Business.ownerUserId` matching the
  target User, and at least one `Place` already linked via
  `ownerBusinessId` — i.e. this slice only ever elevates a User whose
  ownership was already proven by a prior migration write, never based on
  title/name/similarity. The write itself changes exactly one field
  (`User.role`) inside an atomic, serializable transaction that
  re-verifies every precondition from a fresh read first.
- The golden candidate is hardcoded in
  `scripts/migration-role-elevation-golden.ts` rather than accepted as a
  CLI argument, so the script cannot be pointed at any of the other 35
  newly-owned Businesses or any other User.
- First run: `ELEVATE` — `role: USER -> BUSINESS_OWNER`. Verified
  byte-for-byte unchanged: `status` (`PENDING_ACTIVATION`), `passwordHash`,
  `emailVerifiedAt`, `email`, the entire `Business` row, `Place.
  ownerBusinessId`, sessions (0), action tokens (0). All twelve tracked
  entity counts (User, Session, UserActionToken, Business, Place, Offer,
  Article, Route, Activity, MediaAsset, MigrationLineage, MigrationRecord)
  show a delta of 0 — role elevation intentionally creates no new
  migration bookkeeping, since it mutates an already-migrated User rather
  than migrating a new entity.
- Rerun: `SKIP_UNCHANGED` — zero further mutation.
- Remaining 35 role elevations (for the Businesses written in Slice 8),
  the 2 partial-lineage cases, manual/privileged users (15), content
  authorship (12), profile media, and activation/email delivery:
  NOT STARTED.

## 12. Краткий handoff — 2026-07-23 (Slice 10)

```text
USERS Slice 10: COMPLETE — BUSINESS_OWNER batch role elevation

scope: remaining 35 Users with proven Business+Place ownership link
        (Slices 7/8), excluding wordpress-db:user:38 (Slice 9)
excluded: users 89/130 (partial lineage), manual/privileged (15), content authorship (12)
mode: sequential, stop-on-first-error, no batching/retry/rollback
manifest: live query of active BUSINESS MigrationLineage — no snapshot read needed

first run: 35/35 ELEVATE — role changed USER -> BUSINESS_OWNER, per-step audit clean
rerun:     35/35 SKIP_UNCHANGED — zero further writes

field-level proof: Business rows and Place ownership byte-for-byte
  unchanged (content hash match); all 36 business owners (1 Slice 9 + 35
  Slice 10) verified role=BUSINESS_OWNER, status=PENDING_ACTIVATION,
  passwordHash null, emailVerifiedAt null, 0 sessions, 0 action tokens
all 12 tracked table counts: 0 delta

combined role elevation progress: 36/36 eligible Business owners elevated
```

- USERS Slice 10 BUSINESS_OWNER batch role elevation: COMPLETE — reused
  the exact Slice 9 write path (`RoleElevationGoldenRunner`) per
  candidate via a new sequential `RoleElevationBatchRunner`, with no
  relaxed guards and no new write logic. The batch manifest is built live
  from active `BUSINESS` `MigrationLineage` rows (no snapshot read
  needed) — role eligibility is fully determined by lineage + User state
  already in the DB.
- First run: 35/35 `ELEVATE`, 0 `BLOCKED`, `stoppedEarly: false`. A
  per-step audit callback re-verified after every single candidate that
  every table except `User` stayed exactly flat.
- Rerun: 35/35 `SKIP_UNCHANGED`, zero further writes.
- Field-level proof (not just aggregate counts): a content hash of all 39
  `Business` rows and their linked `Place` rows was taken before and
  after the batch and found identical; all 36 Users who now own a
  Business (1 from Slice 9, 35 from Slice 10) were individually verified
  to have `role=BUSINESS_OWNER`, `status=PENDING_ACTIVATION`,
  `passwordHash=null`, `emailVerifiedAt=null`, 0 sessions, 0 action
  tokens.
- Combined role elevation progress: all 36 Users with a proven
  Business+Place ownership link now hold `BUSINESS_OWNER`. The 2
  partial-lineage cases (`wordpress-db:user:89`, `wordpress-db:user:130`)
  never got a Business in the first place, so they are not part of this
  count and remain deferred pending manual review.
- Manual/privileged users (15), content authorship (12), profile media,
  and activation/email delivery: NOT STARTED.

## 13. Краткий handoff — 2026-07-24 (Slice 11)

```text
USERS Slice 11: COMPLETE — read-only reconciliation for users 89/130

wordpress-db:user:89:  214 owned Places, 19 migrated, 195 missing
                        missing breakdown: unpublished 187, draft 8
                        migrated subset: 0 conflicts
                        verdict: TARGET_PLACE_NOT_MIGRATED

wordpress-db:user:130: 2 owned Places, 1 migrated, 1 missing (draft)
                        migrated subset: 0 conflicts
                        verdict: TARGET_PLACE_NOT_MIGRATED

root cause (both): Place migration to date has only imported publish-status
  Places (82/83 migrated Places = exactly the 82 publish-status Places in
  the source snapshot). Draft/unpublished content is an already-documented
  scope exclusion (checklist section 6), not a migration bug. No missing
  Place was ever attempted (0 MigrationRecord history) — never
  attempted-and-failed.

database writes: 0
```

- USERS Slice 11 targeted read-only reconciliation: COMPLETE — new
  read-only module `src/lib/migration/planning/business-linked-tail/`
  investigates exactly the 2 business-linked users excluded from Slice
  7/8's exact-candidate batch, reusing the Slice 6 read-only Prisma
  extension guard (no write method reachable, enforced before any DB
  call).
- Every owned Place is resolved through its exact
  `MigrationLineage.sourceRecordKey` — no title/slug/name/email
  similarity used anywhere. "Already attempted" is read from real
  `MigrationRecord` history, not inferred.
- Root cause for both users: 100% of missing Place coverage is
  attributable to WordPress `post_status` (`unpublished`/`draft`) —
  confirmed against the immutable snapshot's own `content_authorship`
  section, cross-checked against the live DB (82/83 migrated Places
  match exactly the 82 `publish`-status Places in the source). This is
  the same draft/unpublished exclusion already documented as out of
  scope elsewhere in this checklist, not a new problem.
- Both users classified `TARGET_PLACE_NOT_MIGRATED`: no ambiguity, no
  conflict — the already-migrated subset (19 Places for user 89, 1 for
  user 130) has zero existing ownership conflicts.
- No action taken on either user — this slice is read-only investigation
  only. Two options remain for a future, separately-authorized slice:
  extend Place migration scope to draft/unpublished content, or write
  partial ownership using only the already-migrated subset. Both are
  product decisions, not made by this analyzer.
- Database writes: 0 (verified before/after counts and role/status
  distribution hash identical).
- Content authorship (12), manual/privileged users (15), profile media,
  and activation/email delivery: NOT STARTED.
