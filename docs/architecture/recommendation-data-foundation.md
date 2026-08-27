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

When a new surface is added, prefer reusing the shared candidate/ranking path and adding a surface policy. Creating a new `*RecommendationEngine` is an architecture violation unless the domain has genuinely different entities/objectives and the decision is explicitly documented.

## Telegram

Telegram is a recommendation consumer and learning surface, not a separate recommender.

Future Admin `Ranking -> Telegram` controls only Telegram surface policy: candidate horizon, result count, diversity, repeat cooldown, score/no-send gates, exploration ratio and similar composition constraints.

Transport, bot health, templates and delivery errors belong to Communications/Telegram, not Ranking.

User settings control opt-in/channel/time/frequency only. They do not contain ranking weights.

Telegram feedback should produce a normal recommendation-attributed behavioral outcome (with reason-coded feedback), linked to the original `RecommendationExposure`.

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

`engagement-freshness-v1`

Tracing this behavior does not silently introduce a new recommender. Future ranking changes must intentionally bump `algorithmVersion`.
