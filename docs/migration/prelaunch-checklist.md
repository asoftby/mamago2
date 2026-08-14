# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

**Обновлено:** 2026-07-29 — PRODUCT REGRESSION / RC READINESS complete
**RC:** `codex/product-regression-rc-20260729@17c9dd29`, based on `release/integrated-rc@5edeaaac`
**SEO closure branch:** `fix/seo-migration-closure` (worktree `mamago2-seo-migration-closure`), base `release/integrated-rc@5edeaaac`
**Текущая фаза:** `PRODUCT REGRESSION / RC READINESS — TECHNICAL PASS`
**Текущий кандидат для следующего шага:** `FINAL GO/NO-GO PREPARATION` с закрытием двух обязательных ручных evidence gates: mobile visual UAT и authenticated BUSINESS_OWNER end-to-end UAT.
**Текущий gate:** confirmed product P0 defects `0`; launch всё ещё не разрешён без указанных UAT evidence, founder acceptance и production-only gates.

> Подробная история Slices 1–18 сохранена в Git и профильных proof-документах.
> Этот файл содержит только актуальное состояние, обязательные gates и критический
> путь до запуска.

## INTEGRATED RC

```text
Status:             PRODUCT REGRESSION TECHNICAL PASS
Technical baseline: CODE/BUILD/TYPECHECK PASS
RC branch:          codex/product-regression-rc-20260729
Exact tested SHA:   17c9dd29787bbab0462ca581c546ca83a5dc2e73
RC base:            release/integrated-rc@5edeaaac
Browser/runtime:    DESKTOP PASS; MOBILE VISUAL NOT TESTED
SEO closure:        LOCAL TECHNICAL PASS
UAT Pass 1:         PARTIAL — owner/mobile manual evidence remains
```

Known non-P0 defects retained:

- `ROUTE_RATINGS_PARAMS_NOT_AWAITED` — **OPEN P1**.
- `MISSING_FAVICON_ASSET` — **OPEN P2**.

Integrated-RC runtime findings to reconcile during SEO MIGRATION CLOSURE:

- Representative Event renders with no canonical.
- Representative Article/Place/Offer render one absolute slug-based canonical,
  but its stored origin remains `mamago.local:3000` rather than the exact RC
  runtime origin.
- Browser console recorded a client-side `MutationObserver` target `TypeError`.
- Media-backed representative pages produced local file 404s because the
  sibling RC worktree intentionally did not copy `storage/uploads`; no
  media/storage writes or copies were performed.
- Representative Route renders exactly one absolute slug canonical, hides the
  unusable map below two valid unique points, shows its empty state and has no
  horizontal overflow.

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
17. Все migration/worktree/subagent операции также подчиняются обязательному разделу `Git / Worktree Safety` из корневого `CLAUDE.md`. Перед использованием результата любого worktree необходимо проверить его base SHA и актуальность относительно текущего HEAD.

---

## 2. Текущий прогресс

| Трек | Статус | Что остаётся |
| --- | --- | --- |
| Migration engine | COMPLETE | Regression и production validation |
| Places | **LOCAL PUBLICATION COMPLETE** — 80/80 publishable lineage PUBLISHED (4 protected + 76 newly published); 2 CITY_BLOCKED remain PENDING; 1 non-lineage seed accounted separately | Disposition of 2 CITY_BLOCKED Places; production execution; integrated-RC revalidation |
| Offers | **SAFE-SCOPE LOCAL PUBLICATION COMPLETE 63/63** — moderation lifecycle used; media explicitly deferred P1 | Authenticated owner/admin UAT and CTA end-to-end; production execution; backlog H/I |
| Routes | **COMPLETE** — 14/14 lineage accounted for, 13/13 reviewed Routes PUBLISHED, 1 CITY_BLOCKED kept DRAFT; canonical and map-guard P0 fixes RESOLVED LOCAL | Integrated-RC revalidation; Mogilev onboarding backlog |
| Events | **COMPLETE** — 10/10 lineage accounted for, 8/8 publishable eligible PUBLISHED + 1 protected legacy PUBLISHED; final publication indexing race RESOLVED LOCAL | Integrated-RC revalidation; founder disposition for expired source 64159; Event images P1 |
| Users migration | **COMPLETE 578/578** — clean 564/564 + manual/privileged 14/14; all migrated users `PENDING_ACTIVATION`; role/ownership audit complete | Production activation delivery |
| Users activation | **LOCAL/REHEARSAL COMPLETE; PRODUCTION DELIVERY GATED** | Resend production secrets, verified sending domain, final manifest/checksum, canary, sequential batches, bounce/failure reconciliation and production proof |
| Business-linked Users | **FULLY CLOSED** | 38/38 ownership, 38/38 `BUSINESS_OWNER`, backlog 0 |
| Users manual/privileged | **COMPLETE 14/14** | 1 existing ADMIN unchanged, 13 `USER`, 1 `BUSINESS_OWNER` (user:129, exact 9-Place ownership); rerun 14×`SKIP_UNCHANGED`, 0 deltas |
| Activities | P0 CLOSED | 63 expired Events → `P1_HISTORICAL_EXPIRED_ACTIVITY` |
| Articles / authorship | **ARTICLES COMPLETE** — 2/2 target Articles, exact authorship, common rerun `ALREADY_SATISFIED`, public rendering verified | Integrated-RC revalidation only |
| User/Business profile media | NOT STARTED | P0/P1 decision, manifest, proof, production gate |
| Article media | **PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS** | Source 404 gaps documented; placeholders absent; do not reopen without regression evidence |
| Reviews | NOT STARTED | Реализовать либо явно defer в P1 |
| Redirects/pages/SEO | **LOCAL TECHNICAL COMPLETE** — see §5.7 | Legal/about/contact page audit; external baseline |
| SEO MIGRATION CLOSURE | **LOCAL TECHNICAL: PASS** — see §5.7 | External Search Console/Analytics/backlink baseline, founder SEO Go/No-Go, cutover runbook, monitoring plan. **Full launch Go/No-Go still requires these; local technical closure alone is not launch clearance.** |
| Product regressions | PARTIAL | Event discovery/404, Article city visibility, full smoke |
| Full product acceptance / UAT | **NOT STARTED** | Pass 1, defect cycle, Pass 2, founder acceptance |
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
Phoenix OfferDomainHashV2 transition: BLOCKED — 63/63 LOCAL targets have unsupported multi-field drift; see phoenix-offers-domain-hash-v2-audit-2026-07-31.json
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
      existing ADMIN account untouched (personal email omitted from proof).
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

### 5.3 Events — COMPLETE: 10/10 lineage records accounted for, 8/8 publishable eligible PUBLISHED

The prior "4/9 imported, 5 CREATE remaining, 67 pending sessions" snapshot was
stale: an earlier, never-merged session (`docs/event-migration-mvp-complete`,
2026-07-21, never merged to `dev`) had already CREATE'd all 9 eligible Events
plus canonicalized their lineage hash to v2 (PR #64/#65, both on `dev`) — the
checklist just never reflected it. All 9 eligible + the 1 legacy/protected
(`wordpress-db:events:55980`) already had `Activity` rows with active
lineage. There was **no remaining CREATE work** — confirmed twice, by direct
DB read and again structurally: the new resync tool below refuses to CREATE
under any circumstance (`BLOCKED_LINEAGE_MISSING`, no write, if lineage is
ever absent).

**Session 1 (initial audit + partial publish):** read-only audit
(`migration:preview:wordpress-db --entity event`, exact-key + full scan)
classified all 9: `VALID_FUTURE` no-drift (56226, 56062, 64505), 5 events
with materialized sessions gone stale since their 07-19/20 creation
(56479, 60404, 62977, 63510, 64251), 1 fully expired at the source
(64159 — WP post no longer published at all), plus one brand-new,
already-past-only discovery (49842, auto `SKIP_POLICY`, no action). Trying
to fix the drift via the ordinary `migration-commit-wordpress-db.ts` UPDATE
path worked for 2 of the 5 (56479, 60404 — their lineage hash was still
pre-canonical-v2, so a real UPDATE ran) but exposed two real defects in
`EventCommitWriter` for the other 3 (already on canonical v2 hash →
`SKIP_UNCHANGED`, so no rebuild happened at all) and, worse, actively
regressed two already-published Events when used to "verify idempotency."

**Two regressions found, root-caused, and fixed in code this session**
(`src/lib/migration/commit/event/EventCommitWriter.ts`):
1. **cityId clobber** — `buildEventCreateDraft()` is a pure function with no
   knowledge of any existing row; `context.cityId` absent/unmatched always
   produces `draft.cityId: null`. `updateEventFromDraft()` wrote that `null`
   to `Activity.cityId`/`EventVenue.cityId` unconditionally, with no
   preserve-existing-if-unresolved guard (unlike `EventVenue`'s own
   never-clear-on-no-evidence rule for every *other* field). This nulled
   `wordpress-db:events:60404`'s city mid-session.
2. **status reset** — `EventCreateDraft.status` is hardcoded `"PENDING"`
   (the CREATE-only default); `updateEventFromDraft()` wrote it
   unconditionally on every UPDATE too, silently reverting any
   already-`PUBLISHED` Event back to `PENDING` the moment its content hash
   ever changes (or, as happened here, the first time it's ever actually
   re-committed). Unpublished `56226`/`56062`.

**Fix**: `updateEventFromDraft()` now never sends a `status` key at all
(lifecycle is exclusively an approval-flow concern, never a migration-UPDATE
concern), and only sends `cityId` when the draft has a proven non-null
value — absence of city evidence no longer overwrites a city already on the
row, on both `Activity` and `EventVenue`. 8 new regression tests
(`EventCommitWriter.test.ts`) cover both directions (preserve-on-null,
still-applies-when-proven) for both fields, plus confirm CREATE is
unaffected. Both incidents were also corrected in the live DB before the
fix landed (scoped, precondition-checked, transactional).

**New capability**: `scripts/migration-event-sessions-resync.ts`
(`pnpm migration:events:sessions-resync`) — the actual gap that caused the
3 SKIP_UNCHANGED events to get stuck. A canonical content hash correctly
proves "the WordPress post is unchanged"; it says nothing about whether a
multi-date schedule's *materialized* `ActivitySession` rows still match
what today's date would produce from that same unchanged content (past
sessions get pruned as calendar days pass, independent of any content
edit). This tool computes a second, independent, deterministic fingerprint
(`computeEventScheduleResyncPlan.ts`, reusing the existing
`eventSessionScheduleFingerprint`/`eventSessionFingerprintFromStoredSessions`
helpers) and — only when it detects real drift — rewrites *exclusively*
`ActivitySession` rows and `Activity.nextOccurrenceAt` inside one
transaction per Event (`EventScheduleResyncWriter.ts`), through a Prisma
client type with no `status`/`cityId`/`slug`/`title`/`ownerUserId`/venue/
media/lineage delegates reachable at all — structurally, not just by
convention. Never CREATEs (`BLOCKED_LINEAGE_MISSING`/`_AMBIGUOUS` if
lineage isn't exactly one active row); never touches an unpublishable
source (`BLOCKED_EXPIRED_SOURCE` if the WP post is gone or fully
past-dated). `--preview`/`--commit`, exact `--source-record-key` only, no
mass scan mode. Every commit re-reads and asserts protected fields
byte-identical before and after, and re-verifies the post-write fingerprint
matches the desired one — either failure aborts the batch (stop-on-first-
error) rather than silently continuing. 17 tests across 3 files (pure plan
logic, writer, CLI arg parsing).

**Session 2 (close-out, same day)**: ran the new resync tool against the 3
stuck keys — all `RESYNC` (62977: 29→23 sessions, 63510: 35→27, 64251:
34→25, all now spanning today→their real end date), all protected fields
verified byte-identical before/after, all fingerprints verified matching
post-write. Published all 3 via the unchanged `scripts/approve-event.ts`
lifecycle path. Re-ran the resync tool in `--preview` against all 8 eligible
+ published keys (the 3 just-fixed plus the 5 from session 1): **8/8
`NOOP_ALREADY_SYNCED`, 0 writes** — proves both the fix and the new tool's
own idempotency, through the tool that's actually safe to use for this
(never resets status/city, unlike the old commit CLI).

**Final accounting (2026-07-28, local `mamago2`, direct DB read — do not
recompute from earlier session logs)** — this replaces every prior "X/Y
published" framing in this section, which conflated *eligible* with
*publishable* and made an intentionally-excluded expired source look like
unfinished work:

```text
Total Event MigrationLineage records (targetType=ACTIVITY, active):  10
Total ActivitySession rows across those 10 Activities:              109
Duplicate sourceRecordKey / Activity linkage / slug / session rows:  0 / 0 / 0 / 0
Orphan ActivitySession rows (no matching Activity):                 0

Protected legacy (wordpress-db:events:55980):     1 — PUBLISHED (untouched, out of scope)
Eligible migrated Events (the 9 from the WP tail): 9/9 accounted for
  Future-valid, publishable:                       8/8 — all PUBLISHED
  Expired source (wordpress-db:events:64159):       1 — retained PENDING, excluded from publication

Events migration is considered complete: all 8 future-valid eligible
Events are published; the expired source (64159) is a deliberate
exclusion, not an unfinished CREATE or a blocked publish.
```

Classification table (all 10 lineage records):

| sourceRecordKey | Activity id | classification | status | sessions | nextOccurrenceAt | city | public URL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `...:55980` | `cmrb48y2q...` | PROTECTED_LEGACY_PUBLISHED | PUBLISHED | 1 | 2026-07-12 | Минск | `/minsk/events/interaktivnyy-kvest-mir-naoschup` |
| `...:56226` | `cmrs53a6u...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-08-01 | Минск | `/minsk/events/igra-zvuki-temnoty` |
| `...:56479` | `cmrsdnl2d...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-08-09 | Минск | `/minsk/events/semeynyy-kvest-priklyucheniya-v-hogvartse` |
| `...:60404` | `cmrsduuwv...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 28 | 2026-07-29 | Минск | `/minsk/events/letnyaya-aktivnaya-razvlekatelnaya-zagorodnaya-programma-2026-aktiv-polis-na-baze-sanatoriya` |
| `...:56062` | `cmrt4fhmq...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-08-06 | Минск | `/minsk/events/psihologicheskiy-trening-aromamagiya` |
| `...:64505` | `cmrt4ibs5...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-09-12 | Минск | `/minsk/events/s-kibirova-balet-tri-porosenka` |
| `...:62977` | `cmrt4k8ec...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 23 | 2026-07-29 | Минск | `/minsk/events/letniy-gorodskoy-otdyh-v-minske-dlya-detey-6-13-let` |
| `...:63510` | `cmrt4ltsz...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 27 | 2026-07-29 | Минск | `/minsk/events/immersivnaya-vystavka-neboreka-planeta-posle-shuma` |
| `...:64251` | `cmrrljj8c...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 25 | 2026-07-29 | Минск | `/minsk/events/letniy-klub-dlya-detey-na-angliyskom` |
| `...:64159` | `cmrt4gvoz...` | EXPIRED_SOURCE_PENDING | PENDING | 1 (stale, 07-25) | — | Минск | none (no slug, not public — reconfirmed live: WP source still returns no published post) |

`PROTECTED_LEGACY_PUBLISHED: 1`, `FUTURE_VALID_PUBLISHED: 8`,
`EXPIRED_SOURCE_PENDING: 1` — matches the expected split exactly, no
discrepancy found.

All 5 originally-published + 3 resynced-then-published + the 1 legacy URL
(9 total) verified live: correct title/city/date, appear in
`/minsk/events` discovery, 0 console errors, mobile smoke clean. 0
`MediaAsset`/`MigrationMediaAsset` writes across any session.

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` — this live smoke ran
against the already-running main-repo dev server, not this worktree's own
(documented above as a deliberate workaround for a Next dev port/lock
conflict at the time). A later session (2026-07-29, Places/Offers) found
that the shared `dev` preview tooling always launches from the main repo
checkout regardless of the active worktree — meaning this smoke verified
DB/content rendering correctly, but not necessarily against this worktree's
exact code (no code changes were needed for the public Event pages
themselves, so risk is low, but not zero). Not re-verified now — data/
migration closure is not reopened; revalidate on the integrated RC worktree
instead (see §11/next-action).

Backlog — the only remaining non-published record:

```text
64159  EXPIRED_SOURCE_PENDING — WP post no longer published
       (post_type=events, post_status=publish returns nothing, reconfirmed
       live via the resync tool's --preview). DB's own materialized
       session was already past (2026-07-25) anyway. Left PENDING, not
       counted against "publishable" — this is a deliberate exclusion,
       not unfinished CREATE work. Founder decision still open:
       hard-exclude permanently vs. leave PENDING indefinitely — not a
       blocker for Routes or anything else.
```

**Known defect — backlogged, not fixed in this slice (found during
publication, unrelated to the Event UPDATE/resync code above):**

```text
EVENT_SEARCH_INDEX_PUBLICATION_RACE

Severity: P0 (reproduced twice under ordinary use; produces a genuinely
incorrect, non-canonical public-facing URL — see reproduction below).

Root cause: publishing an Event performs two separate Activity.update()
calls in sequence — approve-event.ts's own status:PUBLISHED update, then
a second update (slug + slugUpdatedAt) inside
assignActivitySlugIfMissing()'s own transaction, called via
ensurePublishedActivityHasSlug(). Prisma's search-indexing extension
(extendPrismaWithSearchIndexing, wired in src/lib/prisma.ts) fires an
independent, unawaited SearchIndexerService.upsertActivity(id) after
*every* Activity.update() call ("fire-and-forget", src/lib/search/
prismaSearchExtension.ts). Each dispatch independently re-reads the
Activity fresh (buildActivityDocument) and upserts SearchDocument — there
is no ordering or deduplication between the two dispatches from the same
publish. Whichever of the two async chains' upsert reaches the DB last
wins, regardless of which one has the complete (post-slug-assignment)
state. buildActivityDocument falls back to the raw Activity id for
urlPath when slug is still null at read time (publicActivityPath()), so
the losing race leaves SearchDocument.urlPath as
"/minsk/events/{activityId}" instead of the canonical slug path.

Reproduction (real, not synthetic): observed on 2/9 Events published this
session (wordpress-db:events:62977 and :56479, from two different
approve-event.ts invocations in two different sessions) — i.e. roughly
1-in-4-5 publishes hit it in practice. Both were repaired with a manual
`new SearchIndexerService(prisma).upsertActivity(id)` re-index (data
repair only, no code change) and reconfirmed correct; all 9 published
Events' SearchDocument.urlPath now match their canonical slug path
exactly (verified 2026-07-28).

User impact: the affected page itself does NOT 404 — [city]/events/
[slugOrId]/page.tsx's dynamic route accepts either the slug or the raw id
(confirmed: /minsk/events/cmrt4k8ec0006wswzelvt2e5d returned 200 OK with
the correct event rendered) — so this is a site-search/SEO/canonical-URL
correctness defect, not a hard broken-link defect. Classified P0 anyway
per the "reproducible + incorrect URL" bar, since it was empirically hit
twice under completely ordinary publish actions, not contrived.

Fix (not implemented here — out of scope for the Events migration slice,
touches shared search-indexing infrastructure used by Places/Articles/
Offers/Routes too, not just Events): a single deterministic reindex call
after the full publish lifecycle transaction completes, replacing the two
independent fire-and-forget dispatches — or an ordering/deduplication
queue in the indexer itself. Needs its own scoped review before any
implementation.
```

- [x] Exact Docker/CI environment gate — LOCAL, `mamago2`, this worktree.
- [x] Read-only audit of all 9 eligible + 1 legacy Event.
- [x] Sequential targeted commits/resyncs, stop-on-first-error (none hit).
- [x] Session/cumulative delta validation, duplicate check, media-write check, orphan-session check.
- [x] City/date discovery и отсутствие 404 — all 9 published URLs verified.
- [x] Event UPDATE lifecycle/cityId regressions fixed in code + regression-tested.
- [x] Event schedule resync capability built, tested, used to close all 3 stuck records.
- [x] Common resync-tool rerun — 8/8 `NOOP_ALREADY_SYNCED`, 0 writes.
- [x] Search-index race root-caused, reproduced, documented as P0 backlog, current data repaired.
- [ ] Decide 64159's fate (source gone — hard-exclude vs. leave pending indefinitely).
- [ ] `EVENT_SEARCH_INDEX_PUBLICATION_RACE` fix — separate scoped slice, touches shared search infra.

Event images остаются вне frozen P0 scope.

### 5.4 Routes — COMPLETE: 14/14 lineage accounted for, 13/13 reviewed Routes PUBLISHED

```text
worktree:                  mamago2-routes-review, branch feat/routes-review-publication
base:                      feat/events-tail-import @ 525aedec (contains all 3 Events tail commits)
aggregate read-only audit: 14/14 active ROUTE lineage records, 14/14 Route rows exist
                           (buildRouteEditorialReview, already-existing tooling from
                           commit 2e0df3b6, first run 2026-07-13, rerun live 2026-07-28)
classification:            13 x READY (after editorial review, see below), 1 x CITY_BLOCKED
                           (Mogilev, wordpress-db:routes:46963 — found already
                           status=PUBLISHED/visibility=PUBLIC/cityId=null in shared local
                           DB, pre-existing anomaly from outside this session, not created
                           by this slice)
```

Editorial copy review (13 routes, 86 RouteStop notes, one aggregated pass):

```text
method:              every stop's source note read in full and compared against the
                      existing auto-shortener's proposal (proposeShortRouteStopNote,
                      >300 chars -> first 1-3 sentences)
finding:              the auto-shortener systematically drops the practical tail of
                      almost every stop (contact phone, address, price, opening hours,
                      coordinates, safety warnings) because that content sits after the
                      narrative lead-in — unusable as-is under the "never change
                      prices/hours/addresses/age limits/warnings" rule
classification:       ACCEPT_SHORT 2, KEEP_FULL 84, EDIT_SHORT 0, BLOCKED 0
mojibake fixes:       12 RouteStop rows (11 distinct single-byte corruptions, one route
                      had 2 separate corrupted stops) — e.g. "сре��а" -> "среда",
                      "Брас��авский" -> "Браславский"; unambiguous from Russian
                      grammar/context, restores meaning, invents no new fact
final write scope:    ONLY the 12 mojibake-affected RouteStop.note rows written
                      (byte-identical exact-substring replacement); the other 74 stops
                      left byte-identical in DB — no whitespace/paragraph normalization
                      applied to avoid unrelated writes (narrowed from an earlier,
                      broader 86-row whitespace-cleanup proposal after review)
manifests:            docs/migration/reviews/route-review-2026-07-28.md/.json (live audit),
                      docs/migration/reviews/route-apply-plan-2026-07-28.json (applied plan),
                      docs/migration/reviews/route-note-diff-manifest-2026-07-28.json
                      (per-stop before/after hash + NOOP/UPDATE action for all 86 stops)
```

Publication (existing reviewed tooling, `scripts/migration-apply-route-review.ts` /
`applyRouteReviewPlan`, guarded per-route transaction, stop-on-first-error):

```text
dry run:              13/13 DRY_RUN, 0 SKIPPED/FAILED
apply:                13/13 APPLIED — Route.status DRAFT->PUBLISHED,
                      Route.visibility PRIVATE->PUBLIC, authorId remains null (unchanged)
                      + the 12 mojibake RouteStop.note updates in the same transaction
seo canonical sync:   syncRouteCanonical() (existing exported helper, same one the real
                      admin publish endpoint calls) run for all 13 — 13/13 UPDATE
                      (null -> /routes/<slug> canonical), search index upserted
                      synchronously and confirmed isPublished:true per route
idempotency rerun:    re-running the identical apply plan -> 13/13 SKIPPED
                      (ROUTE_STATUS_CHANGED:PUBLISHED), 0 writes — deterministic
```

Mogilev (`wordpress-db:routes:46963`) — CITY_BLOCKED, kept out of public state:

```text
found:                already status=PUBLISHED/visibility=PUBLIC/cityId=null in the
                      shared local DB before this session touched anything
city check:           read-only exact lookup confirmed no City "Могилёв" exists
                      (only Минск, Марьина Горка, and 3 inactive villages) — no City
                      created, no cityId assigned, per explicit decision not to expand
                      geography inside this Routes slice
action:               UNPUBLISH_TO_NON_PUBLIC_STATE via a bounded script that reuses
                      the exact same operations as the existing admin lifecycle
                      endpoint (PATCH /api/admin/routes/[id] { publish:false }):
                      prisma.route.update({ data: { status: DRAFT } }) — visibility
                      untouched, matching that endpoint's own behavior — plus
                      syncRouteCanonical(); guarded by an explicit before-state assert
                      (PUBLISHED/PUBLIC/cityId null/authorId null) that aborts on
                      mismatch
preserved:            content, all 4 RouteStops, media, slug (marshrut-mogilev),
                      authorId (null), MigrationLineage — all byte/value-identical
                      before/after (asserted programmatically)
verified:              status=DRAFT, visibility unchanged=PUBLIC (status alone gates
                      public visibility — listPublicRoutes/listPublicRoutesByCity/
                      getRouteBySlug's page-level canViewRoute() all require
                      status===PUBLISHED AND visibility===PUBLIC), SearchDocument
                      isPublished:false, absent from listPublicRoutesByCity(Минск),
                      public page canViewRoute() returns false for anonymous users on
                      a non-PUBLISHED route -> notFound() (404)
backlog:              Mogilev City onboarding — City creation/configuration, slug,
                      country, discovery, SEO, sitemap, redirects, public smoke —
                      requires a separate founder-approved geography-expansion
                      decision; this Route is not a failed/incomplete CREATE, it is
                      imported and lineage-accounted-for, only excluded from
                      publication
```

Cumulative audit (post-batch):

```text
active ROUTE lineage:       14 (unchanged)
duplicate sourceRecordKey:  0
duplicate lineage targetId: 0
Route rows total:           14 (unchanged, 0 CREATE, 0 DELETE)
published/public:           13
draft:                      1 (Mogilev)
duplicate city+slug pairs:  0
non-null authorId:          0 (all editorial, ownership untouched)
RouteStop rows total:       90 (unchanged, 0 CREATE, 0 DELETE)
orphan RouteStops:          0 (routeId is a required FK — structurally impossible)
RouteSlugHistory rows:      0 (unchanged — no slug was touched)
```

Public validation — service layer AND live browser smoke, both done:

```text
service layer:               listPublicRoutesByCity -> exactly the 13 published
                            routes, Mogilev absent; canViewRoute -> anonymous users
                            get notFound() for any status!==PUBLISHED route
live browser smoke:          done against the already-running main-repo dev server
                            (localhost:3000, same shared local DB) — this worktree's
                            own server couldn't bind (Next dev lock shared with main
                            repo dir), so the running instance was reused read-only
  13 public URLs:             all -> HTTP 200 (curl-verified)
  Mogilev URL:                 HTTP 404, real Next 404 page content confirmed
                              (not a soft-404)
  discovery listing (/routes): exactly 13 cards, titles correct, stop counts sum to
                              86 (matches DB), Mogilev absent
  stop order/content:          verified on 2 routes (6-stop "Дрозды", 9-stop
                              "Новогодний") — order, titles, note text render
                              correctly and in sequence
  console/hydration errors:    0 across all pages checked (detail x2, listing,
                              Mogilev 404)
  mobile viewport (375x812):   renders correctly, no layout breakage
  desktop viewport:            renders correctly
  images:                      no broken images — expected, since 0/90 RouteStops
                              have photoUrl (pre-existing media policy, unchanged)
  robots meta:                 "noindex, nofollow" on every page — confirmed this is
                              the existing site-wide src/lib/seo/globalNoindex.ts
                              dev/local switch (see checklist §5.9 "noindex switch"),
                              not Route-specific, not caused by this session
```

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` — same caveat as Events
above: this smoke ran against the already-running main-repo dev server, not
this worktree's own (the tooling-level reason was only identified later, in
the 2026-07-29 Places/Offers session). No Route code changes were made this
session (100% existing tooling reused), so risk is low, but the smoke itself
was not proven to run against this exact worktree's checkout. Not reopened
now; revalidate on the integrated RC worktree.

Two genuine gaps found during smoke — pre-existing, not introduced by this session
(this session never touched `lat`/`lng`/`address`/`seoCanonicalUrl`-consumption code),
recorded as backlog, do not block the COMPLETE status below:

```text
1. Canonical <link> missing in HTML: RouteDetailPage's generateMetadata() never reads
   Route.seoCanonicalUrl (the field syncRouteCanonical() correctly computed and wrote
   for all 13+Mogilev) — only city/event listing pages set `alternates.canonical`.
   Route detail pages have emitted no canonical tag since this code was written,
   before this session. Backlog: add `alternates: { canonical: db.seoCanonicalUrl }`
   to RouteDetailPage generateMetadata.
2. Map polyline is meaningless on every Route page: 0/90 RouteStops (all 13
   published + Mogilev) have lat/lng/address populated, despite source notes
   containing embedded "Координаты: ..." text — coordinates were never parsed into
   RouteStop columns during the original WordPress import (pre-existing migration
   gap, this session only touched the `note` field). The map widget falls back to
   drawing a nonsensical line across the country. Backlog: RouteStop geo-enrichment
   from source coordinates, separate migration slice.
```

- [x] Ручной review 14/14 (13 editorial + 1 CITY_BLOCKED classification).
- [x] Stops, descriptions review; RouteStop images intentionally not imported (media
      policy METADATA-skip, pre-existing decision, INFO-level warning only, not a
      blocker); city mappings verified for 13/13 published (Минск, evidence-based).
- [x] Publish approved Routes — 13/13 PUBLISHED/PUBLIC.
- [ ] Slug history и redirect map — no slug changes occurred (0 RouteSlugHistory rows,
      expected); legacy WordPress URL -> new slug redirect mapping for these 14 Routes
      not separately re-verified against the 893-row WP redirect manifest this session.
- [x] Public URL validation — verified at both the service/access-control layer AND
      live browser smoke (13/13 URLs 200, Mogilev 404, discovery correct, 0 console
      errors, mobile+desktop render clean). Two pre-existing, non-blocking gaps found
      and backlogged (canonical `<link>`, RouteStop coordinates) — see §6.

### 5.5 Places, Offers, Articles и media

**Places — 2026-07-28 (two sessions), worktree `mamago2-places-offers-closure`, branch
`feat/places-offers-production-media-closure`, base `feat/routes-review-publication`@`657c6c59`.**
Full detail: `docs/migration/reviews/place-*-2026-07-28.{md,json}`, corrected/exact matrix:
`docs/migration/reviews/place-status-classification-matrix-2026-07-28.{md,json}`.

```text
PLACES:
DATA AND MIGRATION CLOSURE COMPLETE

82/82 lineage records accounted for
1 non-migration seed accounted for separately ("Невидимый мир", no lineage — out of migration scope)
0 unexpected CREATE/DELETE
0 duplicate lineage/source keys/slugs
0 orphan media links
1 writer regression found + fixed + tested (see below)

PUBLICATION:
NOT COMPLETE — exact editorial/lifecycle scope remains

Published:                                    5   (4 lineage + 1 non-migration seed)
Ready for editorial publication review:      76   (READY_NOOP + PENDING — content matches source
                                                    exactly, but SKIP_UNCHANGED proves content
                                                    parity, not publication readiness; no bulk
                                                    review/publish tool exists for Place yet)
Manual-content review required:               0   (the 4 UPDATE_CONFLICT places are already
                                                    PUBLISHED and were browser-verified valid this
                                                    session — see matrix doc for the distinction)
City blocked:                                  2   (no cityId, and the source itself has none either
                                                    — not drift, a real content gap; excluded from
                                                    any bulk-publish candidate universe)
Source unpublished/excluded:                   0

MEDIA:
PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS — existing sampled-media policy (3 hand-picked Place keys
get FULL in LOCAL/DEV, proven working end-to-end: real download/dedup/storage/link); the other 79
get METADATA_ONLY by the same pre-existing, deliberate policy, not expanded this session — see
place-media-manifest-2026-07-28.md for the founder-decision framing.

PUBLIC RUNTIME VALIDATION:
PASS for all 5 currently-PUBLISHED Places (200 OK, correct content/city/media/hours/reviews, 0
console errors, desktop+mobile clean, a PENDING place correctly 404s) — but NEW P0 found:
PLACE_CANONICAL_METADATA_MISSING. `generateMetadata()` never reads `Place.seoCanonicalUrl`;
`seoCanonicalUrl` can be populated in the DB while the rendered HTML still has no
`<link rel="canonical">` at all — confirmed on all 5 published Places. Current Place canonical
validation = FAIL. This blocks final Go/No-Go but does NOT reopen or invalidate the
data/migration closure above.

PRODUCTION EXECUTION:
NOT STARTED — manifest generation deliberately deferred to actual cutover time (no bulk Place
discovery gap here, unlike Offer; deferred purely because source content could drift between now
and cutover, so freezing today's hashes would be less rigorous than generating fresh ones then).

Regression found+fixed: PlaceCommitWriter.buildUpdateData() unconditionally reset status to PENDING
  and clobbered cityId on every UPDATE (same class as the EventCommitWriter bug) — dormant today (0
  Places in an UPDATE_SAFE state) but a live risk for the next WP edit to any of the 76 clean rows.
  Fixed + 3 regression tests added, full Place test suite green.
```

- [x] Places DB/source aggregate audit, exact status/classification matrix, safe-UPDATE regression
      fix, media manifest, public validation — see above and `docs/migration/reviews/place-*-2026-07-28.*`.
- [x] Founder decision (applied 2026-07-29): publish the 76 `READY_FOR_EDITORIAL_PUBLICATION_REVIEW`
      Places via the existing `approvePlace()` lifecycle — see PLACES LOCAL PUBLICATION below.
- [x] `PLACE_CANONICAL_METADATA_MISSING` fixed — see below.
- [ ] Founder decision: disposition of the 2 `CITY_BLOCKED` Places (assign city with real evidence,
      or leave excluded indefinitely) — unresolved, still `PENDING`.
- [ ] Production execution Places (manifest generation deferred to cutover time, not frozen now).

**Places — 2026-07-29, worktree `mamago2-places-offers-publication`, branch
`feat/places-offers-publication-closure`, base `feat/places-offers-production-media-closure`@`74bcb483`.**
Full detail: `docs/migration/reviews/place-publication-result-2026-07-29.md`,
`docs/migration/reviews/place-publication-manifest-2026-07-28.json`.

```text
PLACES LOCAL PUBLICATION:
COMPLETE

82/82 lineage accounted for
80/80 publishable lineage Places PUBLISHED:
  4 protected existing (437/895/5389/43023, untouched)
  76 newly published via existing approvePlace() lifecycle (0 raw status mutations)
2 CITY_BLOCKED remain PENDING (untouched, no evidence to assign a city, correctly excluded from
  the publishable-lineage count above):
  wordpress-db:places:32409 (Be English)
  wordpress-db:places:60742 (Школа архитектурного мышления)
1 non-migration seed PUBLISHED, accounted for separately (out of migration scope)
(81/83 total Place rows are PUBLISHED: 80 lineage + 1 seed)

Place canonical:
RESOLVED LOCAL, integrated RC revalidation required — PLACE_CANONICAL_METADATA_MISSING fixed
(generateMetadata() now reads seoCanonicalUrl, falls back to slug-based path, never uses id when a
slug exists); verified via current-worktree HTTP/browser proof (own dev server, port 3050, launched
from this worktree's own pwd, .next cleared first — see place-publication-result-2026-07-29.md
for exact provenance) on real HTML for all 76 newly-published Places (76/76 have
<link rel="canonical">, 0/76 id-based) plus the 4 pre-existing published Places. Not yet
re-verified against an integrated RC build.

Place local media:
existing sampled policy verified unchanged (not expanded); 76 newly-published Places use
METADATA-only media (no cover), render cleanly with no broken images.

Place production FULL media:
GATED (unchanged from prior session)

Place production publication:
GATED (manifest generation deferred to actual cutover time)

Common rerun:
76/76 ALREADY_PUBLISHED_CANONICAL_AND_INDEX_RESYNC — 0 lifecycle/content/relation writes, but
canonical-table (76 unconditional UPDATEs) and search-index (76 unconditional upserts) writes did
occur, value-neutral (timestamp-only — see place-publication-result-2026-07-29.md §7 for the exact
code-level reasoning). Not a bare "0 writes"; precision matters here.

Public/city/browser (current-worktree HTTP/browser proof):
PASS — 76/76 HTTP 200, correct city/title/category, 0 console errors on representative deep smoke
(desktop+mobile), both CITY_BLOCKED Places confirmed still 404. Integrated RC browser revalidation
still required (BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC).

Protected fields (title/cityId/ownerBusinessId) verified byte-identical before/after for all 76;
slug allowed to change only from null->assigned (existing approvePlace() behavior, not new).
```

**Offers — 2026-07-28 (two sessions), same worktree.** Full detail:
`docs/migration/reviews/offer-*-2026-07-28.{md,json}`.

```text
OFFERS SAFE SCOPE:
DATA CLOSURE COMPLETE 63/63

63/63 safe canonical Offers accounted for (matches 2026-07-22 closure, commit 1fca8c8b — golden +
  Batch 1-4, immutable manifest hashes on record; NOT re-run this session, per that session's own
  "must not run again")
63/63 linked to proven Places (0 duplicate source keys/linkage/slugs, 0 wrong-Place Offers)
63/63 cityId backfilled from linked Place (writer regression found+fixed, see below)
0 unexpected CREATE/DELETE
common backfill rerun: 0 eligible, 0 writes — deterministic

PUBLICATION:
NOT COMPLETE — all 63 remain DRAFT

Approved lifecycle path:
NOT YET DEFINED. `approveOffer()` only accepts a PENDING→PUBLISHED transition; none of the 63 ever
went through a DRAFT→PENDING submit step (they were migration-created, not Business-submitted) — a
structural capability gap, not a reason to bypass the normal lifecycle. Preferred future lifecycle
for a separate task:  DRAFT → (submit-for-moderation, not yet implemented) → PENDING →
`approveOffer()` → PUBLISHED. A technical path to set `PUBLISHED` directly exists today via the
privileged-role Business PATCH endpoint — it is explicitly NOT to be used for a mass direct
DRAFT→PUBLISHED move without its own separate founder decision.

MEDIA:
NOT IMPLEMENTED — founder P0/P1 decision required.
  Option A (P0): implement a minimal source-backed Offer media pipeline (cover image, reusing
    PlaceMediaSyncer's dedup/storage pattern) before any Offer goes to production.
  Option B (P1 defer): launch Offers without media, conditional on: layout doesn't break, CTA
    works, no misleading placeholder is shown, and public/business/admin UAT passes.
  Not declared deferred without explicit founder approval — recorded here as an open decision, not
  as a settled P1.

Class H: 28 documented backlog — no required Place relation (carried forward from the 2026-07-22
  closure, not re-derived; no bulk Offer source-discovery tool exists in this codebase to redo it).
Class I: 8 documented backlog — noncanonical alias (same as above).

CANONICAL:
Offer's public-page code already reads `seoCanonicalUrl` and sets `alternates.canonical` correctly
(confirmed via code reading) — but with all 63 still DRAFT, there is no PUBLISHED Offer to browser-
verify the rendered HTML against yet. Status: `IMPLEMENTED_IN_CODE, PUBLIC RUNTIME PROOF PENDING`
— not declared a full PASS until at least one Offer is PUBLISHED and its HTML verified.

PUBLIC/BUSINESS/ADMIN VALIDATION:
PARTIAL — public 404 confirmed for a DRAFT Offer (correct), auth gating confirmed (401
unauthenticated); full authenticated business/admin walkthrough NOT performed (all 63 are uniformly
DRAFT, nothing a login flow would newly reveal beyond the DRAFT-status finding above — see
offer-business-admin-smoke-2026-07-28.md).

PRODUCTION EXECUTION:
GATED — exact 63-key scope identified, prerequisite (writer fix) must ship before any production
Offer commit; byte-exact manifest hash deferred to actual cutover time (no bulk preview tool exists
to freeze one today) — see offer-local-execution-2026-07-28.md.

Regression found+fixed: OfferCommitWriter.createOfferFromDraft() resolved+validated
  draft.ownership.cityId (buildOfferCreateDraft blocks on MISSING_CITY otherwise) but never
  persisted it — all 63 Offers had cityId: null despite their Place always having a real city. Fixed
  the writer (+regression test, new OfferCommitWriter.test.ts — none existed before) and backfilled
  all 63 existing rows from Offer.place.cityId (CAS-guarded, one-off runner — deleted after use, not
  a committed reusable tool — protected fields verified byte-identical, reran to confirm 0 further
  writes). 0/63 city mismatches now.
```

- [x] Offers DB/source reconfirmation, `cityId` regression fix+backfill, media capability-gap
      assessment — see above and `docs/migration/reviews/offer-*-2026-07-28.*`.
- [x] Founder decision (applied 2026-07-29): implement `submitOfferForModeration()` and publish the
      safe-canonical 63 via `DRAFT → PENDING → PUBLISHED` — see OFFERS SAFE SCOPE LOCAL PUBLICATION below.
- [x] Founder decision (applied 2026-07-29): Offer media Option B (explicit P1 defer), approved only
      after fixing a real broken-image defect found during runtime validation — see below.
- [ ] Production execution Offers safe scope 63/63 (manifest generation deferred to cutover time).

**Offers — 2026-07-29, same worktree as Places above.** Full detail:
`docs/migration/reviews/offer-publication-result-2026-07-29.md`,
`docs/migration/reviews/offer-publication-manifest-2026-07-28.json`.

```text
OFFERS SAFE-SCOPE LOCAL PUBLICATION:
DATA/LIFECYCLE COMPLETE 63/63

Lifecycle:
DRAFT -> PENDING -> PUBLISHED, via new submitOfferForModeration() (no prior submit path existed for
Offer) + existing approveOffer() — never the privileged direct-publish endpoint.

Safe scope:
63/63 PUBLISHED, 0 DRAFT remaining, 0 CREATE, 0 DELETE, 0 duplicate ids/sourceRecordKeys/slugs,
0 unexpected PENDING rows.

Class H:
28 untouched backlog (never persisted, nothing to touch)

Class I:
8 untouched backlog (same)

PUBLIC RUNTIME:

63/63 HTTP 200 (following the canonical /offers/[slug] -> /[city]/offers/[section]/[slug] redirect).

Canonical runtime:
PASS — Offer's existing code-level canonical implementation confirmed correct against real rendered
HTML (current-worktree server, port 3050, own pwd — see offer-publication-result-2026-07-29.md for
exact provenance) now that Offers are published: 63/63 have <link rel="canonical">, 0/63 id-based.
Integrated RC browser revalidation still required.

Offer media (shared fallback image):
EXPLICIT P1 DEFER — APPROVED, after fixing a real pre-existing defect: the shared fallback image
(public/og-default.jpg — rendered directly in the public content layout as the hero image when no
cover exists, not only as an OG meta tag; also used by Events) was a 49-byte placeholder TEXT file
mislabeled as image/jpeg, causing a genuine broken <img> on every Offer/Event page with no cover.
Replaced with a real 1200x630 JPEG (decodes cleanly, sRGB, no EXIF/embedded data, solid on-brand
color, synthetically generated — not a third-party image; asset-only fix, no code change, not a
media migration/storage write). Re-verified: no broken images, CTA visible/functional, clean
desktop+mobile, 0 console errors.

Authenticated business/admin:
AUTHENTICATED BUSINESS/ADMIN UAT: NOT PERFORMED. Unauthenticated 401 (auth gate present) was
reconfirmed, but that does not prove owner/wrong-owner/admin visibility or lifecycle correctness —
no safe local credentials existed this session to test those without creating a user, resetting a
password, or fabricating a session, all explicitly prohibited. Not declared PASS.

CTA:
CTA UI SMOKE: PASS (both CTAs render, visible, open the expected form).
CTA END-TO-END REQUEST: UAT PENDING (no request was actually submitted; no client-side validation
or notification delivery exercised).

Common rerun:
63/63 ALREADY_PUBLISHED_CANONICAL_AND_INDEX_RESYNC — 0 lifecycle/relation/content writes, but
canonical-table (63 unconditional UPDATEs) and search-index (63 unconditional upserts) writes did
occur, value-neutral (timestamp-only). Not a bare "0 writes".

PRODUCTION:
GATED — unchanged, exact 63-key scope ready, manifest hash deferred to cutover time.
```

**Articles** — out of scope for this session (per explicit instruction):

```text
ARTICLES: COMPLETE
ARTICLE MEDIA: PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS
```

Not revisited without new regression evidence.

**Shared finding (Places + Offers):** `EVENT_SEARCH_INDEX_PUBLICATION_RACE`'s defect class
(fire-and-forget, unordered, unawaited `SearchDocument` upserts in
`extendPrismaWithSearchIndexing`) is structurally applicable to Place/Offer too — same shared
infrastructure. Did not reproduce this session because migration writes bypass that extension
entirely (bare `PrismaClient`, confirmed by reading `scripts/migration-commit-wordpress-db.ts`); it
would only become live once these entities are published through the normal admin/business app flow.
Not re-investigated further (shared infra, its own scoped fix, same posture as the existing Events
backlog entry).

### 5.6 Reviews

- [ ] Подтвердить approved source scope.
- [ ] Users + Places dependency gate.
- [ ] Review vertical slice, golden sample, small batch и rerun.
- [ ] Public rating aggregates validation.

Допустимо перенести Reviews в P1 только явным founder decision.

### 5.7 Redirects, mandatory pages и SEO

**2026-07-29, worktree `mamago2-seo-migration-closure`, branch
`fix/seo-migration-closure`, base `release/integrated-rc`@`5edeaaac`.**

```text
SEO MIGRATION CLOSURE (local technical):
COMPLETE

Canonical P0 (Event/Place/Offer/Article) fixed + tested (5 entity resolvers,
all sharing one validateStoredCanonical origin/path/slug/query-hash check —
Route's pre-existing pattern generalized). Event canonical was completely
absent (buildOgMeta never set alternates.canonical); Place/Offer/Article
trusted a stored seoCanonicalUrl unconditionally (stale mamago.local:3000
rendered verbatim); Offer's write-side sync computed the wrong path entirely
(missing city+section — a stored value could point at a URL that itself
301-redirects). Also found the same unvalidated-canonical bug leaking into
Article JSON-LD (separate code path from generateMetadata, same fix).

City duplicate matrix: Route/Article/Event were already structurally safe
(query-level city filtering). Two real bugs found and fixed: [city]/places/
[slug] re-exported the non-city route unconditionally (ignored its own city
param — every city segment rendered 200), now redirects to the one true
canonical in a single hop; [city]/offers/[section]/[slug] resolved by slug
alone (no city filter) and leaked the URL's (possibly wrong) city into its
own computed canonical, now resolves the offer's real city and redirects on
any mismatch.

Sitemap expanded to 199 directly resolving URLs; individual
Place/Offer/Route/Article/Event URLs were previously absent. Populated using each
entity's own public-visibility predicate + the same canonical resolvers, so
sitemap URLs always match each page's own <link rel="canonical">. Found
live during the dev crawl: content belonging to isActive:false cities
(ratomka/mir/kopische — 4 Places, 7 Offers) was included despite not being
in the static KNOWN_CITY_SLUGS allowlist the WP legacy catch-all uses at
Edge-middleware time — a real canonical-to-redirect defect (7 Offer sitemap
URLs 301'd to /minsk instead of resolving 200). Fixed by excluding
inactive-city content, matching the pre-existing city-hub loop's own filter.
Also removed the sitemap's separate root entry (the public surface's own
middleware unconditionally 307-redirects "/" to the flagship city hub
outside dev/localhost — pre-existing, NODE_ENV=production-specific
behavior only caught by the production-build crawl, not the dev one) —
the flagship city's hub entry now carries priority 1 instead.

Robots/noindex: contract-tested (globalNoindex.test.ts) that meta robots
and X-Robots-Tag can never disagree — both already derive from one flag by
construction, locked with a test.

Redirect manifest (893 rows, scripts/data/wp-redirect-map.json ->
manifest.csv -> next.config.ts): loadRedirectManifest() (the exact function
next.config.ts calls) reports 893/893 structurally valid, 0 issues — no bad
paths, self-redirects, duplicate-source conflicts, unknown-destination
sections, or cycles. validate-redirect-map.ts extended (not rebuilt) with a
disposition classification: EXACT_REDIRECT 12, VALID_HUB_REMAP 21,
P1_START_OR_CONTAINS 24, INVALID_TARGET 836 (destination well-formed, no
live entity yet — expected migration-scope gap: only ~26 Articles and 10
Activity/Event lineage records were ever migrated against 106/717
Article/event-type legacy rows; not a redirect-config defect), COLLISION 0,
CHAIN 0, LOOP 0. One source (/places) collides with a reserved app-root
segment but doesn't hijack a live route (no dedicated /places listing page
exists). 0 redirects to bare "/". Full report:
docs/migration/seo/redirect-audit-summary.md.

Structured data: audited all builders (Article/Event/Place/Route/Offer/
Organization/WebSite/Breadcrumb/FAQ). Organization/WebSite emitted exactly
once (shared layout). No fake ratings (aggregateRating only emitted with a
real DB-backed reviewCount > 0). Full report:
docs/migration/seo/structured-data-audit.md.

Media runtime: MEDIA_STORAGE_ROOT has no env override; per-file symlinks
(not a directory symlink, to avoid touching the git-tracked
storage/uploads/.gitkeep) from this worktree to the main worktree's real
uploads (482 files, source untouched). Closes MEDIA_RUNTIME_PROOF_BLOCKED.
Favicon P2 confirmed fully resolved end-to-end (official asset already
existed, was only missing from this worktree's storage) — no code change
needed. MutationObserver TypeError: attempted reproduction via real browser
across 5 entity page types, not reproduced — classified DEV_ONLY/
NOT_REPRODUCED. Full report: docs/migration/seo/media-runtime-audit.md.

Bounded verifier (scripts/verify-prelaunch-seo.ts + .test.ts, 18 parser/rule
tests, no external dependencies): dev crawl (port 3075, both
SITE_INDEXING_ENABLED on and off) and production build + standalone-server
crawl (port 3076, APP_PUBLIC_URL=https://mamago.by,
REQUIRE_REDIRECT_MANIFEST=1) both report 0 P0 findings and 0 remaining
issues after fixes. Canonical/robots.txt/sitemap confirmed to always show
the real production origin, never localhost, despite being served from
localhost:3076. Full reports: docs/migration/seo/integrated-rc-crawl-summary.md.

Local-only phase: no push, no PR, no merge into release/integrated-rc/dev/
main; release/integrated-rc and all source worktrees confirmed untouched
throughout. The final count is computed from the current base with
`git rev-list --count b30325f5..HEAD` (40 commits after the two redirect-center
closure commits), not a hand-maintained phase estimate.

REMAINING (not blocking local technical closure, explicitly deferred):
- External Search Console/Analytics/backlink baseline — not available
  locally; full SEO Go/No-Go needs it, local technical closure does not.
- Legacy URL -> new URL action manifest CSV (KEEP_200/REDIRECT_301/
  GONE_410/REAL_404/BLOCKED_NOINDEX/MANUAL_DECISION per source row) — the
  disposition classification above covers the same ground at a coarser
  grain; a full per-row manifest with founder-reviewable dispositions for
  the 836 INVALID_TARGET rows was not built this session (P1_START_OR_CONTAINS
  vs REAL_404 vs GONE_410 is a founder/content call, not inferrable from
  code).
- Content/metadata parity report (title/description/H1/OG per entity) not
  built as a separate CSV this session.
- Internal-link audit found one dead link (PlaceHero.tsx -> /places, no
  dedicated listing page exists) — flagged, not fixed (no clear correct
  target without a product decision).
```

- [x] RankMath `exact` redirects subset — covered by the EXACT_REDIRECT/
      VALID_HUB_REMAP disposition classes (33 of 893 rows resolve to live
      content today; the rest are migration-scope gaps, not manifest bugs).
- [x] Redirects на `/` вручную перемапить на релевантные hubs — 0 rows in
      the legacy manifest target bare `/`.
- [ ] Legal/about/contact pages — not audited this session.
- [x] WordPress catch-all — verified it does not swallow valid app routes
      beyond the one known false-positive class (Edge-static
      `KNOWN_CITY_SLUGS` missing DB-only inactive cities, worked around by
      excluding that content from the sitemap rather than touching the
      Edge-time allowlist).
- [x] Canonical/no-trailing-slash и city-scoped URLs — see canonical P0 and
      city-duplicate-matrix summary above.
- [x] Sitemap/robots/noindex launch gate — see sitemap/robots summary
      above; verified in both dev and production-build crawls.
- [x] Redirect manifest minimum и collision audit — 893 rows (fixed actual
      count, not chased toward the old 900 threshold per instruction), 0
      collisions/chains/loops confirmed by two independent checks.

`start`/`contains` redirects остаются P1 (P1_START_OR_CONTAINS, 24 rows).

### 5.8 Product regressions — launch blockers

- [ ] Event появляется в правильном городе и на правильной дате.
- [ ] Event public URL не отдаёт 404.
- [ ] Published Article виден в блоге selected/default city.
- [ ] Auth и migrated-account activation smoke.
- [ ] Business cabinet и admin lifecycle smoke.
- [ ] Public Places/Offers/Events/Articles/Routes smoke.
- [ ] Mobile/desktop critical navigation smoke.

### 5.9 Release candidate и production cutover

- [ ] Freeze production source snapshots. — founder/ops action, not yet declared.
- [x] Production manifests и checksums. — **Users, Articles, Places, Offers
      (+ Place/Offer media) all frozen** as of 2026-07-30:
      [production-entity-manifests-2026-07-29.md](production-entity-manifests-2026-07-29.md),
      raw manifests in `docs/migration/manifests/`. Places manifest is a
      live read-only WordPress-source preview (82 discovered, 78
      SKIP_UNCHANGED, 4 expected UPDATE_CONFLICT — see
      `migration-manual-protected-places` memory); Offers manifest is
      built from the already-reviewed committed local state (63/63
      cross-referenced against active lineage, 0 orphans) since the
      per-record WP-source tool needs a missing `offers-inventory.json`
      snapshot (documented blocker, not silently worked around).
- [x] Fresh production backup и подтверждённый restore procedure —
      **local rehearsal PASS** 2026-07-29 (DB: 13/13 table counts, 507
      constraints, 736 indexes identical; storage: 482 files/38,494,112
      bytes, 0 checksum discrepancies). Production execution still
      `PENDING GO WINDOW` — no production DB/hosting target exists to
      back up yet.
- [ ] Full local production-like rehearsal.
- [ ] Dev metadata-only rehearsal.
- [ ] Cumulative DB/storage delta и forbidden fields/tables audits.
- [ ] Redirect/SEO validation report.
- [ ] Docker Build & Push exact RC SHA — GREEN.
- [ ] Финальный Go/No-Go. — matrix (CONDITIONAL GO, narrowed 2026-07-30 to
      production-environment-only gates):
      [go-no-go-readiness-2026-07-29.md](go-no-go-readiness-2026-07-29.md).
- [ ] Последовательная production migration. — runbook + production target
      worksheet:
      [production-migration-runbook-2026-07-29.md](production-migration-runbook-2026-07-29.md).
- [ ] Post-migration validation и разрешённые idempotency reruns.
- [ ] DNS cutover, noindex switch, monitoring/rollback decision window. —
      plans drafted:
      [dns-cutover-plan-2026-07-29.md](dns-cutover-plan-2026-07-29.md),
      [launch-monitoring-plan-2026-07-29.md](launch-monitoring-plan-2026-07-29.md),
      [launch-window-checklist-2026-07-30.md](launch-window-checklist-2026-07-30.md).
      Activation canary formalized with founder input fields, batch
      sequence proposal, and exact preview/send/reconcile commands
      (documented, not run):
      [activation-canary-plan-2026-07-29.md](activation-canary-plan-2026-07-29.md).
      Bounce handling: manual reconciliation decided (no webhook or
      bounce/complaint schema states exist today — confirmed by code
      inspection, not assumed).

---

## 6. FULL PRODUCT ACCEPTANCE / UAT — обязательный P0 gate

Полная матрица, evidence contract и журнал выполнения:
[full-product-acceptance.md](../prelaunch/full-product-acceptance.md).

```text
Full product acceptance / UAT: NOT STARTED
Pass 1:                       NOT STARTED
P0 defects:                   UNKNOWN
Pass 2:                       NOT STARTED
Founder acceptance:           NOT RECORDED
```

Source document: `docs/prelaunch/full-product-acceptance.md`.
Authenticated BUSINESS_OWNER/MODERATOR/ADMIN execution is pending; CTA
request-to-business receipt and response is pending end to end. UAT Pass 1
must run on the integrated RC exact SHA. Older isolated browser proofs do not
replace integrated-RC UAT evidence.

Техническая готовность, успешная миграция и зелёный CI не являются
достаточным доказательством готовности к запуску. Перед Go/No-Go должны быть
вручную пройдены критичные пользовательские, бизнесовые и административные
сценарии от начала до конца.

Запуск запрещён при:

- открытом P0 defect;
- непройденном P0 user journey;
- неизвестном результате критичного сценария;
- расхождении UI, API и состояния БД;
- недоказанной production rollback/restore процедуре.

### UAT PASS 1 — full critical-flow acceptance

Цель: найти реальные дефекты на сквозных пользовательских сценариях.

После Pass 1:

- зарегистрировать дефекты и классифицировать P0/P1/P2;
- исправить все P0;
- P1 исправить либо получить явный founder defer;
- P2 отправить в backlog.

### UAT PASS 2 — regression and founder acceptance

Цель: повторно пройти все критичные flows после исправлений.

Launch gate:

- 0 открытых P0 defects;
- нет неизвестных `BLOCKED` P0 scenarios;
- все P1 имеют fix либо явное defer-решение;
- production-only gates имеют подтверждённый план выполнения;
- founder acceptance recorded.

Если после Pass 2 исправлялись критичные flows, обязателен targeted Pass 3
по затронутым областям и их зависимостям.

Обязательный порядок фаз:

```text
migration completion
→ content/public validation
→ full product UAT Pass 1
→ defect fixes
→ UAT Pass 2
→ RC rehearsal
→ production Go/No-Go
→ cutover
```

### P0 launch journeys

1. `P0-J1` — новый пользователь регистрируется, входит и использует публичный продукт.
2. `P0-J2` — мигрированный пользователь активирует аккаунт и входит.
3. `P0-J3` — BUSINESS_OWNER создаёт Business → Place → Offer и отправляет на модерацию.
4. `P0-J4` — ADMIN/MODERATOR проверяет и публикует контент.
5. `P0-J5` — опубликованная сущность появляется в правильном городе и discovery.
6. `P0-J6` — пользователь открывает сущность и отправляет заявку/бронирование.
7. `P0-J7` — бизнес получает заявку и отвечает.
8. `P0-J8` — пользователь получает ответ и видит актуальный статус.
9. `P0-J9` — Event корректно работает с датами, sessions и завершением.
10. `P0-J10` — основные public/admin/business flows работают на mobile и desktop.
11. `P0-J11` — старые WordPress URL корректно перенаправляются.
12. `P0-J12` — backup, restore, RC build и production migration gates подтверждены.

Birthday/custom-request не включён в P0 автоматически: реализация присутствует
частично (`Occasion`, birthday discovery, Direct/editorial request surfaces), но
полный обещанный пользователю request → matching → proposals → selection flow
не доказан. Нужен founder decision: `P0 BLOCKER` либо `P1 DEFER`.

Reviews реализованы в schema/admin/public surfaces, но migration и сквозная
приёмка не начаты: founder decision `P0` либо явный `P1 DEFER` остаётся gate.

Production-ready пользовательский checkout/payment callback flow кодом не
подтверждён. Billing ledger и административные credit/debit/refund операции не
считаются таким flow. Нужен founder decision: payments вне launch P0 либо
отдельный P0 blocker; реальные платежи в UAT запрещены.

---


## 7. Blockers classification — confirmed OPEN P0 vs decision/backlog

**P0 launch blockers resolved locally; integrated RC revalidation required:**

```text
1. EVENT_SEARCH_INDEX_PUBLICATION_RACE — RESOLVED LOCAL.
   Per-entity indexing is now ordered and the final publication index is strict + awaited.
   Event/Place/Offer fixture regressions pass; INTEGRATED RC REVALIDATION REQUIRED.
   Historical root cause:
   fire-and-forget, unordered SearchDocument upserts raced on
   any entity publish flow (extendPrismaWithSearchIndexing). Reproduced twice for Events; confirmed
   structurally applicable to Place/Offer's own app-level publish flow too (not reproduced there —
   this session's Place/Offer publications went through it correctly, see §5.5 — but the shared
   infra defect is unfixed). Fix: one deterministic reindex after the full publish transaction,
   replacing the two independent dispatches, OR an ordering/dedup queue in the indexer. Shared
   infra, its own scoped slice. See §5.3 for full reproduction detail.
2. ROUTE_CANONICAL_METADATA_MISSING — RESOLVED LOCAL.
   Published PUBLIC Routes emit one absolute stored-or-slug-fallback canonical; stale/invalid
   stored origins fall back safely. DRAFT/non-public Routes emit no public canonical.
   INTEGRATED RC REVALIDATION REQUIRED. Historical root cause:
   RouteDetailPage's generateMetadata() never read
   Route.seoCanonicalUrl; confirmed via browser smoke, pre-dates the Routes closure session, not
   fixed there. (Place's equivalent defect, PLACE_CANONICAL_METADATA_MISSING, IS fixed as of this
   session — RESOLVED LOCAL, integrated RC revalidation required — but the Route one remains open;
   these are two separate fixes to two separate files, not one shared change.) Fix: read
   Route.seoCanonicalUrl into alternates.canonical, same pattern as the now-fixed Place page.
3. ROUTE_MAP_WITHOUT_VALID_COORDINATES — RESOLVED LOCAL.
   MAP HIDDEN/REPLACED BELOW 2 VALID DISTINCT POINTS. COORDINATE BACKFILL NOT PERFORMED.
   INTEGRATED RC REVALIDATION REQUIRED. Historical root cause:
   0/90 RouteStops have lat/lng/address populated, so the
   public map widget renders a meaningless line across the country on every Route page. Minimum
   required fix: hide or replace the map when fewer than 2 valid coordinate points exist for a
   Route (a small, bounded rendering-guard change) — this alone resolves the P0 (a broken/misleading
   map is the launch-blocking defect, not the absence of coordinates itself). Full RouteStop
   coordinate extraction/backfill from the embedded "Координаты: ..." source text remains a
   separate, valuable, but non-blocking opportunity — it is not a required condition for closing
   this P0.
```

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` remains mandatory for
this slice and all earlier critical runtime proofs whose exact checkout
provenance was not established.

Side findings from the bounded Route runtime audit:

- `ROUTE_RATINGS_PARAMS_NOT_AWAITED — OPEN P1`: the automatically mounted
  rating block calls `GET /api/routes/ratings/[routeId]`; its Next 16 handler
  reads Promise-based `params` synchronously and returns 400/default counts.
  The Route HTTP 200, canonical, map guard and main content remain functional.
  Proposed next fix: await typed Promise params in the GET handler and add the
  existing route-handler test pattern. Not fixed in this P0 slice.
- `MISSING_FAVICON_ASSET — OPEN P2`: `/favicon.ico?...` redirects to
  `/api/media/file/1783033874844-9q4z9h5fueo-favicomamago.webp?...`, which is
  absent from this worktree's local upload storage and returns 404. This is a
  branding/static cosmetic request; it does not affect layout, canonical,
  indexability or primary content. Not fixed in this P0 slice.

**Decision/backlog (require a founder decision; not automatic launch blockers — may remain excluded/deferred by explicit approval):**

- Mogilev City onboarding (`wordpress-db:routes:46963`, Route `marshrut-mogilev`) —
  City creation/configuration, slug, country, discovery, SEO, sitemap, redirects,
  public smoke; Route stays DRAFT until this is a separate founder-approved decision.
- Route stop images (`ROUTE_STOP_MEDIA_POLICY_METADATA_SKIPPED`) — media policy
  decision, not imported for any of the 14 Routes; separate media gate if revisited.
- RouteStop geo backfill (full extraction from source text, beyond the P0's minimum map-hiding fix
  above) — separate migration slice, valuable but non-blocking.
- Past Events и Event images.
- 63 expired Activities и связанная authorship — `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- `wordpress-db:events:64159` disposition (hard-exclude vs. leave PENDING indefinitely) — may
  remain unpublished by founder-approved exclusion.
- Noncanonical Offer class I (8) — may remain excluded by founder-approved exclusion.
- Offer class H (28) без Place relation — may remain excluded by founder-approved exclusion.
- Place `32409`/`60742` `CITY_BLOCKED` — may remain non-public (still `PENDING`) by
  founder-approved exclusion, pending real city evidence.
- Offer media (cover/gallery import) — genuinely unimplemented (explicit code-level gate, not a
  regression); `OFFER_MEDIA_DEFERRED_P1` already approved this session for the current 63-Offer
  scope (see §5.5), conditional on the layout/CTA checks that were performed — a real P0
  implementation remains a separate, explicitly-deferred opportunity, not a blocker for what's
  already published.
- Full public profile content classification.
- RankMath `start`/`contains` redirects.
- Historical bookings, WooCommerce/LatePoint и social feeds.
- Collections и редкие custom post types.

---

## 8. Раздельная оценка готовности

Это операционная оценка, не календарное обещание:

```text
Implementation readiness:  ~95% — critical surfaces и guards существуют;
                            confirmed open product P0 defects: 0.
Migration readiness:       ~85% — local scope и manifests закрыты;
                            production execution и production audits остаются.
Product UAT readiness:      ~75% — desktop, automated auth/business/admin и
                            public smoke пройдены; mobile и owner UI остаются.
Production readiness:      ~30% — activation rehearsal готов, но backup/restore,
                            RC exact-SHA, providers и production gates не пройдены.
Overall launch readiness:   ~90% technical RC / ~45% launch — технический RC
                            зелёный, но production gates всё ещё не пройдены;
                            это не среднее арифметическое остальных оценок.
```

Почему остаток всё ещё крупный: самые рискованные Users identity/ownership writes, Events tail и Routes review уже закрыты, но впереди media/SEO/regressions и весь RC/cutover цикл.

Крупные обязательные launch gates:

1. Integrated-RC technical and representative runtime verification.
2. SEO MIGRATION CLOSURE.
3. Full product UAT Pass 1, defect cycle, Pass 2 and founder acceptance.
4. Users production activation delivery Go/No-Go.
5. Reviews and remaining media scope: implementation or explicit founder P1 defer.
6. Redirects/pages/product regression and production cutover rehearsal.

Events, Routes, Places/Offers safe publication, Articles, Users migration and the three local P0 fixes are complete; they require integrated-RC revalidation, not reopening.

Ориентир по объёму работы:

```text
примерно 12–18 связных slices/PR до cutover,
если Reviews и часть media будут явно перенесены в P1;
больше — если весь перечисленный media/reviews scope остаётся обязательным P0.
```

---

## 9. Следующее одно действие

```text
Phase: PRODUCT REGRESSION / RC READINESS — TECHNICAL PASS
Completed 2026-07-29 on exact source SHA
`17c9dd29787bbab0462ca581c546ca83a5dc2e73`: production build, built-artifact
smoke, public discovery, desktop Admin/Redirect Center, automated auth,
activation, ownership/access/lifecycle, typecheck and warmed SEO crawl. Confirmed
open product P0 defects: 0. Full evidence:
`docs/migration/rc-product-regression-2026-07-29.md`.

Next single action: FINAL GO/NO-GO PREPARATION. First attach manual mobile and
authenticated BUSINESS_OWNER end-to-end evidence to this exact RC lineage;
then assemble founder acceptance and owners/timestamps/proof for the existing
production-only gates. Do not return to already-closed migration entities or
SEO items without new regression evidence.

Out of scope for this phase: UAT Pass 1, production writes/email, DNS, Search
Console submission, payments, CITY_BLOCKED Places disposition, Event 64159
disposition, Mogilev onboarding, and deferred P1 implementation (favicon —
already closed; MutationObserver — DEV_ONLY/NOT_REPRODUCED; legal/about/
contact page audit; content/metadata parity CSV; per-row legacy-URL action
manifest for the 836 INVALID_TARGET redirect rows; PlaceHero.tsx dead
/places link).
```

```text
Phase: FINAL GO/NO-GO PREPARATION — readiness package assembled
2026-07-29, worktree mamago2-product-regression-rc, branch
codex/product-regression-rc-20260729, on RC source SHA
17c9dd29787bbab0462ca581c546ca83a5dc2e73 (docs-only HEAD, verified no code
diff to that SHA before starting).

Both mandatory evidence gaps named above are now closed locally:
- Mobile visual UAT at 390x844 and 412x915 across public/auth/business/admin
  surfaces — no page-level horizontal overflow found; one console error
  ("Rendered more hooks than during the previous render") observed on
  client-side navigation under `next dev` + React StrictMode, plausibly a
  dev-only double-invocation artifact (not yet re-verified under a
  production build in this session — flag for a quick targeted check before
  final sign-off); the already-known Admin Routes column-clipping P1 and
  external-Unsplash-fallback P1 both reproduced as expected, no new P0.
- BUSINESS_OWNER UI end-to-end, via a disposable local fixture (created and
  fully deleted after the test, zero residue, counts diffed before/after):
  own-Business scoping confirmed, edit → save correctly created a PENDING
  `PlaceRevision` (moderation lifecycle working), cross-tenant edit URL
  access was safely redirected to the actor's own list (no data leak), a
  plain `USER` account was redirected away from `/business`, ADMIN/BUSINESS
  fixture roles unchanged after testing.

New this session, added to the readiness package:
- `production-entity-manifests-2026-07-29.md` — manifest index consolidating
  already-confirmed counts (Users 578, Articles 2 frozen with hashes; Places
  and Offers explicitly still deferred to cutover time, per §5.5).
- `production-migration-runbook-2026-07-29.md` — synthesized cross-entity
  execution order (Users → Businesses → Places → Offers → Routes → Events →
  Articles → Redirects → Media → Activation canary), preflight table with
  explicit gaps flagged (no production DB/hosting target named anywhere in
  the corpus — founder must supply).
- `activation-canary-plan-2026-07-29.md` — formalizes the existing delivery
  plan's canary step into PASS/STOP tables; recipients still
  FOUNDER_SELECTION_REQUIRED, batch size still TBD by founder, bounce-webhook
  gap unchanged.
- `dns-cutover-plan-2026-07-29.md` — new; no equivalent existed. Built on the
  existing noindex mechanism (`SITE_INDEXING_ENABLED` /
  `SITE_NOINDEX_FORCE` / `SITE_NOINDEX_DEFAULT`, fail-safe default noindex)
  and `ProductionMigrationGuard`.
- `launch-monitoring-plan-2026-07-29.md` — new; first-15-min/hour/24h
  checklist using existing tooling (Sentry, redirect validator, activation
  audit), no new monitoring platform introduced.
- Local DB backup/restore rehearsal: `pg_dump` → disposable database →
  13/13 key table counts, 507 constraints, 736 indexes, role distribution
  and published-content counts all identical; `prisma migrate status`
  reports up to date against the restored copy; disposable database
  dropped. PASS.
- Local storage/media restore rehearsal: 482 files, 38,494,112 bytes,
  per-file SHA-256 manifest; copied to a disposable directory, re-hashed,
  0 discrepancies; disposable copy deleted. PASS.

Next single action: FOUNDER FINAL APPROVAL of the exact RC SHA and launch
window — production backup execution, production entity manifests for
Places/Offers, canary recipient selection, DB/hosting target confirmation,
and the rollback-trigger threshold are the remaining explicit founder
inputs before a CONDITIONAL GO can become a GO. See
`go-no-go-readiness-2026-07-29.md` for the full decision matrix.
```

```text
Phase: FINAL GO/NO-GO PREPARATION — remaining conditional gates closed
2026-07-30, same worktree/branch/RC SHA. Re-confirmed immutable: 0
non-docs diff since 17c9dd29787bbab0462ca581c546ca83a5dc2e73 (3 docs-only
commits on top, all under docs/migration/).

Closed this session:
- Places manifest FROZEN via a single bounded read-only WordPress-source
  preview (`migration:preview:wordpress-db --entity place
  --allow-remote-readonly`, zero writes, confirmed by the script's own
  docstring): 82 discovered, 78 SKIP_UNCHANGED, 4 UPDATE_CONFLICT (437,
  895, 5389 — previously known — plus 43023 "Атмосфера", newly confirmed,
  same TARGET_MODIFIED_AFTER_IMPORT pattern; `migration-manual-protected-
  places` memory updated). Hash and raw manifest in
  `docs/migration/manifests/places-preview-2026-07-30.json`.
- Offers manifest FROZEN from the already-reviewed committed local state
  (63/63 PUBLISHED Offers cross-referenced against active OFFER lineage,
  0 orphans) — the per-record WP-source tool
  (`migration:preview:offer-snapshot`) needs a pre-existing
  `offers-inventory.json` snapshot that has no generator and doesn't
  exist in this worktree; documented as an explicit blocker rather than
  silently worked around. Hash and raw manifest in
  `docs/migration/manifests/offers-local-manifest-2026-07-30.json`.
- Production-build console re-check: reused the existing `.next` build
  (unchanged since the RC SHA), ran `next start` on a separate port,
  repeated the exact StrictMode-error repro 5 times across 3 pages at
  390×844 — 0 console errors. Closed as
  `NOT_REPRODUCED_IN_PRODUCTION_BUILD`.
- Bounce handling decided: code inspection confirmed no `svix` dependency,
  no Resend webhook route, and `ActivationDeliveryAudit.status` has no
  bounced/complained/delivered states in its enum today — Option A
  (webhook) is not just "unwired," it doesn't exist. Decision: Option B,
  manual reconciliation against the Resend dashboard, gated batch-by-batch.
- All 4 deferred content items (Places 32409/60742 CITY_BLOCKED, Event
  64159 EXPIRED_SOURCE_PENDING, Route 46963 Mogilev CITY_BLOCKED) given
  explicit recommendations (3× EXCLUDE_FROM_P0, 1× MOVE_TO_P1) — none left
  in an undefined state.
- New docs: `launch-window-checklist-2026-07-30.md` (one-page day-of
  sequence); production target worksheet added to
  `production-migration-runbook-2026-07-29.md` §0 (all rows
  `FOUNDER_INPUT_REQUIRED`, none guessed).

Verdict updated: CONDITIONAL GO, narrower than 2026-07-29 — every gate
closeable from local/dev evidence or read-only source access is now
closed; only production-environment inputs remain (hosting/DB/storage
targets, canary recipients, batch-size approval, rollback threshold, and
founder sign-off on the deferred-content recommendations and the
manual-reconciliation bounce approach).

Next single action: FOUNDER FINAL APPROVAL of the exact RC SHA and launch
window, plus the 9 remaining founder inputs in
`go-no-go-readiness-2026-07-29.md`. No production actions were performed.
```

```text
Phase: PHOENIX OFFERS DOMAIN HASH TRANSITION — PLAN/TEST COMPLETE, OFFERS BLOCKED
2026-07-31, branch feat/phoenix-offers-artifact, baseline 779087b7.

A bounded read-only WordPress capture returned the exact committed 63 Offer
sourceRecordKeys (missing/extra/duplicates 0/0/0); raw source stayed mode 0600
under /private/tmp and was not committed. OfferDomainHashV2 now separates
domain identity from OfferExecutionPolicyHashV1. Frozen predecessor lineage
matched 63/63; only 16/63 fresh legacy NONE hashes matched. Full field-level
LOCAL reconciliation produced 0 lineage-only candidates, 0 safe whitespace
updates, and 63 unsupported multi-field conflicts (SEO + lifecycle on all;
additional slug/media/schedule/content subsets). Offers remains BLOCKED with
OFFERS_DOMAIN_HASH_TRANSITION_PENDING_DISPOSITIONS. No migration/database/media
writes, downloads, DEV/PROD access, deploy, or apply occurred.

Next single action: approve explicit lifecycle/SEO/slug/media/schedule update
contracts or exclusions for the 63 conflict records; do not perform a lineage
hash transition until every target-domain mismatch has a disposition.
```

```text
Phase: PHOENIX FULL PROD MIGRATION PREFLIGHT — BLOCKED (no writes)
2026-08-14, branch dev@8211d836 (= origin/dev, clean tree).

Read-only preflight of legacy mamaGo.by → mamaGo 2.0 PROD. Phoenix was not
started. WordPress was not modified. PROD DB/media/DNS/indexing were not
changed. Disk headroom BACKLOG-086 closed DONE (80G LV, 61G free).

Live WP (2026-08-14): Places publish 82; Events publish 9 (7–8
future/active); Articles publish 117; Routes 14; hb-programs 90 +
services 1; Users 580; attachments 9703; RankMath redirects 156;
Voxel post_reviews 25; uploads 23G / 136929 files.

PROD before: City 3, User 2 (ADMIN+USER ACTIVE), all content/ledger/
media tables 0. Image prod-158 / OCI 86154ddc. 231 Prisma migrations
applied (+1 historical rolled-back row).

Verdict: BLOCKED. P0=0. P1s filed BACKLOG-099..104 (user CLI local-only,
PRODUCTION profile vs noindex, phoenix-release stub + stale freeze,
Reviews missing, FULL MEDIA gaps, operator-Mac topology because the
shared host cannot reach WP). P2/P3: BACKLOG-105..107.

Next single action: owner decisions on P1s (especially Users-on-PROD
gate, Reviews in/out of scope, Article 2-vs-117 scope, Offer/Route/
logo/profile media exceptions) — then a separate owner-controlled
execution prompt. Do not run Phoenix until that approval.
```

```text
Phase: PHOENIX FULL PROD MIGRATION READINESS — code+tests (no writes)
2026-08-14, continuation of the preflight above.

Closed P1s in code: BACKLOG-015 Offer FULL media, BACKLOG-099 PROD-safe
user gate (`migration:user:live`), BACKLOG-100 PROD_IMPORT / noindex
decoupling, BACKLOG-101 commit-CLI is the path, BACKLOG-102 Reviews
runner, BACKLOG-103 FULL media gaps except Business/User profile
(BACKLOG-108 P2), BACKLOG-104 Mac-side topology documented.

Do not run FULL PROD migration from this handoff. Owner-controlled
execution is a separate prompt.

PHASE L note: after the code change, live WP SSH to 134.17.16.78:22
timed out from the operator Mac (HTTP https://mamago.by still 200).
Fresh `migration:scope:wordpress-db` inventory was therefore not
written. Re-run the scope CLI before the owner-controlled import.
```
