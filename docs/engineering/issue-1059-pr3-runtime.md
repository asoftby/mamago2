# Issue #1059 — PR 3 review and runtime checklist

## Scope and rollout

One SSR events branch replaces both old Home blocks. With `HOME_FAMILY_PICKS_V2=1`,
a fresh existing family ACL profile chooses common SEO HTML for guests/no DOB,
or a stable personal skeleton followed by v2 delivery. Profile failure is an
explicit error, never an assertion that the account has no children. Default flag
OFF serves the single common section, independent of header persona. Other Home
sections and catalog entry semantics are unchanged. Feedback 5★ remains disabled.

`UserHomePreference` stores account-wide choice with an optimistic updatedAt
revision. Existing `childScopeFor` validates reads/writes; no new membership ACL.
The nullable child ID deliberately has no FK that could reveal/delete another
family's preference: stale choices reset after ACL validation. A schema migration
is included with explicit user approval; it was applied only to a disposable
PostgreSQL test container. DEV/PROD application and rollout require a future,
separately authorized release. Before enabling the flag, that release must have
applied the migration. Turning the flag OFF stops private POST delivery and uses
the common block; it does not roll back the table or enable the legacy duplicate.

## Delivery, cache and analytics

The PR 2 full-pool policy still consumes the shared ranking engine. Only the final
nonempty delivery records one HOME run/exposure set; intermediate 7-day passes,
context reads and visit cache hits do not record runs. Final profile signature is
revalidated before recording; aborted requests are checked before trace creation.
A disconnect after committing a trace can still leave a delivered-but-unseen run;
qualified CARD_VIEW remains the evidence of actual visibility, not a run alone.

Visit cache TTL is 120 seconds, shortened to the first occurrence start. Keys cover
actor, membership/profile signature, city, selection, policy and Minsk day/window.
Fresh context is required before a cache hit. Signature also covers dismiss/plan
revisions. Abort/generation guards reject late responses. Context listeners cover
family edits, auth, focus and scoped cross-tab dismiss storage; the outer auth
boundary hides stale-account UI while SSR chooses the new branch.

DISMISS is actor-scoped for 60 days, immediately excludes all chips, and remains
excluded while failed POSTs retry. Only verified exposures can supply attribution;
no-exposure retries require current public visibility. The old unscoped storage
key is ignored. Client storage is capped at 200; server history remains the
existing user-scoped policy. Unsupported/unavailable localStorage keeps visit
memory but cannot promise cross-reload retry during a server outage.

Qualified CARD_VIEW (50%, 1 second), DETAIL_OPEN and DISMISS use the existing
analytics service. Cached exposure identities retain their impression state.
runId/exposureId, policy, selection and HOME placement remain in delivery/card
context. PR 4 owns complete successful PLAN_ADD attribution, home_chip_select and
KPI schema. This PR does not emit speculative PLAN_ADD.

## Automated checks and benchmark

`pnpm test:family-home`: real SSR guest/loading/ready/empty HTML, card counts,
one save/CTA, chips ARIA, date/age/price, URL roundtrip, cache TTL/isolation/races,
server audience branching and API guards. Existing `pnpm test:family-picks` includes
these suites plus all PR 1/2 regressions.

`pnpm test:family-home-integration`: explicitly guarded local disposable *_test DB,
real account preferences/CAS, ACL, stale profile rejection, final trace/exposure
counts, verified dismiss, cache returns, deleted child and family departure.
CI runs it after applying migrations to its disposable PostgreSQL service.

Baseline before candidate-pool optimization, PostgreSQL 16, 800 published synthetic
events (100 UNKNOWN age, 700 confirmed), two children, cold final delivery:

| Scenario | Elapsed | SQL queries |
| --- | ---: | ---: |
| Complete 7-day pool → final 7 cards | 456 ms | 28 |
| Empty eligible 7-day pool → complete 30-day pool → 7 cards | 456 ms | 35 |
| Five sequential switches (three deliveries, two visit cache hits) | 1016 ms | 145 |

The switch count includes fresh profile/ACL context reads on every switch.
These are local baseline observations, not a production SLA or parallel-browser
latency claim. The pool is never truncated before age eligibility. Automated
browser viewport/layout and real network timing checks remain runtime acceptance
items below; SSR and pure cache tests do not establish visual CLS or all browser
race behavior. All test stages of the repository push gate passed locally. Production build
then hit the managed 8 GiB cgroup limit: exit 137, oom_kill increased 3 → 4.
The full gate therefore did not pass. After notification of this failure and
the required PR 3 exception, the user instructed to continue. The branch was
published with the local hook skipped for Draft review; production build remains
mandatory in GitHub CI. Draft: https://github.com/asoftby/mamago2/pull/1069.
CI outcome is reported in the PR/chat separately; no successful build is claimed.

Targeted ESLint passes. The broader `eslint src --quiet` additionally reports 17
existing errors in 10 files outside this diff; all 10 were compared byte-for-byte
with origin/dev and are unchanged (search/blog/plan UI, existing discovery/admin
components, stories and territory test). They are not counted as PR 3 validation
success and are left for separate tasks.

## Runtime acceptance after a future authorized DEV release

- [ ] Confirm expected git SHA, schema migration and flag OFF → exactly one common
  events block; flag ON → correct server-selected branch. No Feedback 5★ activation.
- [ ] At 360/390 px and desktop widths: guest SEO title (locative city), registration;
  authenticated no-DOB profile CTA; 1/2/3 children; horizontal overflow with many
  children; hide chip row with one child. No common flash on personal login.
- [ ] Keyboard Tab/ArrowLeft/ArrowRight/Home/End, pressed state, focus visibility,
  44px controls and live status. Check loading/ready geometry and actual CLS.
- [ ] 0/1/2/7 matches, honest 30-day empty, native poster dimensions, canonical
  free/from/range price, full age range, exact session's Minsk date and match names.
  Exactly one SaveHeart per card and one last catalog CTA (no duplicate link).
- [ ] Child without DOB stays selectable and requests DOB without a MATCH claim.
  Selected child persists on another device; deleted/ACL-inaccessible choice
  resets. Remove last DOB → common branch without signing in again.
- [ ] Change header persona: no effect on this block. Click catalog CTA: canonical
  age OR chips visible/resettable, no child IDs in URL; direct catalog stays normal.
- [ ] Under delayed network, rapidly switch 2–5 times, city, family, account,
  logout/login and DOB/interests; stale responses never replace the current UI.
  Confirm 403/404/409, timeout and 500 show safe loading/error rather than fallback.
- [ ] Dismiss across cached chips, offline/failed POST then reconnect/refetch,
  cross-tab and second adult: no resurrection or account leakage.
- [ ] Inspect DB/analytics: final HOME trace only, no intermediate 7→30 run,
  no new run/duplicate CARD_VIEW on cache return; correct exposure after a new
  delivery. Verify client exposure forgery fails. Save succeeds through existing
  flow without an invented PLAN_ADD; complete attribution remains PR 4.

No merge, deployment, DEV/PROD migration or PR 4 work is authorized by this PR.
