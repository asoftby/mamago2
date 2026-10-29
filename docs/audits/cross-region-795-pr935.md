# Issue #795 / PR #935: cross-region eligibility and disclosure

Continuation of `fix/795-region-threshold-config-20261029` targeting `dev`.
Initial verified base: `b8f91c1c3543e8c423108568e7f375cd62fa85e2`.
Reuses Territory/legacy mapping, Family/FamilyMembership, PlanItem, Boost,
CrossRegionEditorialOverride, User moderation/phone verification, and the
existing RecommendationRun/Exposure + UserEvent impression pipeline. No schema,
pricing, billing, new admin surface, or separate recommendation engine.
Reconciled with `origin/dev` at `e8bee6c0f898ed0a18f0faeb6c3947a945e621be`.

## Family signal rules

- Default: 50 distinct family IDs whose explicit `Family.homeCityId` is in the
  target regional scope. `CROSS_REGION_FAMILY_THRESHOLDS` JSON, keyed by Region
  slug, overrides the threshold; invalid values use 50. Never infer home from IP,
  browsing city, or Boost targets. Minsk uses `minskaya-oblast` for thresholds and
  paid targeting, including when legacy Minsk has a separate administrative region.
- Only current, non-cancelled CONFIRMED PlanItems for future events count. Past
  dated/session plans cannot qualify a future recurrence (Europe/Minsk civil day). Multiple
  dates, repeated additions, and both parents still count once per family/event.
- Family must be unarchived and at least seven days old. Contributor must be an
  active family member since before the plan addition, ACTIVE, not deleted, not
  staff (shared canonical audience roles), with a unique verified phone verified
  before adding. New families, departed members, unverified, limited, suspended,
  banned and deleted accounts cannot contribute.
- An active family member owning the publication or owning/actively belonging to
  its business excludes the entire family for that publication, including a plan
  addition made by another parent. Existing user moderation is the revocation
  mechanism; no separate fraud account registry is introduced.
- This is a conservative, inspectable abuse barrier, not proof of real-world
  household identity. Several mature verified accounts can still collude;
  residential evidence and device/IP profiling are not introduced.

## Reasons, audit and impressions

Eligibility is live, without the previous five-minute eligibility cache. Current
family evidence takes precedence over editorial permission; a paid-only admission
gets `PAID_BOOST`. Editorial permission requires its existing region, reason,
author and an exclusive `expiresAt > now` boundary. Strict user geography skips
all three exceptions. Existing public visibility, date, category and price
predicates remain outside the exceptions.

Returned cards record `FAMILY_SIGNAL`, `EDITORIAL_OVERRIDE` or `PAID_BOOST` in
existing server RecommendationExposure reasonCodes. Audit includes only aggregate
family count, override ID and `isPromoted`, never family identities. Paid status is
independent of organic eligibility, so an organically eligible paid card is still
marked. Hydration-only queries do not trace a second set: paginated surfaces trace
the final restored order. Public qualified CARD_VIEW metadata carries the reason
and exposure ID via the existing tracker. Server traces audit the decision; a
client-supplied impression reason is not an authoritative eligibility decision.
Guest listing exposures do not gain a new authenticated identity/attribution model.

## Advertising and pagination

EventCard and OfferCard use the existing outline Badge: `Реклама` (title: `Платное продвижение Boost`).
The adapter passes disclosure to public event consumers; offer consumers pass the
same flag explicitly. UI Lab previews the existing Badge state. No pricing change.

A stable composition pass reserves one paid slot per four cards while comparable
organic inventory exists. Events compose only within contiguous ten-point bands
of the existing temporal score. Paid and organic streams keep their own rank;
no candidate is discarded, duplicated, or replaced with worse temporal inventory.
Scarcity can exceed 25%; this is intentionally a relevance-aware composition limit,
not a promise of an absolute share on every page/filter or infinite-scroll chunk.
The existing score formula, age partition, personal context and pagination remain.
The existing multiplier is applied only to geographically applicable Boost rows;
a campaign for another region cannot silently raise organic relevance. The shared
Boost geography helper is also used by the cached classes ordering.

Ranked ID pools retain their existing 60-second TTL. Visible IDs are checked live
on hydration; a revoked/expired candidate is omitted, never reconstructed from
cached metadata. Counts/new admissions may lag up to that TTL, and a revocation
can temporarily leave a short page. Threshold configuration is part of the pool
cache key. No renumbering or cursor rewrite is introduced.

## Verification and limits

PostgreSQL behavior tests run on disposable databases and in mandatory CI:
49/50, duplicates, two parents, cancellation/deletion, current home region,
moderation/verification, family age, organiser family, membership departure,
editorial expiry, targeted/expired Boost, strict city, regional Marina Gorka,
price relevance, all three reasons and persisted exposure audit. Existing
pagination, age policy, threshold/configuration and impression-gate tests remain.

DEV smoke/visual approval is still a pre-merge acceptance step from #795; this PR
completion does not merge or deploy. Static previews of the actual paid/organic EventCard and OfferCard with production
CSS were checked at 320/375/768/1200 px; this is not a live DEV flow or owner visual approval. Full repository ESLint has existing debt recorded
under BACKLOG-122; changed task files are checked separately.

## Changed files

- `.github/workflows/ci.yml`
- `docs/audits/cross-region-795-pr935.md`
- `docs/engineering/backlog.md`
- `src/app/(ui)/ui-lab/_sections/DesignSystemFoundationSection.tsx`
- `src/components/discovery/DiscoveryActivitiesGrid.tsx`
- `src/components/discovery/KudaMasonryListing.tsx`
- `src/components/events/EventCard.tsx`
- `src/components/events/eventCardAdapter.ts`
- `src/components/offers/OfferCard.tsx`
- `src/features/city-home/components/CityHomeContentRows.tsx`
- `src/lib/decision/decisionContext.ts`
- `src/lib/discovery/promotionComposition.test.ts`
- `src/lib/discovery/promotionComposition.ts`
- `src/server/discovery/classesDiscoveryFeed.ts`
- `src/server/discovery/classesListingPage.ts`
- `src/server/discovery/crossRegionFamilySignal.contract.test.ts`
- `src/server/discovery/crossRegionFamilySignal.integration.test.ts`
- `src/server/discovery/crossRegionFamilySignal.ts`
- `src/server/discovery/crossRegionThreshold.test.ts`
- `src/server/discovery/crossRegionThreshold.ts`
- `src/server/discovery/kudaDiscoveryFeed.ts`
- `src/server/discovery/kudaListingCompleteness.contract.test.ts`
- `src/server/discovery/kudaListingPage.ts`
- `src/server/geo/boostRegionTargeting.test.ts`
- `src/server/geo/boostRegionTargeting.ts`
- `src/server/services/recommendations/RecommendationTraceService.ts`
- `src/types/activity.ts`
