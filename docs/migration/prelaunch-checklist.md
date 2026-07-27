# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

**Обновлено:** 2026-07-27  
**Base:** `dev` @ `b50c22fcb9c804c30e50718d4ab72716b55f00b1` — PR #91 merged  
**Текущая фаза:** `ARTICLES — Slice 20 authorship assignment for user:575`  
**Текущий gate:** `READY_FOR_SLICE_20`

> Подробная история Slices 1–19 сохранена в Git и профильных proof-документах.
> Здесь находятся только актуальные правила, доказанный прогресс и обязательный путь до запуска.

---

## 1. Неподвижные правила

1. Перед Prisma/auth/migration работой читать `CLAUDE.md` и профильные runbooks.
2. Запрещены `prisma migrate dev`, `prisma db push`, reset и destructive cleanup.
3. WordPress — строго read-only source. Production writes разрешаются только отдельным Go/No-Go.
4. Для новой сущности: один environment gate, один SSH probe и один агрегированный immutable capture.
5. После capture дальнейшие inventory/classification/planning выполняются локально.
6. Для content-bearing exact records разрешён один scoped exact-key read через существующий vetted fetcher; broad discovery запрещён.
7. Первый write каждой сущности или нового relation-типа выполняется последовательно, `stop-on-first-error`.
8. После partial write запрещены автоматические cleanup, rollback записанного prefix и скрытые retry.
9. Fixed manifest, canonical hashes и expected actions фиксируются до write.
10. Writes используют exact `sourceRecordKey`, active lineage, CAS/conditional update и fail-closed guards.
11. После clean scope обязателен cumulative DB/storage audit и один общий idempotency rerun.
12. Аномалии не исправляются внутри batch: они переносятся в documented backlog.
13. Media выполняются только по заранее подготовленному manifest и отдельному gate.
14. Один связный vertical slice → одна ветка → один Draft PR → один adversarial review → один fix batch → финальный CI cycle.
15. Production разрешён только после local golden, local batch, idempotency proof, rehearsal и Go/No-Go.
16. Raw immutable snapshots хранятся вне Git и вне `/tmp`:

```text
/Users/shapovalovalexey/.mamago2/migration-snapshots/<entity>/
```

Permissions: `0700` для директорий, `0600` для файлов.

17. Тесты не зависят от `/tmp`, live WordPress или приватных home-directory snapshots: только committed sanitized fixtures либо self-generated temporary fixtures.
18. Оптимизация разработки допустима только объединением связанных операций с одним fixed scope. Параллельные DB-write потоки запрещены.

---

## 2. Текущий прогресс

| Трек | Статус | Что остаётся |
| --- | --- | --- |
| Migration engine | COMPLETE | Regression и production validation |
| Places | CORE COMPLETE | Media, production validation, public/city audit |
| Offers | LOCAL SAFE SCOPE COMPLETE 63/63 | Production execution; media/P1 decision; backlog H/I |
| Routes | IMPORTED 14/14 | Review, publish, slug history, redirects, public validation |
| Events | PARTIAL 4/9 | 5 CREATE, 67 sessions, rerun, city/date/URL validation |
| Users clean migration | LOCAL COMPLETE 564/564 | Production import и activation delivery |
| Users activation architecture | COMPLETE | Production email provider, rehearsal и delivery Go/No-Go |
| Business-linked Users | FULLY CLOSED | 38/38 ownership, 38/38 `BUSINESS_OWNER`, backlog 0 |
| Users manual/privileged | PLANNED 15 | 5 founder decisions, 9 exclusions, 1 ADMIN unchanged |
| Activities | P0 CLOSED | 63 expired Events → `P1_HISTORICAL_EXPIRED_ACTIVITY` |
| Articles user:575 | MIGRATED 2/2 | Authorship assignment, city/publication/visibility, media decision |
| Content authorship user:575 | READY | 2 exact candidates; guarded write + common rerun |
| User/Business profile media | NOT STARTED | P0/P1 decision; manifest only if P0 |
| Article media | NOT STARTED | Cover/inline policy, storage/dedup proof |
| Reviews | NOT STARTED | Реализовать либо явно defer в P1 |
| Redirects/pages/SEO | PARTIAL | Exact redirects, pages, canonical/sitemap/robots/noindex audit |
| Product regressions | PARTIAL | Event discovery/404, Article city visibility, full smoke |
| RC / production cutover | NOT STARTED | Freeze, backup, rehearsal, Go/No-Go, migration, DNS |

---

## 3. Завершено и не должно повторяться

### 3.1 Foundation

- [x] `MigrationRun`, `MigrationRecord`, `MigrationLineage`.
- [x] Canonical hashes, unique lineage и idempotent classification.
- [x] Local/dev/prod profiles и production cutover runbook.
- [x] Sequential first-write safety, CAS/conditional updates, cumulative audits.

### 3.2 Offers

```text
Published source inventory: 99
Canonical scope:           91
Local safe scope:          63
Imported locally:          63/63
Common rerun:              63 SKIP_UNCHANGED
Duplicate Offer/lineage:   0
```

Deferred:

```text
class H: 28 — missing required Place relation
class I: 8  — noncanonical alias
Offer media: separate P0/P1 decision
Production execution: not started
```

### 3.3 Users identity and business ownership

```text
Clean Users local import:       564/564
Common rerun:                   564 SKIP_UNCHANGED
Business ownership:             38/38 COMPLETE
BUSINESS_OWNER elevation:       38/38 COMPLETE
Business-linked backlog:        0
Activation state after import:  PENDING_ACTIVATION
Migration sessions/tokens/mail: 0
```

- [x] Legacy password hashes excluded.
- [x] Automatic ADMIN inheritance forbidden.
- [x] Hash-only activation token architecture implemented.
- [x] Existing ADMIN remains a separate manual/privileged disposition.

### 3.4 Activities and authorship scope decision

- [x] Slice 15: content-author users reconciled read-only.
- [x] Slice 16: durable standalone Activity snapshot and dependency inventory.
- [x] Все 63 authored Events у 9 пользователей имеют `post_status=expired`.
- [x] Product decision: historical expired Events не входят в launch P0.
- [x] Classification: `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- [x] `user:521` остаётся existing-author conflict.
- [x] `user:91` остаётся partial-lineage backlog.

### 3.5 Slice 17 — Article dependency proof

```text
wordpress-db:post:56250  publish  ARTICLE_TARGET_NOT_MIGRATED
wordpress-db:post:57731  publish  ARTICLE_TARGET_NOT_MIGRATED
User lineage user:575:   active
Article lineage:         absent for both
Decision:                ARTICLE_GOLDEN_REQUIRED
```

- [x] Count gate: ровно 2 published Articles.
- [x] Golden candidate: `wordpress-db:post:56250`.
- [x] Database/media/authorship writes: 0.

### 3.6 Slice 18 — first Article golden migration

```text
sourceRecordKey:  wordpress-db:post:56250
first run:        LINKED / CREATE
rerun:            SKIPPED
Article delta:    +1
ARTICLE lineage:  +1
MediaAsset:       0
written fields:   status=PENDING, cityId=null, geoScope=null,
                  coverImageId=null, authorUserId=null
```

- [x] PR #90 merged as `0603e54ca8afdcd0b92623ac01a30e4db03a1eac`.
- [x] Existing Article writer reused unchanged.
- [x] No city, publication, media or authorship write mixed into golden migration.

### 3.7 Slice 19 — second Article + common rerun + reconciliation

```text
sourceRecordKey:  wordpress-db:post:57731
source read:      1 exact-key read-only fetch
first run:        LINKED / CREATE
Article delta:    +1 (25 -> 26)
ARTICLE lineage:  +1 (911 -> 912)
MediaAsset:       0
```

Common rerun:

```text
wordpress-db:post:56250 -> SKIPPED
wordpress-db:post:57731 -> SKIPPED
Article CREATE/UPDATE: 0
Duplicate lineage:     0
```

Read-only authorship reconciliation:

```text
wordpress-db:post:56250 -> EXACT_AUTHORSHIP_CANDIDATE
wordpress-db:post:57731 -> EXACT_AUTHORSHIP_CANDIDATE
target user lineage:     active for wordpress-db:user:575
authorship writes:       0
Decision:                AUTHORSHIP_GOLDEN_READY
```

- [x] Publication recovery did not repeat source reads, runners or DB/media/storage writes.
- [x] PR #91 merged as `b50c22fcb9c804c30e50718d4ab72716b55f00b1`.

### 3.8 Документированный test debt

- [x] Snapshot-dependent planning tests переведены на autonomous fixtures.
- [x] Migration suite boundary after PR #87: 155 pass, 2 skipped, 0 fail sequentially.
- [ ] Два `UserCleanBatch.test.ts` остаются explicit skip из-за утерянного полного raw USERS snapshot.
- [ ] Не перезахватывать USERS snapshot только ради этих двух тестов.

---

## 4. Обязательный P0 остаток до запуска

### 4.1 Articles и content authorship

- [ ] Guarded authorship assignment для двух Article user:575:
  - `post:56250 authorUserId null → target user:575`;
  - `post:57731 authorUserId null → target user:575`.
- [ ] Выполнить sequential first write с CAS `WHERE authorUserId IS NULL`.
- [ ] Один общий rerun: обе Article → `ALREADY_SATISFIED` / `SKIP_UNCHANGED`.
- [ ] Решить city/geoScope для двух `PENDING` Articles.
- [ ] Провести редакционный review и publish через штатный lifecycle.
- [ ] Проверить selected/default city blog visibility и public URLs.
- [ ] Принять P0/P1 решение по cover и inline historical media.
- [ ] `user:521` — founder/manual conflict decision либо явный P1 defer.
- [ ] `user:91` — lineage review либо явный P1 defer.

### 4.2 Users production и activation

- [ ] Зафиксировать dispositions для 15 manual/privileged users:
  - 1 existing ADMIN оставить неизменным;
  - 9 exclusions подтвердить;
  - 5 `REQUIRES_FOUNDER_DECISION` решить.
- [ ] Интегрировать и проверить production email provider.
- [ ] Сохранить LOCAL/DEV external delivery hard-disabled.
- [ ] Подготовить production User manifest и checksums.
- [ ] Провести production-like rehearsal Users + activation.
- [ ] Controlled activation delivery только после Go/No-Go.
- [ ] Решить P0/P1 для User/Business avatars и logos.

### 4.3 Events

```text
eligible imported:             4/9
remaining CREATE:              5
pending materialized sessions: 67
```

- [ ] Exact Docker/CI environment gate.
- [ ] Preview и sequential commit 5 remaining Events.
- [ ] Session/cumulative delta validation.
- [ ] Один общий rerun.
- [ ] City/date discovery и отсутствие 404.

Event images остаются вне frozen P0 scope.

### 4.4 Routes

- [ ] Ручной review 14/14.
- [ ] Проверить stops, descriptions, RouteStop images и city mappings.
- [ ] Publish approved Routes.
- [ ] Slug history и redirect map.
- [ ] Public URL validation.

### 4.5 Places, Offers и media

- [ ] Финальная production validation Places.
- [ ] Place media manifest, storage и dedup audit либо явный P1 defer некритичного media.
- [ ] Production execution Offers safe scope 63/63.
- [ ] Offer media gate либо явный P1 defer.
- [ ] Local FULL, dev metadata-only и production FULL proofs для media, оставленного в P0.

### 4.6 Reviews

- [ ] Принять founder decision: launch P0 или P1 defer.
- [ ] Если P0: approved source scope, dependency gate, vertical slice, golden/batch/rerun, aggregate validation.

### 4.7 Redirects, mandatory pages и SEO

- [ ] RankMath `exact` redirects subset.
- [ ] Redirects на `/` вручную перемапить на релевантные hubs.
- [ ] Legal/about/contact pages.
- [ ] WordPress catch-all.
- [ ] Canonical/no-trailing-slash и city-scoped URLs.
- [ ] Sitemap/robots/noindex launch gate.
- [ ] Redirect manifest minimum и collision audit.

`start`/`contains` redirects остаются P1.

### 4.8 Product regressions — launch blockers

- [ ] Event появляется в правильном городе и на правильной дате.
- [ ] Event public URL не отдаёт 404.
- [ ] Published Article виден в блоге selected/default city.
- [ ] Auth и migrated-account activation smoke.
- [ ] Business cabinet и admin lifecycle smoke.
- [ ] Public Places/Offers/Events/Articles/Routes smoke.
- [ ] Mobile/desktop critical navigation smoke.

### 4.9 Release candidate и production cutover

- [ ] Freeze production source snapshots.
- [ ] Production manifests и checksums.
- [ ] Fresh production backup и подтверждённый restore procedure.
- [ ] Full local production-like rehearsal.
- [ ] Dev metadata-only rehearsal.
- [ ] Cumulative DB/storage и forbidden fields/tables audits.
- [ ] Redirect/SEO validation report.
- [ ] Docker Build & Push exact RC SHA — GREEN.
- [ ] Финальный Go/No-Go.
- [ ] Последовательная production migration.
- [ ] Post-migration validation и разрешённые idempotency reruns.
- [ ] DNS cutover, noindex switch, monitoring/rollback decision window.

---

## 5. Не входит в обязательный P0 без отдельного решения

- Past Events и Event images.
- 63 expired Activities и связанная authorship — `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- Noncanonical Offer class I.
- Offer class H без Place relation.
- Draft/unpublished long-tail bulk publication.
- Full public profile content classification.
- RankMath `start`/`contains` redirects.
- Historical bookings, WooCommerce/LatePoint и social feeds.
- Collections и редкие custom post types.
- Reviews, если founder явно фиксирует P1 defer.
- Некритичные avatars/logos/covers/inline historical media после явного P1 решения.

---

## 6. Сколько осталось до конца

Это операционная оценка, не календарное обещание:

```text
Core migration mechanics:       ~84% complete
Local clean data work:           ~76% complete
Production/cutover readiness:    ~30% complete
Overall strict prelaunch:        ~64–68% complete
Remaining strict P0 work:        ~32–36%
```

Самые рискованные identity/ownership и Article CREATE-механики уже доказаны. Основной остаток теперь находится не в migration engine, а в production activation, content publication closure, Events/Routes tail, media decisions, SEO/regressions и RC/cutover.

Крупных P0-блоков остаётся **9**:

1. Authorship и public/editorial closure двух Articles user:575.
2. Users production activation и manual dispositions.
3. Events tail.
4. Routes review/publish.
5. Places/Offers и P0 media closure.
6. Reviews либо явный P1 defer.
7. Redirects/pages/SEO.
8. Product regression suite.
9. RC rehearsal и production cutover.

Ориентир при оптимизированном, но безопасном процессе:

```text
примерно 9–14 связных slices/PR до cutover,
если Reviews и некритичная часть media явно перенесены в P1;
больше — если полный media/reviews scope остаётся обязательным P0.
```

---

## 7. Следующее одно действие

```text
Phase: ARTICLES — Slice 20 authorship assignment for wordpress-db:user:575
Branch: codex/articles-user575-authorship-assignment
Base: dev @ b50c22fcb9c804c30e50718d4ab72716b55f00b1
Targets: wordpress-db:post:56250 and wordpress-db:post:57731 only
Expected write: authorUserId null -> target user:575
Guard: exact active USER/ARTICLE lineages, current authorUserId IS NULL,
       CAS/conditional update, stop on first error
Execution: sequential first write for 2 records
Expected rerun: both ALREADY_SATISFIED / SKIP_UNCHANGED
Forbidden: content, status, cityId, geoScope, media, roles, ownership,
           sessions/tokens, user:521, user:91, expired Activities
```
