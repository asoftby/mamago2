# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

**Обновлено:** 2026-07-28  
**Base:** `dev` @ `c8a3f9aa0c2940aeb57dc5fb015937630f407036` — PR #89 merged  
**Текущая фаза:** `USERS — dispositions + full activation flow (login detection, /activate, delivery audit) COMPLETE; EVENTS tail next`  
**Текущий кандидат для следующего шага:** 5 remaining Events + 67 pending sessions  
**Текущий gate:** `USERS_ACTIVATION_PRODUCT_COMPLETE`

> Подробная история Slices 1–18 сохранена в Git и профильных proof-документах.
> Этот файл содержит только актуальное состояние, обязательные gates и критический
> путь до запуска.

---

## 1. Неподвижные правила

1. Перед Prisma/auth/migration работой читать `CLAUDE.md` и профильные runbooks.
2. Запрещены `prisma migrate dev`, `prisma db push`, reset и destructive cleanup.
3. WordPress — строго read-only source. Production writes разрешаются только отдельным Go/No-Go.
4. Для каждой новой сущности: один environment gate, один SSH probe и один агрегированный immutable capture.
5. После source capture дальнейшие inventory/classification/planning выполняются локально.
6. Первый полный write-run каждой сущности — последовательный, `stop-on-first-error`, без автоматических retry, cleanup и rollback записанного prefix.
7. Snapshot, fixed manifest, canonical hashes и expected actions фиксируются до первого write.
8. Writes используют exact lineage/sourceRecordKey, CAS/conditional updates и fail-closed guards.
9. После batch обязателен cumulative DB/storage audit и один общий idempotency rerun.
10. Аномалии не исправляются внутри clean batch: они переносятся в documented backlog.
11. Media выполняются только по заранее подготовленному manifest и отдельному gate.
12. Один связный vertical slice → одна ветка → один Draft PR → один adversarial review → один fix batch → финальный CI/review cycle.
13. Production разрешён только после local golden, local batch, idempotency proof, rehearsal и Go/No-Go.
14. Raw immutable snapshots запрещено хранить только в `/tmp`. Source-of-truth хранится в приватном non-Git пути:

```text
/Users/shapovalovalexey/.mamago2/migration-snapshots/<entity>/
```

Permissions: `0700` для директорий, `0600` для файлов. Raw snapshots в Git не коммитятся.

15. Тесты не зависят от `/tmp` или приватных home-directory snapshots: только committed sanitized fixtures либо self-generated temporary fixtures.
16. Content-bearing entities (Article/Place/Event/Route/Offer) не могут быть полностью смигрированы из lightweight dependency-snapshot'ов — их SSH-based vertical slice (exact `--source-record-key`, один exact-key read) остаётся единственным источником `title`/`content`/postmeta/terms и разрешён без отдельного нового "snapshot capture" gate.

---

## 2. Текущий прогресс

| Трек | Статус | Что остаётся |
| --- | --- | --- |
| Migration engine | COMPLETE | Regression и production validation |
| Places | CORE COMPLETE | Media, production validation, public/city audit |
| Offers | LOCAL SAFE SCOPE COMPLETE 63/63 | Production execution, media, backlog H/I |
| Routes | IMPORTED 14/14 | Review, publish, slug history, redirects, public validation |
| Events | PARTIAL 4/9 | 5 CREATE, 67 sessions, rerun, city/date/URL validation |
| Users clean migration | LOCAL COMPLETE 564/564 | Production import и activation delivery |
| Users activation architecture | **PRODUCT-COMPLETE** | Login detection, `/activate` page, delivery audit persistence все реализованы и протестированы; real bulk send остаётся gated финальным Go/No-Go (см. §5.2) |
| Business-linked Users | **FULLY CLOSED** | 38/38 ownership, 38/38 `BUSINESS_OWNER`, backlog 0 |
| Users manual/privileged | **COMPLETE 14/14** | 1 existing ADMIN unchanged, 13 `USER`, 1 `BUSINESS_OWNER` (user:129, exact 9-Place ownership); rerun 14×`SKIP_UNCHANGED`, 0 deltas |
| Activities | P0 CLOSED | 63 expired Events → `P1_HISTORICAL_EXPIRED_ACTIVITY` |
| Content authorship | SLICE 18 COMPLETE 1/2 | `post:56250` migrated (`authorUserId: null`); Slice 19 migrates `post:57731`, затем authorship reconciliation/write |
| User/Business profile media | NOT STARTED | P0/P1 decision, manifest, proof, production gate |
| Article media | NOT STARTED | Cover + inline remap, storage/dedup proof |
| Reviews | NOT STARTED | Реализовать либо явно defer в P1 |
| Redirects/pages/SEO | PARTIAL | Exact redirects, pages, canonical/sitemap/robots/noindex audit |
| Product regressions | PARTIAL | Event discovery/404, Article city visibility, full smoke |
| RC / production cutover | NOT STARTED | Freeze, backup, rehearsal, Go/No-Go, production migration, DNS |

---

## 3. Завершено и не должно повторяться

### 3.1 Migration foundation

- [x] `MigrationRun`, `MigrationRecord`, `MigrationLineage`.
- [x] Canonical hashes, unique lineage, idempotent classification.
- [x] Local/dev/prod profiles и production cutover runbook.
- [x] Sequential first-write safety, CAS/conditional updates, no auto cleanup.

### 3.2 Offers

- [x] Source inventory: 99 published records.
- [x] Canonical scope: 91; safe canonical scope: 63.
- [x] Full source → normalize → draft → validate → write → lineage flow.
- [x] Local import: 63/63.
- [x] Common rerun: `63 SKIP_UNCHANGED`.
- [x] Duplicate Offer/lineage и forbidden-table deltas: 0.

Deferred:

```text
class H: 28 — missing required Place relation
class I: 8 — noncanonical alias
Offer media: separate gate
production Offer execution: not started
```

### 3.3 Users identity and activation foundation

- [x] 579 source Users planned; legacy password hashes excluded.
- [x] Automatic ADMIN inheritance forbidden.
- [x] Pending-activation Prisma/auth foundation.
- [x] Hash-only activation token service.
- [x] Activation request/complete endpoints and security proofs.
- [x] Clean local scope: 564/564.
- [x] Common rerun: 564 `SKIP_UNCHANGED`.
- [x] Migrated Users remain `PENDING_ACTIVATION`, without password/session/token/provider writes.

### 3.4a Users manual/privileged — founder-final disposition, fully closed

Founder rule (final, overrides all prior manual/privileged dispositions that
excluded or deferred purely on legacy WordPress role): Administrator/
Editor/Author capabilities are never inherited; the only kept ADMIN is the
existing founder account; every other legacy user migrates as `USER` unless
a fresh, exact, proven Place ownership resolves `BUSINESS_OWNER`.

```text
kept unchanged:     wordpress-db:user:1 (existing ADMIN, no lineage, untouched)
                    wordpress-db:user:521, wordpress-db:user:91 (already USER/PENDING_ACTIVATION)
migrated:           14/14 — wordpress-db:user:{4,6,14,16,21,27,51,52,108,123,129,134,438,439}
new snapshot:       bounded, exact-key, read-only WP capture (14 users only) —
                    the original 579-user raw snapshot is lost (see §3.7);
                    fixed manifest: docs/migration/users-manual-privileged-14-manifest.json
role outcome:       13 × USER/PENDING_ACTIVATION; 1 × BUSINESS_OWNER (user:129)
ownership evidence: only user:129 had published `places` authorship (9 posts,
                    all exact, full lineage coverage) — reused the existing
                    Slice 7/9 golden mechanisms unmodified
                    (planBusinessOwnershipGolden/writeBusinessOwnershipGolden,
                    planRoleElevationGolden/writeRoleElevationGolden)
first run deltas:   User +14, Business +1, MigrationLineage +15, MigrationRecord +15,
                    ADMIN +0, Session +0, UserActionToken +0, Place row count +0
                    (existing Place rows re-owned, none created/deleted)
rerun:              14 × SKIP_UNCHANGED; ownership/role re-check: 0 deltas everywhere
```

- [x] No legacy WordPress role ever consulted for classification or exclusion.
- [x] `wordpress-db:user:1` left with zero lineage, zero writes — founder's
      real ADMIN account (`asoftby@gmail.com`) untouched.
- [x] No password, session, token, or activation email ever written.
- [x] No content authorship touched in this slice.

### 3.4 Business-linked Users — fully closed

```text
Business ownership:       38/38 COMPLETE
BUSINESS_OWNER elevation: 38/38 COMPLETE
Business-linked backlog:  0
Excluded draft/unpublished Places: untouched
```

Slices 6–14 закрыли planning, golden/batch ownership, partial-coverage users 89/130 и role elevation.

### 3.5 Authorship and Activity decisions

- [x] Slice 15: 12 content-author users reconciled read-only.
- [x] Slice 16: standalone durable Activity snapshot and dependency inventory.
- [x] Все 63 authored Events у 9 пользователей имеют `post_status=expired`.
- [x] Product decision: не расширять launch P0 на historical expired Events.
- [x] Эти 63 Events и связанная authorship классифицированы как `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- [x] `user:521` остаётся manual existing-author conflict.
- [x] `user:91` остаётся partial-lineage backlog.

### 3.6 Slice 17 — published Articles user:575

PR #88 merged, merge SHA `7ce3c8cadc71ccbd166a82ef2190bc02609c9507`.

```text
wordpress-db:post:56250  publish  ARTICLE_TARGET_NOT_MIGRATED
wordpress-db:post:57731  publish  ARTICLE_TARGET_NOT_MIGRATED
User lineage user:575:   active
Article lineage:         absent for both
MigrationRecord history: absent for both
Decision:                ARTICLE_GOLDEN_REQUIRED
Golden candidate:        wordpress-db:post:56250
```

- [x] Count gate: ровно 2 published Articles.
- [x] Durable Activity snapshot и committed Slice 16 manifest совпали.
- [x] Read-only proof, DB/storage/media/author writes: 0.
- [x] 28 autonomous tests; targeted planning regression: 86/86.
- [x] Canonical manifest hash: `833e67d396300bd42d67a7218a0340770b7ff9544b68535d90e453c036710b8b`.

### 3.7 Документированный test debt

- [x] Три ранее snapshot-dependent test files переведены на autonomous fixtures.
- [x] Full migration suite sequential: 155 pass, 2 skipped, 0 fail на границе PR #87.
- [ ] Два `UserCleanBatch.test.ts` остаются explicit skip: требуют утерянный полный 579-user raw snapshot и production invariant hash.
- [ ] Не перезахватывать USERS snapshot только ради этих тестов.

### 3.8 Slice 18 — Article golden migration (post:56250)

```text
candidate:        wordpress-db:post:56250
source gap:       Slice 16 snapshot has no post_content/title/excerpt;
                  no JSON-fixture path exists for Article (only Place has one)
authorized fix:   one scoped, exact-key, read-only SSH fetch via the
                  already-existing fetchPublishedArticleEnvelopeBySourceRecordKey
                  (same mechanism every Article import already uses)
first run:        LINKED (CREATE) — Article +1 (24->25), ARTICLE lineage +1
                  (910->911), MigrationRecord +1, media writes: 0
rerun:            SKIPPED — byte-identical, 0 duplicate lineage,
                  MigrationRecord +1 (fresh bookkeeping row, not a re-CREATE)
written Article:  status PENDING, cityId null, geoScope null,
                  coverImageId null, authorUserId null
```

- [x] Preconditions verified: exact source key, `publish` status, active
      User lineage, no prior Article lineage/MigrationRecord, no slug
      collision.
- [x] Zero new code — reused `migration-commit-wordpress-db.ts --entity
      article` unchanged; `ArticleCommitContext.authorUserId` was
      available but deliberately left unset (authorship stays a
      separate, later-authorized step — Slice 20/21).
- [x] Full 12-table before/after audit: only `Article`/`MigrationLineage`/
      `MigrationRecord` moved; User/Session/UserActionToken/Business/
      Place/Offer/Route/Activity/MediaAsset unchanged.
- [x] Not publicly visible yet — no city/geo scope assigned (out of
      scope for this MVP writer, same as every other entity's first
      golden write).

### 3.9 Users production activation readiness (email delivery)

No production email sent. Reused 100% of the existing foundation (request/
complete endpoints, hash-only `UserActionToken`, pending-activation
lifecycle, rate limiting, `activationEmailGate.ts`'s env gate) — no second
activation flow.

```text
provider:          Resend, via existing emailService — new adapter is
                   src/server/auth/activationEmailDelivery.ts
                   (deliverMigratedAccountActivationEmail), wired into
                   POST /api/auth/activation/request (previously discarded
                   both the issued raw token and the gate result)
gate:              resolveActivationEmailDelivery() — renamed its
                   always-returned "PROVIDER_UNAVAILABLE" placeholder to
                   "DELIVERY_ALLOWED" now that a provider exists; requires
                   NODE_ENV=production AND APP_ENV=production AND
                   MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=true AND
                   MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=true
kill switch:       either flag back to false, effective next request
manifest:          578/578 eligible, 0 exclusions, hash
                   56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1
                   (docs/migration/users-production-activation-manifest.json)
rehearsal:         fake/sandbox transport + injected gate-environment —
                   proved LOCAL/DEV hard-disable (incl. against this shell's
                   real env), production-approved send path, token secrecy,
                   one-time-use, expiry, invalid token, already-activated
                   rejection, rate limiting, ADMIN/roles untouched; 0 real
                   sends, 0 DB residue after cleanup
tests:             existing userActionToken.service.integration.test.ts +
                   activationEndpoints.integration.test.ts re-run unchanged
                   (both pass; one string literal updated for the gate
                   rename); new activationEmailDelivery.rehearsal.test.ts
tsc --noEmit:      clean
```

- [x] No password/session/token/provider write in this pass.
- [x] `ADMIN` count and every migrated User's role confirmed unchanged.

### 3.9a Migrated-user login detection, `/activate` page, delivery audit — product-complete

Closed all three remaining product blockers from §3.9. No commit/push.

```text
login detection:   src/app/api/auth/login/route.ts — after the existing
                   constant-time verifyLoginPassword() call (never skipped,
                   preserves timing safety: a PENDING_ACTIVATION account
                   costs exactly as much time as wrong-password/unknown-
                   email), a PENDING_ACTIVATION account with isValid=false
                   triggers requestMigratedAccountActivationByEmail(source:
                   LOGIN_FLOW) and returns 200 {pendingActivation:true,
                   message} instead of the generic 401. Zero visual/field/
                   button changes — both call sites (useAuthCredentialsFlow,
                   CompactSaveAuthPanel) reuse the existing error-message
                   slot for the neutral text. No manifest scan, no WP call —
                   only the already-fetched User.status.
shared flow:       src/server/auth/activationRequestFlow.ts
                   (requestMigratedAccountActivationByEmail) — extracted so
                   /api/auth/activation/request and the login branch share
                   one rate-limited lookup+issue+deliver+audit path; token
                   issuance always happens regardless of delivery-gate
                   state (fixed a bug caught by re-running the existing
                   token-count assertion: an early version skipped issuance
                   entirely in LOCAL/DEV).
/activate page:    src/app/(auth)/activate/ — reads token from the URL into
                   local state once (never re-read, never logged), calls a
                   new read-only POST /api/auth/activation/status (hash
                   lookup only, never consumes the token) to resolve
                   VALID/EXPIRED/USED/INVALID/ALREADY_ACTIVE before showing
                   the password form, then calls the existing POST
                   /api/auth/activation/complete unchanged. States: loading,
                   blocked (4 variants with distinct copy), form, success
                   (offers login, does not auto-sign-in). Added "activate"
                   to KNOWN_ROOT_SEGMENTS (wpLegacyCatchAll routing) — the
                   page 404'd via the WP-legacy catch-all redirect until
                   this was added; wpLegacyCatchAll.test.ts still passes.
                   Name/terms-consent step skipped: no backend field exists
                   for either, and normal registration doesn't collect them
                   either — same static terms/privacy notice as AuthForm's
                   register mode.
delivery audit:    ActivationDeliveryAudit model + manual migration
                   20260728090000_add_activation_delivery_audit — userId,
                   sourceRecordKey (MigrationLineage lookup, best-effort),
                   provider, recipientMask, template, requestedAt/
                   attemptedAt/sentAt, providerMessageId, status
                   (BLOCKED_ENVIRONMENT/BLOCKED_KILL_SWITCH/QUEUED/SENT/
                   FAILED), errorCode, activationTokenId (FK to
                   UserActionToken — hash reference, never the raw token),
                   source (LOGIN_FLOW/MANUAL_REQUEST/PRODUCTION_BATCH). No
                   raw token, no activation URL, no email body, no provider
                   secret ever stored. Cascade-deletes with the User/token.
tests:             new activationActivatePage.integration.test.ts (status +
                   complete over real HTTP handlers: valid->complete->used,
                   already-active, expired) and login/
                   pendingActivation.integration.test.ts (PENDING_ACTIVATION
                   branch, ACTIVE unaffected, wrong-password/unknown-email
                   still identical generic 401); all pre-existing activation
                   tests re-run unchanged and pass.
verification:      real organic traffic on the shared local dev server
                   (not my own test) exercised the login branch for two
                   real migrated accounts and produced correctly-shaped
                   BLOCKED_ENVIRONMENT audit rows (masked recipient, no raw
                   token) — left untouched, not test residue.
tsc --noEmit / git diff --check: clean.
```

- [x] Migrated-user login detection COMPLETE.
- [x] `/activate` frontend COMPLETE.
- [x] Delivery audit persistence COMPLETE.
- [x] End-to-end activation flow rehearsal COMPLETE (no real email sent).
- [ ] Production bulk delivery остаётся gated финальным Go/No-Go (только
      RC SHA freeze, backup, canary, provider bounce-webhook wiring и
      явное решение founder — см. delivery plan §4).

---

## 4. Текущий Articles/authorship critical path

Slice 18 закрыт: `wordpress-db:post:56250` смигрирован (см. §3.8).

### Slice 19 — второй Article + общий rerun + authorship reconciliation

Только:

```text
wordpress-db:post:57731
```

Выполнено:

```text
first run: LINKED / CREATE
Article: +1 (25->26)
ARTICLE MigrationLineage: +1 (911->912)
MigrationRecord: +1, затем +2 на общий rerun
media importer calls / MediaAsset / storage writes: 0
rerun: post:56250 SKIPPED; post:57731 SKIPPED; rows byte-identical
authorship reconciliation: 2 × EXACT_AUTHORSHIP_CANDIDATE; writes 0
```

Источник: тот же один scoped exact-key read-only SSH fetch (Rule 16) —
не новый snapshot capture, не broad discovery.

Запрещено в Slice 19:

- выполнять отдельный authorship write;
- импортировать media;
- трогать expired Activities, user:521 или user:91.

### После Slice 19

```text
Next slice: targeted authorship assignment for user:575 across both Articles,
            sequential first write + common rerun -> SKIP_UNCHANGED
```

---

## 5. Обязательный P0 остаток до запуска

### 5.1 Articles и content authorship

- [x] Slice 18: golden Article `wordpress-db:post:56250` + rerun.
- [x] Slice 19: второй published Article `wordpress-db:post:57731` + общий rerun 2/2 + read-only authorship reconciliation.
- [x] Read-only authorship reconciliation user:575 объединён со Slice 19: 2 exact candidates.
- [x] Slice 20: exact CAS authorship write для обеих Article + общий rerun `ALREADY_SATISFIED` 2/2.
- [ ] `user:521` — founder/manual conflict decision либо явный P1 defer.
- [ ] `user:91` — lineage review либо явный P1 defer.

### 5.2 Users production и activation

- [x] Manual/privileged Users dispositions — founder decisions COMPLETE (см. §3.4a):
  - 1 existing ADMIN (`user:1`) unchanged;
  - 14/14 остальных migrated: 13 `USER`, 1 `BUSINESS_OWNER` (`user:129`, exact ownership);
  - `user:521`/`user:91` остаются USER/PENDING_ACTIVATION без изменений (P1 defer, см. §5.1).
- [x] Production email provider integration COMPLETE — см. §3.9.
- [x] LOCAL/DEV delivery hard-disable VERIFIED (re-checked against real shell env + rehearsal).
- [x] Activation manifest PREPARED — 578/578 eligible, hash `56c0a18...49a1`.
- [x] Production-like rehearsal COMPLETE — fake/sandbox transport, 0 real sends, 0 DB residue.
- [x] Controlled delivery plan READY — [users-production-activation-delivery-plan.md](users-production-activation-delivery-plan.md).
- [x] Migrated-user login detection, `/activate` frontend, delivery audit persistence — все COMPLETE (см. §3.9a). Оба прежних блокера закрыты.
- [ ] Реальная production delivery остаётся gated финальным Go/No-Go — оставшиеся пункты: RC SHA freeze, production backup, canary batch, provider bounce/failure webhook (см. delivery plan §1/§4).
- [ ] Решить P0/P1 для User/Business avatars и logos.

### 5.3 Events

```text
eligible imported:             4/9
remaining CREATE:              5
pending materialized sessions: 67
```

- [ ] Exact Docker/CI environment gate.
- [ ] Preview 5 remaining Events.
- [ ] Sequential targeted commits.
- [ ] Session/cumulative delta validation.
- [ ] Common rerun.
- [ ] City/date discovery и отсутствие 404.

Event images остаются вне frozen P0 scope.

### 5.4 Routes

- [ ] Ручной review 14/14.
- [ ] Stops, descriptions, RouteStop images и city mappings.
- [ ] Publish approved Routes.
- [ ] Slug history и redirect map.
- [ ] Public URL validation.

### 5.5 Places, Offers, Articles и media

- [ ] Финальная production validation Places.
- [ ] Place media manifest, storage и dedup audit.
- [ ] Production execution Offers safe scope 63/63.
- [ ] Offer media gate либо явный P1 defer.
- [ ] Исправить Article visibility по selected/default city.
- [ ] Article cover manifest и inline `wp-content/uploads` remap.
- [ ] Local FULL, dev metadata-only и production FULL media proofs.

### 5.6 Reviews

- [ ] Подтвердить approved source scope.
- [ ] Users + Places dependency gate.
- [ ] Review vertical slice, golden sample, small batch и rerun.
- [ ] Public rating aggregates validation.

Допустимо перенести Reviews в P1 только явным founder decision.

### 5.7 Redirects, mandatory pages и SEO

- [ ] RankMath `exact` redirects subset.
- [ ] Redirects на `/` вручную перемапить на релевантные hubs.
- [ ] Legal/about/contact pages.
- [ ] WordPress catch-all.
- [ ] Canonical/no-trailing-slash и city-scoped URLs.
- [ ] Sitemap/robots/noindex launch gate.
- [ ] Redirect manifest minimum и collision audit.

`start`/`contains` redirects остаются P1.

### 5.8 Product regressions — launch blockers

- [ ] Event появляется в правильном городе и на правильной дате.
- [ ] Event public URL не отдаёт 404.
- [ ] Published Article виден в блоге selected/default city.
- [ ] Auth и migrated-account activation smoke.
- [ ] Business cabinet и admin lifecycle smoke.
- [ ] Public Places/Offers/Events/Articles/Routes smoke.
- [ ] Mobile/desktop critical navigation smoke.

### 5.9 Release candidate и production cutover

- [ ] Freeze production source snapshots.
- [ ] Production manifests и checksums.
- [ ] Fresh production backup и подтверждённый restore procedure.
- [ ] Full local production-like rehearsal.
- [ ] Dev metadata-only rehearsal.
- [ ] Cumulative DB/storage delta и forbidden fields/tables audits.
- [ ] Redirect/SEO validation report.
- [ ] Docker Build & Push exact RC SHA — GREEN.
- [ ] Финальный Go/No-Go.
- [ ] Последовательная production migration.
- [ ] Post-migration validation и разрешённые idempotency reruns.
- [ ] DNS cutover, noindex switch, monitoring/rollback decision window.

---

## 6. Не входит в обязательный P0 без отдельного решения

- Past Events и Event images.
- 63 expired Activities и связанная authorship — `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- Noncanonical Offer class I.
- Offer class H без Place relation.
- Draft/unpublished long-tail bulk publication.
- Full public profile content classification.
- RankMath `start`/`contains` redirects.
- Historical bookings, WooCommerce/LatePoint и social feeds.
- Collections и редкие custom post types.

---

## 7. Сколько осталось до конца

Это операционная оценка, не календарное обещание:

```text
Core migration mechanics:       ~82% complete
Local clean data work:           ~73% complete
Production/cutover readiness:    ~30% complete
Overall strict prelaunch:        ~62–66% complete
Remaining strict P0 work:        ~34–38%
```

Почему остаток всё ещё крупный: самые рискованные Users identity/ownership writes уже закрыты, но впереди production activation provider, Events tail, Routes review, media, SEO/regressions и весь RC/cutover цикл.

Крупных P0-блоков остаётся **9**:

1. Editorial closure двух Articles: city/geo, publication, blog visibility и cover/media decision.
2. Users production activation (dispositions + delivery readiness COMPLETE, см. §3.4a/§3.9; real send gated on final Go/No-Go).
3. Events tail.
4. Routes review/publish.
5. Places/Offers/Article content и media closure.
6. Reviews либо явный P1 defer.
7. Redirects/pages/SEO.
8. Product regression suite.
9. RC rehearsal и production cutover.

Ориентир по объёму работы:

```text
примерно 12–18 связных slices/PR до cutover,
если Reviews и часть media будут явно перенесены в P1;
больше — если весь перечисленный media/reviews scope остаётся обязательным P0.
```

---

## 8. Следующее одно действие

```text
Phase: EVENTS tail
Prerequisite (COMPLETE): Users fully resolved locally — manual/privileged
  dispositions 14/14 (§3.4a) + full activation product flow (§3.9a): login
  detection, /activate page, delivery audit persistence, all tested.
  Real bulk activation email send stays gated on a separate Go/No-Go
  (RC SHA freeze, backup, canary, bounce webhook — see delivery plan).
Targets: 5 remaining Events (CREATE) + 67 pending materialized sessions
Scope: exact Docker/CI environment gate, preview 5 remaining Events,
  sequential targeted commits, session/cumulative delta validation, common
  rerun, city/date discovery and absence of 404 (см. §5.3)
Out of scope here: Articles (editorial closure already complete — do not
  revisit), Users activation real send, Routes review, media, Reviews,
  redirects/SEO, RC/cutover
```
