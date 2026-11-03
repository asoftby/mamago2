# Family Home analytics — Issue #1080 / #1059 PR 4

Scope: existing UserEvent → RecommendationOutcome → RecommendationExposure →
RecommendationRun only. No schema, migrations, ranking weights or feature flags
change. HOME_FAMILY_PICKS_V2 remains OFF by default. Feedback 5★ stays off.

## Save contract and trust boundary

FamilyHomeResults passes optional `planAttribution` through SaveHeart and the
common save flow. Only intentional `action=plan` sends
`planAddSource=home-family-picks` and a specific `recommendationExposureId`.
Other SaveHeart call sites retain the old contract. Ideas, cancellation and
removals never send this contract. Auth resume preserves the date string and
exposure, but does not transfer exposure ownership to the newly signed-in user.

POST /api/save/plan uses the existing addPlanItem / occurrence resolution and
family ACL. Home writes serialize using a PostgreSQL transaction advisory lock
on the existing family-read scope (or actor scope with family reads disabled)
and activity. Retrying, changing audience, changing date or selecting a
completed occurrence on its original date yields `created=false`: no new
PLAN_ADD. Existing plan-audience snapshots remain on the route's existing path.
This lock coordinates Home requests; it does not retrofit concurrency control
onto unrelated legacy writers.

Only a committed newly created EVENT plan invokes the Home telemetry path.
The server checks exact exposure/entity match, user ownership, HOME surface and
an exposure age of at most 120 minutes. Client anonymous/session identity cannot
substitute for user ownership here. There is no recent-exposure fallback for
Home. Missing, malformed, foreign, mismatched or stale exposure still permits
the plan write, but the event loses Home claims and decisionId; HOME KPI is zero.
Legacy My Plan / idea attribution (including guest identity semantics) retains
its existing verification/fallback and asynchronous outcome behavior.

For verified Home, UserEvent and RecommendationOutcome are committed **in one
transaction**, using the shared trace verifier/linker, and awaited before the
route responds. Unique idempotencyKey `home-plan-add:<planItemId>` owns all
positive side effects. Metadata carries source=recommendation, section=home,
recommendationSurface=home, placement=HOME_FOR_FAMILY, homePlanAddVerified=true,
planItemId, plan-date facts and verified trace IDs. decisionId is the verified
run ID. FIRST_PERSONALIZED_PLAN_ADD uses surface=home when Home is the user's
first personalized save. This pre-existing milestone is best effort and not
the primary KPI or an additional positive recommendation outcome.

### Explicit reliability boundary

The product plan write commits **before** analytics. No existing durable outbox
covers UserEvent. A process crash between these commits, database outage, or
failed exposure verification can undercount a committed plan. We do not claim
atomic product+analytics delivery or invent a positive signal on an existing
plan retry. The response includes `homeAttributionStatus`:

- `recorded`: verified event and outcome have both committed (also on telemetry idempotency retry).
- `unattributed`: plan saved with no valid Home exposure; no Home outcome.
- `unavailable`: plan saved, analytics transaction failed; logged by existing server logging.
- `existing`: no new product plan, no additional PLAN_ADD/outcome.

An outcome failure rolls back its paired PLAN_ADD, so it cannot silently count
as verified KPI. Behavior-profile and promotion projections remain existing
rebuildable, asynchronous consumers. The public analytics endpoint rejects
PLAN_ADD and FIRST_PERSONALIZED_PLAN_ADD, like other existing server-only events;
a client click cannot fabricate the product fact.

## Interactions and privacy

Only the explicit chip handler emits FILTER_APPLY/action=home_chip_select.
It compares the reconciled current choice before beginning a new save: same
chip is a no-op. CHILD→CHILD, CHILD→ALL_FAMILY and ALL_FAMILY→CHILD each emit
once. SSR, preference refresh, focus, cache and account sync never call it.
Events include selectionMode=CHILD|ALL_FAMILY, section=home and
placement=HOME_FOR_FAMILY. No child IDs, names or birth dates enter these
client events (including card/detail/dismiss metadata). Failed telemetry cannot
block selection. The final catalog Link emits CTA_CLICK/targetAction=catalog
and keeps its one existing navigation. The error-state catalog Link has the
same measurement. Neither emits PLAN_ADD or creates a recommendation outcome.

Existing card tracking still uses the impressionGate ≥50% visible continuously
for ≥1000ms, deduplicated by exposure and reset only with a new run. DETAIL_OPEN
and DISMISS keep the existing event types and verified exposure propagation.
Client impression qualification is a browser observation, not a server proof
of human attention. Server-side subjects snapshots retain the existing ACL,
role/age-range contract; those IDs are not sent by client interaction analytics.

## Read-only KPI / smoke query

`readFamilyHomeKpi` in `src/server/services/analytics/familyHomeKpi.ts` contains
parameterized SELECT-only SQL; no new endpoint, storage or analytics engine.
Invoke from an authorized server reporting context, e.g.:

```ts
const counts = await readFamilyHomeKpi({
  from: new Date("2026-11-03T00:00:00+03:00"),
  to: new Date("2026-11-04T00:00:00+03:00"),
  // cityId, eventId and userId optionally scope the aggregate; never print IDs.
});
console.log(counts);
```

Window is event.createdAt in [from,to), with explicit timezone at the caller.
Primary `planAdds` is COUNT(DISTINCT meta.planItemId), requiring matching
UserEvent/outcome event type, entity, actor, decisionId, exposure and HOME run,
server-only idempotency key, verified marker, source, section and placement.
Old raw PLAN_ADD, other surfaces, unverified claims and client-ingested rows
are excluded. Deleting a plan later does not erase a historical successful
addition. Cascaded trace deletion can remove attribution from historical
reports; the query does not manufacture replacement links.

Other counts: qualified CARD_VIEW (`meta.impression=true` plus linked HOME
trace), DETAIL_OPEN, DISMISS, FILTER_APPLY(home_chip_select), CTA_CLICK(catalog).
`exposedUsers` counts distinct authenticated actors with qualified impressions,
not returned recommendations, runs, page views or chip clicks.
`planAddsPerQualifiedImpression` = distinct verified additions / qualified
CARD_VIEW rows; null when denominator=0. It is an action ratio, can exceed 1,
and is **not** a user conversion rate. Unseen saves are not silently inserted
into the denominator. Event-scoped reports return null for block-wide chip/CTA
counts, which have no event identity. Output contains only aggregate numbers
or null, never user/child/plan/exposure identifiers. Access control for running
these server-only reporting queries remains the existing reporting context.

## Automated and runtime review

- `pnpm test:family-home-analytics`: optional/legacy save contract; ideas, cancel,
  removal, failed POST; auth resume/date; chip transitions/privacy; CTA; passive wiring.
- `pnpm test:family-home-analytics-integration`: disposable local *_test DB,
  explicit FAMILY_PICKS_TEST_DB=1; real writer/ACL/trace/KPI; duplicates,
  concurrency, spoof/mismatch/surface/staleness, write failure, outcome rollback,
  idempotency and aggregate privacy. Synthetic failure trigger is created and
  dropped only inside the isolated test database.
- Existing family-picks, audience snapshot/plan visibility, impressionGate,
  decision-attribution and ingestion tests remain enabled. CI runs production
  build and the new PG suite alongside existing Family Picks and recurrence.

For independent runtime review after a separately authorized DEV release:
use the PR 3 checklist (`issue-1059-pr3-runtime.md`); enable no flags here.
Verify one saved plan's server event/outcome/decisionId; retry/move/audience
produces no positive increment; browser network for ideas/cancel/removal sends
no Home plan contract; foreign exposure still saves but KPI=0; chips/focus/CTA
counts and client payload privacy; confirm no Feedback 5★. DEV/PROD migration,
flag activation, merge and deployment require separate authorization.
