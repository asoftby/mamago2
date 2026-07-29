# mamaGo 2.0 — Full Product Acceptance / UAT

**Gate:** P0, mandatory before RC rehearsal and production Go/No-Go
**Status:** `NOT STARTED`
**Pass 1:** `NOT STARTED`
**Pass 2:** `NOT STARTED`
**Founder acceptance:** `NOT RECORDED`
**Baseline:** 2026-07-28, `fix/admin-article-preview-routing` @ `f1502135`

This is an execution document, not evidence that the product has passed.
Every scenario starts as `NOT_RUN`. A tester must replace the execution fields
with links to captured evidence; assumptions and green unit tests are not PASS.

## 0. Purpose and participants

The purpose is to accept mamaGo 2.0 as one integrated product before launch,
not to re-prove isolated migration entities. Required participants/roles are:
anonymous visitor, `USER`, `BUSINESS_OWNER`, `MODERATOR`, `ADMIN`, and negative
authorization actors (wrong owner and otherwise unauthorized user).

## 1. Scope discovered in the code

Confirmed platform roles are `USER`, `BUSINESS_OWNER`, `MODERATOR`, `ADMIN`;
account statuses include `PENDING_ACTIVATION`. MODERATOR is used in real
moderation, preview, media and privileged content paths, so it is in scope.

Confirmed product surfaces/models include:

- public city-scoped Places, Offers, Events (`Activity` + `ActivitySession`),
  Articles, Routes/RouteStops, discovery/search, plan and reviews;
- registration/login/logout, sessions and migrated-user activation;
- Business ownership/membership, Place/Offer/Event wizards and moderation;
- booking requests and Direct threads/messages;
- in-app/email/Telegram notification infrastructure;
- admin moderation, editorial, media, SEO, billing-ledger and audit surfaces.

Scope qualifications:

- `Activity` is the shared content model; Event/Class are typed variants, not
  evidence of two fully independent lifecycle products.
- birthday/custom-request pieces exist (`Occasion`, birthday discovery,
  editorial requests, Direct), but a complete request → matched providers →
  priced proposals → provider selection flow is not proven. Decision:
  **FOUNDER REQUIRED — P0 BLOCKER or P1 DEFER**.
- Reviews exist in schema and UI/API, but migration and full flow remain
  unaccepted. Decision: **FOUNDER REQUIRED — P0 or P1 DEFER**.
- billing accounts, ledger transactions and admin refund/credit/debit exist;
  a production-ready customer checkout and signed payment callback was not
  confirmed. Decision: **FOUNDER REQUIRED — out of P0 or blocker**.
- no separate favourite model/flow was confirmed; Plan is real. Do not report
  “favourites passed” unless a current UI/API surface is identified at run time.

## 2. Execution contract

### Required record for every scenario

Copy this block per execution:

```text
ID:
Название:
Приоритет: P0 / P1 / P2
Роль:
Tester:
Execution date:
Exact RC branch / HEAD:
Server command / port / working directory:
Browser / viewport:
Предусловия:
Тестовые данные:
Пошаговые действия:
Ожидаемый результат:
Что проверить в БД:
Что проверить в UI:
Что проверить в логах/console/network:
Evidence:
Фактический результат:
Status: NOT_RUN / NOT_PERFORMED / PASS / FAIL / BLOCKED / DEFERRED
Defect ID:
Retest status:
```

Rules:

- `PASS` requires UI + network + DB evidence where the scenario writes data.
- screenshots must show URL and relevant state; secrets/PII must be masked.
- record request ID, response status and exact DB identifiers, never raw tokens.
- use isolated UAT city/business/users and deterministic unique suffixes.
- repeated clicks/reruns must prove one business result, not merely one toast.
- `BLOCKED` P0 is a launch blocker until resolved; `DEFERRED` requires founder.
- `NOT_PERFORMED` is never interpreted as PASS and must state the blocker.
- an unauthenticated 401 is not authenticated-journey evidence; a rendered
  form is not end-to-end CTA delivery; isolated/unit/browser evidence from
  another branch or SHA is not evidence for the current integrated RC.
- production email, bulk Telegram, real payments and production writes are
  `PRODUCTION_ONLY` and require a separate Go/No-Go runbook.

## 3. Automation classes

### AUTOMATED

Existing tests provide component/service evidence only:

| Test path | Proves | Does not prove |
| --- | --- | --- |
| `src/server/auth/activationEndpoints.integration.test.ts` | activation request/complete, invalid/expired/reused tokens, rate limiting and role preservation | browser UX or real delivery |
| `src/app/api/auth/login/pendingActivation.integration.test.ts` | login detection for pending accounts | full login/activation browser journey |
| `src/server/auth/activationEmailDelivery.rehearsal.test.ts` | environment gate, fake transport and token secrecy | production provider delivery |
| `src/lib/auth/sessionEligibility.integration.test.ts` | pending/blocked session eligibility | session persistence in browsers |
| `src/lib/contentLifecycle/lifecycleStateMachine.test.ts` | permitted lifecycle transitions by role | real forms, API/DB/UI agreement |
| `src/server/services/contentLifecycleOperation.service.test.ts` | lifecycle service behavior and guarded transitions | all entity-specific pages |
| `src/lib/event/materializeScheduleSessions.test.ts` | deterministic session materialization | public discovery and timezone UI |
| `src/lib/migration/adapters/wordpress-db/pruneEventSchedule.test.ts` | past/future schedule pruning | migrated production records |
| `src/lib/routing/wpLegacyCatchAll.test.ts` and `src/lib/seo/redirectManifest.test.ts` | redirect rules and manifest constraints | deployed redirects and loops |
| `src/lib/routes/routeAccess.test.ts` | route visibility authorization | full route editor/map |
| `src/server/notifications/notification-dedupe.test.ts` | notification deduplication | provider delivery and user comprehension |
| `src/lib/security/rateLimit.test.ts` | rate-limit primitive | distributed production storage and every endpoint |

Unit/integration tests do not substitute for an end-to-end UAT PASS.

### SEMI_AUTOMATED

- scripted fixture creation and read-only DB assertions;
- Playwright/browser-assisted navigation with a human validating copy, layout
  and status semantics;
- redirect, sitemap, broken-link, HTTP 500 and console-error crawls;
- Event session/city/`nextOccurrenceAt` queries and idempotency reruns;
- storage orphan/dedup and cumulative DB audits.

### MANUAL

- all P0 journeys in desktop and mobile viewports;
- Safari smoke, keyboard/focus, form comprehension and slow/offline behavior;
- moderation decisions, previews, business ownership and status consistency;
- editorial embeds/media rendering and notification comprehension;
- founder acceptance.

### PRODUCTION_ONLY

- backup plus timed restore proof;
- exact-SHA Docker deployment and migration status;
- canary activation email and provider bounce/failure webhook;
- Telegram webhook/provider health without mass send;
- production storage/media delivery, cron/jobs, rate-limit store and monitoring;
- noindex removal, DNS and cutover actions.

None may be executed from this document without explicit production Go/No-Go.

### Minimal missing automated smoke scope

Do not introduce a large E2E framework. If the existing browser harness is made
deterministic, add only:

1. anonymous city home → Event page without 404;
2. register/login/logout with fake local account;
3. pending activation page with fake transport;
4. business-owned draft → submit, staff approve, public URL visible;
5. booking submit deduplicates a double click.

## 4. P0 launch journeys

For every journey, use the execution contract in §2.

### P0-J1 — New user registration and public use

- **Priority / role:** P0 / anonymous → USER
- **Preconditions/data:** unique inbox-free test email; Minsk selected.
- **Steps:** register; validate bad input; submit valid data once and double-click
  once in a fresh run; log in; reload; open Place/Offer/Event/Article/Route;
  add a supported item to Plan; log out; revisit protected page.
- **Expected:** one ACTIVE USER, one session, no duplicate account; selected city
  persists; public pages render; Plan persists after reload; logout invalidates
  protected access.
- **DB/UI/log evidence:** User/Session/PlanItem counts and IDs; form/status UI;
  network has no 500/raw password/token; console has no errors.

### P0-J2 — Migrated account activation

- **Priority / role:** P0 / `PENDING_ACTIVATION`
- **Preconditions/data:** migrated USER and BUSINESS_OWNER fixtures; fake mail.
- **Steps:** attempt login; request link; retry inside cooldown; open valid link;
  set valid password; reuse token; try expired and malformed tokens; choose
  “Указать другой email”; log in after activation.
- **Expected:** enumeration-safe responses; cooldown enforced; raw token only in
  fake transport; valid token works once; status becomes ACTIVE; roles and
  ownership remain unchanged.
- **DB/UI/log evidence:** token hash/audit without raw token; status/role,
  Business ownership and Session; exact activation UI states; no token in logs.

### P0-J3 — Business onboarding to moderation

- **Priority / role:** P0 / USER → BUSINESS_OWNER
- **Preconditions/data:** clean USER; unique UNP/business/place/offer names.
- **Steps:** create Business; create Place draft; trigger validation; add/remove/
  reorder media; submit; create first Offer; submit twice; attempt second Offer
  only to observe the actually implemented policy.
- **Expected:** ownership is exact; role/cabinet state updates; one Place and one
  Offer; invalid drafts cannot publish; repeat submit creates no duplicate;
  second-Offer behavior matches code/config, not an assumed tariff.
- **DB/UI/log evidence:** BusinessMember/owner relations, entity statuses/media
  order and counts; clear next-action copy; no unauthorized or duplicate write.

### P0-J4 — Staff moderation

- **Priority / role:** P0 / MODERATOR and ADMIN
- **Preconditions/data:** submitted Place/Offer/Event plus stale second browser.
- **Steps:** preview; reject one with reason; owner edits/resubmits; approve;
  repeat approve; attempt stale concurrent edit; archive and restore where UI
  offers it.
- **Expected:** role guards hold; status transition and audit are singular;
  rejection reason reaches owner; stale/CAS failure does not lie in UI; founder
  ADMIN cannot be deleted/demoted.
- **DB/UI/log evidence:** status/revision/audit rows, founder ADMIN count exactly
  one; matching admin/business status; 403 for USER and foreign owner.

### P0-J5 — Correct public discovery

- **Priority / role:** P0 / anonymous and USER
- **Preconditions/data:** published fixtures in Minsk and another city; drafts.
- **Steps:** open city hubs; search/filter; paginate/back; switch city and reload;
  open canonical URL; query unpublished/archived fixture.
- **Expected:** only eligible city-scoped published content appears; query params
  and city persist; drafts/archives are absent; canonical has no trailing slash.
- **DB/UI/log evidence:** city/status/slug matches rows; UI cards/detail agree;
  no 404/500, hydration or console errors.

### P0-J6 — User submits booking/request

- **Priority / role:** P0 / USER
- **Preconditions/data:** published entity with each enabled CTA mode.
- **Steps:** open CTA; authenticate when required; test empty/past/missing time;
  submit valid request with deliberate double click; reopen result.
- **Expected:** validation is specific; exactly one BookingRequest; correct
  entity/business/user/date/time; honest success only after durable write.
- **DB/UI/log evidence:** BookingRequest and audit/event counts; status and CTA;
  one successful mutation, no PII/stack trace.

### P0-J7 — Business receives and answers

- **Priority / role:** P0 / BUSINESS_OWNER
- **Preconditions/data:** J6 request; fake notification adapters.
- **Steps:** open cabinet; filter/open request; reply; change status; retry reply;
  attempt access as foreign business.
- **Expected:** notification/cabinet show one request; one answer; status is
  consistent; foreign business gets 403/404 without data disclosure.
- **DB/UI/log evidence:** request activity, Direct/notification/delivery rows and
  ownership; cabinet counters; provider failure is recorded and retry deduped.

### P0-J8 — User receives response

- **Priority / role:** P0 / USER
- **Preconditions/data:** answered J7 request.
- **Steps:** open in-app notification and bookings/messages; reload; revisit.
- **Expected:** response and latest status agree everywhere; correct deep link;
  read/reopen does not duplicate messages or notifications.
- **DB/UI/log evidence:** recipient/read/status timestamps; matching UI; no
  cross-user access.

### P0-J9 — Event schedules

- **Priority / role:** P0 / staff, owner, anonymous
- **Preconditions/data:** single-date, multi-session, recurring, today, future,
  partly past and fully ended Events in two cities.
- **Steps:** publish; inspect discovery/date filters/detail; edit schedule; remove
  one session; rerun materialization twice.
- **Expected:** correct `nextOccurrenceAt`; ended Event is not future; no wrong
  city/404; removal is reflected; rerun is NOOP/SKIP_UNCHANGED with no duplicates.
- **DB/UI/log evidence:** Activity/ActivitySession counts and timestamps; cards
  agree with detail; no duplicate keys/timezone shifts.

### P0-J10 — Desktop/mobile critical flows

- **Priority / role:** P0 / all roles
- **Preconditions/data:** J1–J9 fixtures.
- **Steps:** repeat critical path in desktop Chrome, iPhone and Android viewport;
  Safari smoke; keyboard-only submit/modal; slow and lost network.
- **Expected:** no horizontal scroll; visible focus/labels/errors; usable touch
  targets; loading/empty/error states; lost network never shows false success.
- **Evidence:** screenshots/video per viewport, console/network export.

### P0-J11 — WordPress redirects and mandatory pages

- **Priority / role:** P0 / anonymous
- **Preconditions/data:** approved exact redirect manifest for every content type.
- **Steps:** request old Place/Event/Article/Route URLs, collision, missing path,
  trailing slash and WordPress catch-all; open About/Contacts/Privacy/Terms.
- **Expected:** one correct city-scoped destination, no loop; unknown is 404/410
  by policy; legal pages render; canonical/robots/sitemap/noindex match phase.
- **Evidence:** status/Location chain, final canonical, crawl report.

### P0-J12 — RC and recovery gates

- **Priority / role:** P0 / release operator
- **Preconditions/data:** frozen SHA/manifests; authorized non-production rehearsal
  and separately approved production window.
- **Steps:** verify env/secrets/migrations; build exact SHA; backup; restore into
  isolated target; run health/storage/jobs/provider/audit probes and migration
  rehearsal/idempotency.
- **Expected:** reproducible image; restore meets documented procedure; no
  forbidden URLs/secrets; audits show no orphan/duplicate/forbidden deltas.
- **Evidence:** immutable build digest, backup/restore timestamps and checksums,
  migration/audit reports; no secret values in evidence.

## 5. Detailed scenario catalogue

Each row is a separate scenario. At execution, expand it using §2; the row
supplies concrete preconditions, actions, expected result and evidence targets.

### A. Authentication and accounts

| ID | P | Role | Action | Expected result / evidence |
| --- | --- | --- | --- | --- |
| AUTH-01 | P0 | anonymous | register valid unique email, repeat submit | one ACTIVE USER; one account/session; validation and DB count |
| AUTH-02 | P0 | USER | login valid password, reload | eligible session persists; cookie flags/network/Session |
| AUTH-03 | P0 | anonymous | wrong password then unknown email | same safe error/timing class; no account enumeration or session |
| AUTH-04 | P0 | USER | logout then open `/me` | session invalid; protected redirect/401 |
| AUTH-05 | P1 | USER | use recovery UI if currently exposed | valid one-time recovery; otherwise `BLOCKED` with exact absent route |
| AUTH-06 | P0 | pending | request/resend/activate/reuse/expire/bad token | enumeration-safe, cooldown, one-time activation, hash-only audit |
| AUTH-07 | P0 | pending | “Указать другой email” | returns to clean email entry without leaking previous account |
| AUTH-08 | P0 | pending owner/admin | activate fixtures | role/ownership unchanged; exactly one founder ADMIN in production gate |
| AUTH-09 | P0 | blocked/deleted | login and old session | no session; no protected data; audit/rate-limit evidence |

### B. Content lifecycle

Run `CONTENT-01..08` for each actually exposed type: Place, Offer, Event/Class
(`Activity`), Article and Route. Record unsupported operations as `DEFERRED`
only with product decision, never PASS.

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| CONTENT-01 | P0 | create draft with valid minimum, double-click | one DRAFT row and stable slug |
| CONTENT-02 | P0 | omit each required field and attempt submit/publish | field errors; no publish/status drift |
| CONTENT-03 | P0 | edit text/city/media; remove/reorder; reload | persisted order/content and correct city |
| CONTENT-04 | P0 | preview draft and request its public URL | authorized preview only; noindex; public 404/invisible |
| CONTENT-05 | P0 | submit twice; staff reject; owner edit/resubmit | singular revision/status; reason visible |
| CONTENT-06 | P0 | approve/publish and open discovery/detail | correct public city URL and status |
| CONTENT-07 | P0 | archive then restore if supported | absent from discovery while archived; restored only by allowed transition |
| CONTENT-08 | P1 | change slug after publish | slug history/redirect exactly match implemented policy |

### C. Business onboarding/cabinet

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| BIZ-01 | P0 | USER creates Business → Place → first Offer → moderation | ownership and lifecycle match J3/J4 |
| BIZ-02 | P0 | owner opens foreign Business/Place/Offer IDs and APIs | 403/404, zero write, no metadata leak |
| BIZ-03 | P0 | hit Place and second-Offer limits | UI/API enforce actual configured policy consistently |
| BIZ-04 | P0 | load empty cabinet and force API 5xx | actionable empty/error state; retry creates no duplicate |
| BIZ-05 | P0 | complete request → response → status on mobile | cabinet counters/status/next step remain clear |

### D. Booking, CTA and Direct

Run CTA-01 for every enabled resolver mode: contact view, simple request,
date, date+time, external link and Direct.

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| CTA-01 | P0 | public page → CTA → auth → validate → submit → business response | one durable request and visible response |
| CTA-02 | P0 | past/unavailable date, missing time | rejected with exact field message; no row |
| CTA-03 | P0 | double click/replay request | idempotent single BookingRequest |
| CTA-04 | P0 | closed offer, archived business, draft entity | CTA unavailable/server rejects; no row |
| CTA-05 | P0 | deleted session or blocked user | safe rejection; no orphan request |
| CTA-06 | P1 | no response / `NO_REPLY_CAP` if enabled | documented expiry/cap state, no notification flood |
| CTA-07 | P0 | fake email/Telegram/provider failure | durable state and honest UI; retry deduped |
| CTA-08 | P0 | foreign user/business opens request/thread | 403/404 and no disclosed content |

### E. Events

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| EVT-01 | P0 | single date/today/future/past detail and feed | correct temporal label/visibility |
| EVT-02 | P0 | multi-session and recurring filters | all and only eligible sessions shown |
| EVT-03 | P0 | all sessions ended | not advertised as future; policy-consistent archive/detail |
| EVT-04 | P0 | compare `nextOccurrenceAt` with sessions | exact earliest eligible occurrence |
| EVT-05 | P0 | city/date filters and public URL | right city/date; no 404 |
| EVT-06 | P0 | edit schedule/remove session after publish | feed/detail/DB converge |
| EVT-07 | P0 | materialize/rerun twice | no duplicates; NOOP/SKIP_UNCHANGED |

### F. Birthday/custom request

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| BDAY-01 | TBD | category → date/budget/description/reference submit | only run if founder marks P0 and full UI exists |
| BDAY-02 | TBD | inspect matching and notifications | only matching providers; deduped sandbox notifications |
| BDAY-03 | TBD | multiple priced replies/edit/withdraw/select twice/close | synchronized singular selection/status |
| BDAY-04 | TBD | bad/large file, no matches, mobile | safe validation and explicit empty state |

Until founder decision and all missing links are listed, status is `BLOCKED`,
not PASS.

### G. Plan and personal scenarios

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| PLAN-01 | P0 | add/remove same item twice and reload | no duplicate; persistence |
| PLAN-02 | P1 | anonymous add then authenticate | behavior matches explicit product policy; no silent loss |
| PLAN-03 | P1 | sync two signed-in browsers | same Plan after refresh |
| PLAN-04 | P1 | mix supported content types, city/date/children | only supported types and valid context persist |
| PLAN-05 | P1 | ended/deleted item and empty plan | safe unavailable/empty state, no broken link |
| FAV-01 | P1 | locate favourite control/model | if absent, record “not implemented”; do not fabricate test |

### H. Search, filters and discovery

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| DISC-01 | P0 | default Minsk, change city, reload | city persists and scopes all feeds |
| DISC-02 | P0 | each content tab/search/category/date | result satisfies query and status/city |
| DISC-03 | P1 | age/district/metro/free/budget and combinations | intersection semantics match URL and rows |
| DISC-04 | P0 | empty result/pagination/back | stable query params, no duplicates/skips |
| DISC-05 | P0 | desktop/mobile same URL | equivalent result set and usable controls |

### I. Articles/editorial

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| ART-01 | P0 | create/edit blocks, links, media, embed, preview | stable unique block IDs; sanitized render; private preview |
| ART-02 | P0 | publish CITY and COUNTRY fixtures | correct blog/home/city scope, author and canonical |
| ART-03 | P0 | malformed embed/missing media/XSS link | safe fallback, no script/console error |
| ART-04 | P0 | render mobile | no overflow; media/links accessible |

### J. Routes

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| ROUTE-01 | P0 | create stops, reorder, describe, add images | stable ordered RouteStops and media |
| ROUTE-02 | P0 | preview/publish/open mobile and map if exposed | private preview; correct city public route |
| ROUTE-03 | P0 | empty stop/deleted Place/external Place | validation or defined fallback, no 500 |
| ROUTE-04 | P0 | legacy location/redirect/slug history | one correct destination, no loop |

### K. Admin and security

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| ADM-01 | P0 | ADMIN/MODERATOR login and dashboard/lists | only allowed surfaces/data |
| ADM-02 | P0 | publish/reject/archive/preview repeatedly | singular audited transition |
| ADM-03 | P0 | USER/owner calls admin page/API | redirect/403, zero disclosure/write |
| ADM-04 | P0 | demote/delete sole founder ADMIN | blocked; ADMIN count remains one |
| ADM-05 | P0 | concurrent edit/stale CAS/API failure | conflict shown; UI rolls back optimistic state |
| SEC-01 | P0 | IDOR foreign business/request/draft IDs | denied without existence leak |
| SEC-02 | P0 | stored/reflected XSS and malicious URL | encoded/sanitized/rejected |
| SEC-03 | P0 | unsupported/oversized file | rejected before public availability |
| SEC-04 | P0 | brute force/rate limits/replay | bounded attempts and no duplicate mutation |
| SEC-05 | P0 | inspect bundle/log/error response | no secret/token/PII/stack trace |
| SEC-06 | P0 | archive ordinary entity | no destructive cascade; dependent rows intact |

### L. Notifications

For every critical event record recipient, channel, creation time, dedupe key,
provider failure behavior, user-visible state and audit row.

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| NOTIF-01 | P0 | booking created/responded/status changed | correct recipient and in-app deep link |
| NOTIF-02 | P0 | repeat triggering mutation | one logical notification/delivery |
| NOTIF-03 | P0 | fake email/Telegram failure then retry | failure audited; no false delivered state/duplicate |
| NOTIF-04 | P1 | Direct message and read state | authorized thread, singular message/read state |

### M. SEO, legal and redirects

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| SEO-01 | P0 | inspect canonical/trailing slash/city URLs | one canonical city-scoped URL |
| SEO-02 | P0 | inspect sitemap/robots before cutover | noindex retained until approved cutover |
| SEO-03 | P0 | run exact redirect/collision/catch-all audit | no collision, loop or wrong city |
| SEO-04 | P0 | 404/410 and mandatory legal pages | intended status and complete rendering |

### N. Payments/commercial limits

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| PAY-00 | TBD | founder classifies payment launch scope | explicit P0 blocker or P1/out-of-scope decision |
| PAY-01 | TBD | sandbox success/cancel/bank error/timeout | only if real checkout exists; correct entitlement |
| PAY-02 | TBD | signed/unsigned/wrong amount/currency/replay callback | reject invalid; one ledger payment |
| PAY-03 | TBD | sandbox refund/reconciliation | balanced ledger and access rollback |

Admin billing mutations alone are insufficient evidence of PAY-01..03. Never
perform a real payment.

### O. Responsive/accessibility and system

| ID | P | Action | Expected result / evidence |
| --- | --- | --- | --- |
| UX-01 | P0 | Chrome desktop/iPhone/Android/Safari smoke | usable critical paths, no horizontal scroll |
| UX-02 | P0 | keyboard/forms/modal focus | visible focus, labels, announced errors, trapped/restored modal focus |
| UX-03 | P0 | slow/offline during submit | honest loading/error and safe retry |
| SYS-01 | P0 | health/DB/storage/media/jobs/cron probes | all dependencies observable and healthy |
| SYS-02 | P0 | provider/webhook/rate-limit/error tracking probes | sandbox/canary result and structured audit |
| SYS-03 | P0 | exact-SHA build/env/secrets/migration status | reproducible RC, no local URL/missing secret |
| SYS-04 | P0 | backup/isolated restore | documented successful restore with checksums |
| SYS-05 | P0 | crawl/audit DB and storage | no 500/broken critical link/orphan/dangling media/duplicate lineage |

## 6. Two-pass execution and defect policy

Severity:

- **P0:** launch blocked, data loss, security/access violation, critical SEO
  loss, or a broken primary journey.
- **P1:** an important scenario is materially impaired but has a safe
  workaround, or is explicitly deferred by the founder.
- **P2:** non-critical UX, cosmetic, or secondary behavior.

### UAT PASS 1 — full critical-flow acceptance

Run all P0 rows and the founder-approved P1 scope. Register defects with
scenario ID, build SHA, environment, reproducible steps, evidence and severity.
Fix every P0. Fix P1 or record founder defer. Move P2 to backlog.

### UAT PASS 2 — regression and founder acceptance

Repeat every P0 journey and every failed/affected scenario on the release
candidate. Gate requires zero open P0, no unknown/blocked P0, explicit treatment
of every P1, planned production-only gates and recorded founder acceptance.

If a critical flow changes after Pass 2, run targeted Pass 3 for that area and
its authorization, notification, discovery and persistence dependencies.

UAT Definition of Done: open P0 = 0; launch-critical P1 = 0 or explicit founder
defer; all critical journeys PASS; BLOCKED/NOT_PERFORMED remain visible;
authenticated roles were actually exercised; SEO MIGRATION CLOSURE has its
own Go/No-Go; exact RC SHA is recorded; founder acceptance is recorded.

## 7. Evidence index and run summary

```text
Environment:
Build SHA:
Tester:
Started / finished:
Pass:
P0 total / PASS / FAIL / BLOCKED:
P1 total / PASS / FAIL / BLOCKED / DEFERRED:
Open P0 defects:
Founder defer decisions:
Production-only gates owner/date/window:
Founder acceptance:
Evidence root:
```

Launch readiness may be raised only from actual executions:

```text
Implementation readiness: ~80%
Migration readiness:      ~73%
Product UAT readiness:     ~10% (matrix ready; Pass 1 not run)
Production readiness:     ~30%
Overall launch readiness:  ~45% (capped by unknown UAT defects and production gates)
```

These are operational estimates, not calendar promises.
