# Recommendation Data Foundation

## Status

Accepted architecture for mamaGo recommendation data and recommendation-producing surfaces.

## Core rule: one recommendation foundation

mamaGo must not implement separate recommendation algorithms for Telegram, My Plan, Home, Discovery, or future surfaces.

The shared pipeline is:

```text
UserEvent (raw behavior)
  -> UserBehaviorProfile (rebuildable projection)
  -> candidate generation
  -> shared ranking
  -> surface policy
  -> RecommendationRun
  -> RecommendationExposure
  -> UserEvent outcome
  -> RecommendationOutcome attribution
```

The first explicit post-plan outcome loop is:

```text
SAVE / PLAN_ADD (intent)
  -> ATTENDED (explicit experience outcome)
  -> EXPERIENCE_FEEDBACK (optional LIKE / NEUTRAL / DISLIKE)
```

`PLAN_ADD` is never treated as attendance. A past date, reminder, booking,
notification open, or content view cannot infer `ATTENDED`; only the
authenticated user action “Да, были” may create that outcome. Phase C records
these facts. Phase D interprets them only through a bounded, subject-aware
request-time affinity for selected owned profile subjects; they remain excluded
from global popularity and the account-wide behavior projection.

A surface may change composition constraints (item count, horizon, diversity, cooldown, minimum score, no-send gate), but it must not fork the core ranking/learning interpretation.

## Sources of truth

### Raw behavior

`UserEvent` remains the append-only first-party behavioral source of truth. Important events preserve semantic facts available at event time (category, genre, signals, format, age, price, planning context) so later learning does not depend on mutable publication taxonomy.

### Behavior projection

`UserBehaviorProfile` is a cheap, rebuildable projection. It is not a second event history. Semantic affinities use the canonical learning strengths in `src/server/services/recommendations/behaviorSignalWeights.ts`.

Negative actions (`UNSAVE`, `PLAN_REMOVE`, cancellation, negative feedback) affect affinity learning but do not decrement historical funnel counters.

### Recommendation trace

`RecommendationRun` records one invocation of a shared ranking pipeline for a surface and stores the algorithm/policy versions and compact context.

`RecommendationExposure` records only entities returned to the surface, with position, score, score breakdown and reason codes. Discarded candidates are intentionally not persisted to keep storage/load bounded.

`RecommendationOutcome` attributes an existing `UserEvent` to the exposure that caused it. Outcome rows do not replace or duplicate `UserEvent`.

### Impressions and dismissals

An **impression** is a `CARD_VIEW` sent when a card is ≥50% visible continuously for ≥1 s (`src/lib/analytics/impressionGate.ts`, `AnalyticsCardViewTracker` with `dwellMs`; meta `impression: true`). For a verified exposure the first qualified impression (`meta.impression === true`) sets `RecommendationExposure.deliveredAt`; later ones do not overwrite it. Actions are existing `UserEvent`s (`DETAIL_OPEN`, `SAVE`, `PLAN_ADD`, `CTA_CLICK`, ...) linked through `RecommendationOutcome`. `UserEventType.DISMISS` ("не интересно") is a client-sendable negative signal (`BEHAVIOR_AFFINITY_WEIGHTS.DISMISS = -2`) and is attributed the same way. The journal collections carousel and My Plan recommendation cards use the impression rule.

### «Для вашей семьи» (HOME, `family-picks-v1`)

Политика поверхности поверх общего движка, не отдельный engine: кандидаты и сигналы (популярность, интересы, история) берёт `rankPlanSuggestionsForCity`; слой `src/server/services/recommendations/familyPicks/` добавляет жёсткие фильтры (скрытое/в плане, 18+, возраст MISMATCH у всех детей, вне окна), возраст по каждому ребёнку (MATCH / UNKNOWN / MISMATCH; MATCH всегда выше UNKNOWN), баллы с весами из `config.ts` (возраст 25, интересы 25, дата 30, территория 10, история 10, бюджет 0), разнообразие (≤2 на категорию, ≤1 на бизнес, 1 слот «Попробуйте новое» последним), уровни fallback (`PERSONAL` → `AGE` → `POPULAR` → скрыт при < 3 карточек) с честными заголовками и коды причин с шаблонами («Подходит: …» только при AGE_MATCH). Окно показа: чт–вс → ближайшие сб–вс, пн–ср → 7 дней. Выдача: `GET /api/recommendations/family-picks`; запуск пишется в `RecommendationRun`/`Exposure` (`exposureId` = impressionId, `intent = family_picks`, `scoreBreakdown.isPromoted` под PR 5).

## Versioning

Every production recommendation run must have an `algorithmVersion`.

Surface policy is separately versioned through `RecommendationSurfacePolicy`. Policy versioning describes surface composition/constraints; it must never be used as a hidden duplicate ranking configuration.

This separation makes historic results explainable and allows comparison/rollback without rewriting behavior history.

## Surfaces

Current enum:

- `HOME`
- `DISCOVERY`
- `MY_PLAN`
- `TELEGRAM`
- `JOURNAL`

When a new surface is added, prefer reusing the shared candidate/ranking path and adding a surface policy. Creating a new `*RecommendationEngine` is an architecture violation unless the domain has genuinely different entities/objectives and the decision is explicitly documented.

## Telegram

Telegram is a recommendation consumer and learning surface, not a separate recommender.

Admin `Ranking -> Telegram` controls only Telegram surface policy: candidate horizon, result count, diversity, repeat cooldown, score/no-send gates and similar composition constraints.

Transport, bot health, templates and delivery errors belong to Communications/Telegram, not Ranking.

User settings control opt-in/channel/time/frequency only. They do not contain ranking weights.

Telegram feedback should produce a normal recommendation-attributed behavioral outcome (with reason-coded feedback), linked to the original `RecommendationExposure`.

### Current Telegram admin implementation

`/admin/ranking/telegram` is the policy/configuration surface for Telegram recommendations.

- It reuses the shared EVENT ranking contract `engagement-profile-interest-experience-v3` and does not define Telegram behavior weights. Profile-interest and subject-experience inputs are currently supplied only by authenticated My Plan; surfaces without them retain engagement/freshness ordering.
- `RecommendationSurfacePolicy` stores draft/published policy versions separately from `algorithmVersion`.
- The current policy fields are `resultCount`, `horizonDays`, `minimumScore`, `minimumResultCount`, `maxPerCategory`, and `repeatCooldownDays`.
- Preview applies the policy read-only and deliberately does **not** write `RecommendationRun` / `RecommendationExposure`; admin experiments must not pollute recommendation telemetry or learning.
- Publishing a policy does **not** enable Telegram delivery. Delivery remains a Communications concern and stays disabled until the explicit delivery task wires the published policy into a real send flow.

## Editorial collections

Editorial `Подборки mamaGo` are content/editorial objects. They must remain distinct from algorithmic recommendations even if both can be delivered through Telegram.

## Performance rules

- Passive high-volume events such as `CARD_VIEW` must not cause extra taxonomy queries when the surface already has the dimensions.
- Sparse high-value events may resolve semantic context server-side before the `UserEvent` write.
- Trace failures must never break the product action or recommendation response.
- Persist returned exposures, not every discarded candidate.
- Metadata remains compact; the public analytics endpoint currently enforces a 4 KB meta limit.

## Privacy

Recommendation trace account/session identifiers are logical, not hard foreign keys. Hard account deletion anonymizes `RecommendationRun.userId` and `sessionId` while preserving anonymous aggregate trace history, matching the existing `UserEvent` anonymisation approach.

## Current My Plan baseline

My Plan currently ranks real EVENT candidates using the existing engagement score and freshness tie-break. The first trace version is:

`engagement-profile-interest-experience-v3`

This version combines the bounded canonical system-interest boost with a
bounded `[-6,+6]` subject-aware outcome affinity derived from at most 200
immutable `ATTENDED` / `EXPERIENCE_FEEDBACK` events in a 365-day horizon.
Historical subjects match only by `kind + refId`; manual subjects never become
persistent preference identity. Non-matching and disliked candidates remain
rankable. Future ranking changes must intentionally bump `algorithmVersion`.

### Prepared Home policy: `family-picks-confirmed-v2` (PR 2, inactive)

`loadPersonalFamilyPicks` / `selectPersonalFamilyPicks` in the existing `familyPicks`
modules are an internal, read-only surface composition path. Public Home and its
legacy GET still use `loadFamilyPicks` / `family-picks-v1`; per-child public calls
remain disabled as established in PR 1. No feature flag enables v2 in this PR.

The prepared path resolves a fresh server profile through the existing family ACL,
validates ALL_FAMILY/CHILD selection before candidate loading, and consumes the
complete `rankPlanSuggestionsForCity` batch and its score. It does not define new
behavior weights, change Discovery membership, or require Feedback 5★.

At each confirmed occurrence, age fit is proved over the child's birth interval:
DAY is exact, MONTH (and legacy null precision) covers every possible day of its
month. Evaluation uses the occurrence's Europe/Minsk calendar date. Missing DOB
never becomes MATCH, including unrestricted events. Only proven matches are
eligible. One chosen occurrence owns the card date and its exact matched-child
list; matches on different dates cannot be combined into “all children”.

ALL_FAMILY puts AND first; OR is appended only if AND <4. Within a group, use the
shared score, then the chosen date, then a stable ID tie-break. Return up to 7
unique events, even when only 1–2 qualify; no hard diversity/novelty reservation
may remove AND or hide short results. Individual selection admits only that
child's confirmed matches. The window is 7 local calendar days from today,
expanded to 30 only when the final eligible 7-day result is empty.

Hydration rechecks published/live visibility and active business. Withdrawn and
past sessions are excluded; any stored sessions suppress nextOccurrenceAt
fallback, preventing resurrection of cancelled materialized dates. ALWAYS,
ON_DEMAND and RECURRING without a future confirmed date are not dated results.
The current ActivitySession schema has no authoritative sold-out field;
isSaleOpen=false or absent buyUrl must not be interpreted as sold out. The pure
occurrence contract can exclude an explicit trusted soldOut signal when one is
available; this PR invents no such signal from sale metadata.

The v2 loader returns policyVersion and sharedAlgorithmVersion, final window,
selection, READY/EMPTY/UNAVAILABLE and confirmed occurrence metadata. It writes
**no** runs/exposures for preview, empty results or intermediate fallback passes.
PR 3 must explicitly implement delivery, then trace the final returned set once;
preparing a response alone is not a qualified impression. v2 exclusions use the
existing active plan ACL and account-scoped 60-day DISMISS history; other adults'
rejections and browser anonymous IDs do not become this account's preferences.
