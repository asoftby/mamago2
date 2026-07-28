# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

**Обновлено:** 2026-07-28 (Places/Offers production readiness and media closure session)  
**Base:** `dev` @ `b30325f5` — PR #93 merged (via `feat/events-tail-import` @ `525aedec`, then `feat/routes-review-publication` @ `657c6c59`)  
**Текущая фаза:** `PLACES/OFFERS production readiness and media closure — DATA/MIGRATION closure complete for both entities, exact status/classification matrix built for all 83 Places, 2 writer regressions found+fixed+tested, publication path for both entities identified as a founder decision, not attempted unilaterally.` Places: 83 rows (82 WP-lineage + 1 pre-existing non-migration seed), 0 CREATE needed, 0 duplicates/orphans. Exact matrix (`docs/migration/reviews/place-status-classification-matrix-2026-07-28.md`): 5 `PUBLISHED` (4 lineage with known protected manual edits, already verified valid, + 1 seed), 76 `READY_FOR_EDITORIAL_PUBLICATION_REVIEW` (content matches source exactly, but that proves content parity, not publication readiness — no bulk review/publish tool exists for Place yet), 2 `CITY_BLOCKED` (no cityId, source itself has none either — real content gap, not drift), 0 requiring manual content review. Offers: 63/63 safe-canonical scope reconfirmed intact (matches 2026-07-22 closure), a real `OfferCommitWriter` bug (silently dropped `cityId`) found, fixed, and backfilled for all 63; all 63 remain `DRAFT` (no existing lifecycle path currently moves migration-created Offers through `approveOffer`'s PENDING-only gate — a capability gap, not a reason to mass-publish via the privileged direct-publish endpoint). Offer/Place media: Place's existing 3-record LOCAL/DEV sample policy re-confirmed working; Offer media import remains entirely unimplemented (explicit code-level gate, not a regression) — founder Option A (P0 slice) vs Option B (P1 defer) framed, not decided. New P0: `PLACE_CANONICAL_METADATA_MISSING` (same class as the already-backlogged Route one); Offer canonical is `IMPLEMENTED_IN_CODE, PUBLIC RUNTIME PROOF PENDING` (correct in code, unverifiable live until an Offer is actually published). See §5.5 for full detail.  
**Текущий кандидат для следующего шага:** Founder decisions — (1) Place publication universe/bulk lifecycle path for the 76 ready-for-review Places, and disposition of the 2 city-blocked ones; (2) Offer DRAFT→PENDING→PUBLISHED lifecycle path (submit-for-moderation step doesn't exist yet); (3) Offer media Option A (P0) vs Option B (P1 defer). Then: `PLACE_CANONICAL_METADATA_MISSING` fix before Place bulk publication, Article content/media closure, Reviews defer decision, Redirects/SEO (см. §5.5/§5.6/§5.7); отдельно: founder decision on `wordpress-db:events:64159` disposition, `EVENT_SEARCH_INDEX_PUBLICATION_RACE` (P0 backlog, same class now confirmed applicable to Place/Offer too), Mogilev City onboarding backlog, Route + Place canonical-link fixes, RouteStop coordinate backfill (см. §5.4/§6)  
**Текущий gate:** `PLACES_OFFERS_CLOSURE_PARTIAL` (data/migration closure done, exact matrix built; publication + media are founder-gated, not blocking further prelaunch work)

> Note: этот файл написан из ветки `feat/places-offers-production-media-closure`
> (worktree `mamago2-places-offers-closure`, branched off
> `feat/routes-review-publication` @ `657c6c59`, which itself branches off
> `feat/events-tail-import` @ `525aedec`, which branches off `dev`).
> Отдельная ветка `fix/admin-article-preview-routing` независимо содержит ещё
> не смерженные обновления по Users manual/privileged closure и production
> activation delivery readiness (§3.4a/§3.9/§3.9a там) — при мерже веток в
> `dev` эту шапку и §2/§5/§7/§8 нужно свести вручную.

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
| Places | DATA AND MIGRATION CLOSURE COMPLETE — 83/83 accounted for (82 lineage + 1 non-migration seed), 0 CREATE/duplicate/orphan, 1 writer regression fixed. Publication NOT complete: 5 published, 76 ready-for-editorial-review, 2 city-blocked, 0 requiring manual content review | Founder decision: publication universe/bulk lifecycle path for the 76; disposition of the 2 city-blocked; `PLACE_CANONICAL_METADATA_MISSING` fix; production execution |
| Offers | SAFE SCOPE DATA CLOSURE COMPLETE 63/63; `cityId` writer bug fixed + backfilled. Publication NOT complete: all 63 DRAFT, no defined lifecycle path | Founder decision: DRAFT→PENDING→PUBLISHED lifecycle path (submit-for-moderation step doesn't exist); media Option A (P0) vs Option B (P1 defer); production execution; backlog H/I (28/8, unchanged) |
| Routes | **COMPLETE** — 14/14 lineage accounted for, 13/13 reviewed Routes PUBLISHED, 1 CITY_BLOCKED (Mogilev) kept DRAFT | Mogilev City onboarding backlog (см. §5.4); Route images remain intentionally not imported (media policy) |
| Events | **COMPLETE** — 10/10 lineage records accounted for, 8/8 publishable eligible PUBLISHED + 1 protected legacy PUBLISHED | Founder disposition for 1 EXPIRED source (`64159`, left PENDING); `EVENT_SEARCH_INDEX_PUBLICATION_RACE` (P0, backlogged, see §5.3); Event images (P1, frozen out-of-scope) |
| Users clean migration | LOCAL COMPLETE 564/564 | Production import и activation delivery |
| Users activation architecture | COMPLETE | Production email provider, rehearsal и delivery Go/No-Go |
| Business-linked Users | **FULLY CLOSED** | 38/38 ownership, 38/38 `BUSINESS_OWNER`, backlog 0 |
| Users manual/privileged | PLANNED 15 | 5 founder decisions, 9 exclusions, 1 existing ADMIN unchanged |
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

- [ ] Подтвердить dispositions для 15 manual/privileged users:
  - 1 existing ADMIN оставить неизменным;
  - 9 exclusions подтвердить;
  - 5 `REQUIRES_FOUNDER_DECISION` решить.
- [ ] Интегрировать и проверить production email provider.
- [ ] Сохранить LOCAL/DEV external delivery hard-disabled.
- [ ] Подготовить production User manifest и checksums.
- [ ] Провести production-like rehearsal Users + activation.
- [ ] Подготовить controlled activation delivery после Go/No-Go.
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
- [ ] Founder decision: Place publication universe and bulk lifecycle path for the 76
      `READY_FOR_EDITORIAL_PUBLICATION_REVIEW` Places (no bulk review/publish tool exists for Place yet).
- [ ] Founder decision: disposition of the 2 `CITY_BLOCKED` Places (assign city with real evidence,
      or leave excluded indefinitely).
- [ ] `PLACE_CANONICAL_METADATA_MISSING` fix (frontend, scoped slice) — before any Place bulk publication.
- [ ] Production execution Places (manifest generation deferred to cutover time, not frozen now).

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
- [ ] Founder decision: Offer DRAFT→PENDING→PUBLISHED lifecycle path (submit-for-moderation step
      does not exist yet — a capability gap, not a reason to use the privileged direct-publish
      endpoint for a mass move).
- [ ] Founder decision: Offer media — Option A (P0 minimal slice) or Option B (explicit P1 defer).
- [ ] Production execution Offers safe scope 63/63 (manifest generation deferred to cutover time).

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

- Mogilev City onboarding (`wordpress-db:routes:46963`, Route `marshrut-mogilev`) —
  City creation/configuration, slug, country, discovery, SEO, sitemap, redirects,
  public smoke; Route stays DRAFT until this is a separate founder-approved decision.
- Route stop images (`ROUTE_STOP_MEDIA_POLICY_METADATA_SKIPPED`) — media policy
  decision, not imported for any of the 14 Routes; separate media gate if revisited.
- Route detail page canonical `<link>` — `RouteDetailPage`'s `generateMetadata()`
  never reads `Route.seoCanonicalUrl`; found via browser smoke, pre-dates this
  session. Small, isolated frontend fix, not a migration/data issue.
- RouteStop geo backfill — 0/90 RouteStops (all 14 Routes) have `lat`/`lng`/`address`
  populated even though source notes contain embedded coordinates as text; the
  public map widget renders a meaningless line as a result. Pre-existing gap from
  the original WordPress Route import, found via browser smoke. Separate migration
  slice (parse "Координаты: ..." out of source notes into RouteStop columns).
- Past Events и Event images.
- 63 expired Activities и связанная authorship — `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- Noncanonical Offer class I.
- Offer class H без Place relation.
- Draft/unpublished long-tail bulk publication (includes: 76/83 `READY_FOR_EDITORIAL_PUBLICATION_REVIEW`
  Places with no bulk review/publish tool yet [+2 separately `CITY_BLOCKED`, excluded from that
  universe], and all 63 safe-canonical Offers stuck `DRAFT` since `approveOffer()` only accepts a
  PENDING→PUBLISHED transition — both found 2026-07-28, both founder decisions, see §5.5 and the
  exact matrix in `docs/migration/reviews/place-status-classification-matrix-2026-07-28.md`).
- Place detail page canonical `<link>` — `PlaceDetailPage`'s `generateMetadata()` never reads
  `Place.seoCanonicalUrl` (same defect class as the Route one above, found via browser smoke
  2026-07-28 against all 5 published Places). Small, isolated frontend fix, not a migration/data issue.
- Offer media (cover/gallery import) — genuinely unimplemented (explicit code-level gate, not a
  regression), separate media gate if revisited; recommendation is an explicit P1 defer, same posture
  as Article media.
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

Почему остаток всё ещё крупный: самые рискованные Users identity/ownership writes, Events tail и Routes review уже закрыты, но впереди media/SEO/regressions и весь RC/cutover цикл.

Крупных P0-блоков остаётся **7**:

1. Editorial closure двух Articles: city/geo, publication, blog visibility и cover/media decision.
2. Users production activation (real bulk send, gated on final Go/No-Go).
3. Places/Offers/Article content и media closure.
4. Reviews либо явный P1 defer.
5. Redirects/pages/SEO.
6. Product regression suite.
7. RC rehearsal и production cutover.

Закрыто с прошлой ревизии: Events tail (COMPLETE), Routes review/publish (COMPLETE,
13/13 published, Mogilev correctly excluded pending City decision).

Ориентир по объёму работы:

```text
примерно 12–18 связных slices/PR до cutover,
если Reviews и часть media будут явно перенесены в P1;
больше — если весь перечисленный media/reviews scope остаётся обязательным P0.
```

---

## 8. Следующее одно действие

```text
Phase: ROUTES review/publication — CLOSED. Next: Places/Offers/Article content
  и media closure (см. §5.5)
Prerequisite (COMPLETE): 14/14 Route lineage records accounted for; 86
  RouteStop notes editorially reviewed (ACCEPT_SHORT 2, KEEP_FULL 84,
  EDIT_SHORT 0, BLOCKED 0), 12 mojibake-only RouteStop.note rows corrected,
  0 unrelated writes; 13/13 READY Routes PUBLISHED via existing
  applyRouteReviewPlan tooling (guarded transaction, stop-on-first-error);
  SEO canonical synced for all 13 via existing syncRouteCanonical(); Mogilev
  (wordpress-db:routes:46963, cityId null, no matching City exists) moved
  DRAFT via the same status-only operation the real admin
  PATCH /api/admin/routes/[id] { publish:false } endpoint performs, content/
  stops/media/slug/lineage preserved byte-identical; idempotency rerun
  13/13 SKIPPED, 0 writes; cumulative audit clean (0 duplicate lineage/slug,
  0 orphan RouteStops, 0 CREATE, 0 DELETE).
Two open items carried over from Events, neither blocks the next phase:
  (1) wordpress-db:events:64159 needs a founder disposition decision
  (hard-exclude vs. leave PENDING indefinitely); (2)
  EVENT_SEARCH_INDEX_PUBLICATION_RACE needs its own scoped fix (shared
  search infra, not Events-specific — Routes' synchronous
  syncRouteCanonical()-triggered index upsert did NOT reproduce the race in
  this single-threaded batch, but that is not proof it's absent under
  concurrent load; still backlogged, not re-investigated this session).
New open items from this session: (1) Mogilev City onboarding backlog (see
  §5.4 and §6) — requires a separate founder-approved geography-expansion
  decision before this Route can publish; (2) Route detail page canonical
  `<link>` missing (see §6), isolated frontend fix; (3) RouteStop geo
  backfill (see §6), separate migration slice.
Live in-browser smoke: DONE, against the already-running main-repo dev
  server (same shared local DB) since this worktree's own server could not
  bind (Next.js dev lock shared with the main repo directory). 13/13 URLs
  200, Mogilev 404 confirmed with real content, discovery listing exactly
  13 with correct stop-count sum (86), 0 console/hydration errors,
  mobile+desktop render clean. Two pre-existing gaps found in the process
  (items 2/3 above) — not introduced by this session, not blocking.
No migration writer/engine code changes were needed for Routes — 100%
  existing, already-reviewed tooling reused (buildRouteEditorialReview,
  applyRouteReviewPlan, syncRouteCanonical). One bounded one-off script was
  used to run the canonical sync + Mogilev unpublish and then deleted after
  execution — its action is fully captured in this checklist and in
  docs/migration/reviews/route-*-2026-07-28.{json,md}, so keeping the
  script itself added no further audit value and it had no reusability
  (hardcoded IDs from this one run).
```

**2026-07-28 (later same day) — Places/Offers production readiness and media
closure.** Worktree `mamago2-places-offers-closure`, branch
`feat/places-offers-production-media-closure`, base
`feat/routes-review-publication`@`657c6c59` (Routes/Events commits confirmed
present in log). Full detail across ten proof docs:
`docs/migration/reviews/{place,offer}-*-2026-07-28.{md,json}`.

```text
Phase: PLACES/OFFERS production readiness and media closure — DATA/REGRESSION
  CLOSURE COMPLETE; publication + media remain founder-gated, not
  data-integrity issues.
Places: 83 rows (82 WP-lineage + 1 pre-existing non-migration seed, out of
  scope), 0 CREATE/duplicate/orphan. Reused existing
  migration:preview:wordpress-db --entity place tool (no new tooling) for a
  full 82-key read-only source snapshot+classification: 78/82
  SKIP_UNCHANGED (READY_NOOP), 4/82 UPDATE_CONFLICT (places 437/895/5389/
  43023 — known manual post-import edits, correctly BLOCKED, matches prior
  session's documented expectation). Only 5/83 PUBLISHED; the other 78 are
  content-clean but PENDING — no bulk review/publish tool exists for Place
  yet (unlike Routes/Events), so bulk-publishing them is a founder decision,
  not attempted. Found+fixed a real regression: PlaceCommitWriter's
  buildUpdateData() unconditionally reset status to PENDING and clobbered
  cityId on every UPDATE — identical bug class to the already-fixed
  EventCommitWriter defect, currently dormant (0 Places in an UPDATE_SAFE
  state) but a live risk for the next WordPress edit to any of the 78 clean
  rows. Fixed, 3 regression tests added, full Place migration test suite
  green. Live browser smoke (own worktree dev server): all 5 PUBLISHED
  Places 200 OK with correct content/city/media/hours/reviews, 0 console
  errors, desktop+mobile clean, a PENDING place correctly 404s. New P0
  found: PLACE_CANONICAL_METADATA_MISSING (generateMetadata() never reads
  seoCanonicalUrl, confirmed on all 5 — same defect class as the
  already-backlogged Route one).
Offers: 63/63 safe-canonical scope reconfirmed byte-identical to the prior
  session's 2026-07-22 closure (commit 1fca8c8b, golden+Batch 1-4, immutable
  manifest hashes on record) — NOT re-run (explicitly marked not to be).
  Found+fixed a real regression: OfferCommitWriter.createOfferFromDraft()
  resolved and validated draft.ownership.cityId (buildOfferCreateDraft
  blocks on MISSING_CITY otherwise) but never persisted it to the row — all
  63 Offers had cityId: null despite their Place always having a real city.
  Fixed the writer, added OfferCommitWriter.test.ts (none existed before),
  and backfilled all 63 existing rows from Offer.place.cityId (CAS-guarded,
  one-off script, protected fields verified byte-identical before/after,
  reran to confirm 0 further writes — idempotent). All 63 remain DRAFT: the
  existing approveOffer() moderation function only accepts a
  PENDING→PUBLISHED transition, and none of the 63 ever went through a
  DRAFT→PENDING submit step (they were migration-created, not
  Business-submitted) — a structural gap, flagged as a founder decision
  (a technical PUBLISHED path does exist today via the privileged-role
  Business PATCH endpoint, which correctly triggers slug+canonical
  assignment as a side effect). Offer media import confirmed genuinely
  unimplemented (explicit code-level gate, not a regression) —
  recommendation is an explicit P1 defer, same posture as Article media.
  Class H (28)/class I (8) backlog carried forward unchanged from the prior
  closure (no bulk Offer source-discovery tool exists in this codebase to
  re-derive them, and re-deriving would repeat an already-proven check).
Shared finding: EVENT_SEARCH_INDEX_PUBLICATION_RACE's defect class
  (fire-and-forget, unordered SearchDocument upserts) is structurally
  applicable to Place/Offer too via the same extendPrismaWithSearchIndexing
  extension — did not reproduce this session because migration writes
  bypass that extension entirely (bare PrismaClient); would only surface via
  the normal admin/business publish flow. Not re-investigated further
  (shared infra, its own scoped fix).
Cumulative audit: only DB write this session was the 63-row Offer.cityId
  backfill (null → derived value) — every row count (Place 83, Offer 63,
  MediaAsset 159, PlaceImage 39, Business 42, City 5) is unchanged from
  session start. 0 unexpected CREATE/DELETE, 0 production writes, 0
  commit/push/merge/PR performed.
Tests: all 17 relevant Place/Offer migration test files pass (including 2
  new regression tests + 1 new test file), tsc --noEmit clean, lint clean on
  changed files, git diff --check clean.
Three founder decisions now block further Places/Offers progress (none are
  data-integrity issues — all are product/process decisions):
  (1) bulk-publish path for the 78 clean PENDING Places;
  (2) DRAFT→publish path for the 63 safe-canonical Offers;
  (3) Offer media P0-vs-P1 (recommend P1).
Next action once those are decided: PLACE_CANONICAL_METADATA_MISSING fix
  (small, isolated, same shape as the Route one), then Article content/media
  closure (§5.5), then Reviews defer decision (§5.6), then Redirects/SEO
  (§5.7). This branch's docs/prelaunch-checklist.md still needs a manual
  merge against fix/admin-article-preview-routing's independent Users/UAT
  updates before either lands in dev (see §5.2/§0 note at top of file) — not
  performed here, per explicit instruction not to touch that worktree.
```

**2026-07-28 (third session) — Places status/classification matrix correction, no
new writes.** Same worktree/branch. Purpose: the prior session's "5 published,
78 content-clean pending" summary for Places was directionally right but
imprecise — it conflated the 1 non-migration seed Place with the 82 lineage
Places, and did not separate genuinely `READY_FOR_EDITORIAL_PUBLICATION_REVIEW`
Places from the 2 that are `CITY_BLOCKED`. No DB writes were needed or
performed this session — purely a read-only join of the two already-captured
proof docs (local DB baseline + WordPress source preview) into an exact,
arithmetically-verified matrix.

```text
Corrected Place breakdown (82 lineage + 1 seed = 83, verified):
  A1 PUBLISHED + READY_NOOP:                    0
  A2 PUBLISHED + UPDATE_CONFLICT_PROTECTED:      4  (437/895/5389/43023 — already
                                                     PUBLISHED before this session,
                                                     browser-verified valid content)
  A3 PUBLISHED + CITY_EVIDENCE_MISSING:          0
  A5 PENDING + READY_NOOP:                      76
  A7 PENDING + CITY_EVIDENCE_MISSING:            2  (32409 "Be English", 60742 "Школа
                                                     архитектурного мышления" — source
                                                     itself has no city evidence either)
  B  seed (non-migration):                       1  (PUBLISHED, out of migration scope)
  All other buckets (A4/A6/A8/A9):               0
  Sum check: 0+4+0+0+76+0+2+0+0 = 82; +1 seed = 83 — matches exactly.
```

Full detail: `docs/migration/reviews/place-status-classification-matrix-2026-07-28.{md,json}`
(JSON is deterministic — rows sorted by `sourceRecordKey`, aggregates recomputed
directly from the rows array). §2 table and §5.5 above rewritten to use this
exact matrix instead of the prior approximate framing; §5.5 also now explicitly
separates DATA/MIGRATION closure (complete) from PUBLICATION closure (not
complete) from MEDIA (documented gaps) from PUBLIC RUNTIME VALIDATION (found
`PLACE_CANONICAL_METADATA_MISSING`) from PRODUCTION EXECUTION (not started) for
both Places and Offers, and Offer media is now framed as an explicit Option
A(P0)/Option B(P1) founder decision rather than a pre-decided P1 recommendation.
No Events/Routes/Articles/UAT content was touched. Code (`PlaceCommitWriter`,
`OfferCommitWriter`, their tests) was re-verified against this session's own
description but not modified further — the fixes already made in the prior
session were confirmed to match their intended contracts exactly (see the
commit-by-commit breakdown recorded at the point these were split into their
own commits, immediately following this entry).
