# mamaGo Feedback — Place reputation read model (stacked on #585)

## What ships

**This is an isolated, off-by-default implementation.** New place page UI breaks out direct mamaGo reactions, confirmed event visits, completed offer bookings, and separately attributed live Google Maps rating and count. It also shows up to three venue-specific tag insights.

- No blended star/emoji quality score; direct place satisfaction and experience-at-event are distinct.
- `allSourceSignals` is the mathematical total of ratings across the four buckets, *not a count of unique authors or textual reviews*. Google ratings are never converted to emoji values. The publicly displayed combined total is off by default pending Google Platform terms review.
- Direct legacy mamaGo `PlaceReview` records are counted only when `source=MAMAGO` and `status=PUBLISHED`; imported rows with `migrationKey=placeReview:<id>` are deduped from legacy count.
- Event linkage requires `FeedbackReaction.occurrenceKey` equal to original `PlanItem.id`, `PlanItem.venuePlaceId` matching actual visited venue, FAMILY/CONFIRMED/not cancelled, and an ATTENDED Experience for the same actor/event. Neither current `Activity.placeId` nor `EventVenue.placeId` are sufficient historical evidence.
- Offer linkage requires `occurrenceKey=BookingRequest.id`, `publicationType=OFFER`, `status=COMPLETED`, `booking.placeId` equal to actual venue, and author/offer match. If service was delivered at HOME/OUTDOOR without matching booked venue, it is excluded. A published `Offer.placeId` alone does not qualify.
- `isPublicEligible=true` is required for every new reaction in public counts; private FAMILY notes and unfinished plans never enter the aggregate.
- Venue tags counted by distinct reaction actor; count shown only for 3 or more independently identified authors.
- No storage of fetched Google reviews; request-time metadata via Places API with no-store, explicit field mask, and no API credentials logged.

## Rollout flags (server env)

ALL DEFAULT TO OFF:

- `FEEDBACK_PLACE_REPUTATION_ENABLED=1` — render new read-only overview and source-separated legacy mamaGo reviews. Requires foundation SQL migration in PR #585.
- `FEEDBACK_GOOGLE_LIVE_ENABLED=1` — read current Google rating and userRatingCount from Places API on each eligible place page request; **has paid API cost** and can increase latency. Enable only after budget/quota, consent, and attribution review. Does not fetch Google review bodies.
- `FEEDBACK_COMBINED_GOOGLE_TOTAL_ENABLED=1` — show a single count for all four sources with the disclosure that it is not unique visitors; **legal/provider review required**.

If the DB migration is absent or loader fails, the place page falls back to its original view and logs a server error. This code does not change existing migrations, data or write endpoints. Disabling the flags is the immediate rollback.

## Verification pending

- CI/typecheck on stacked PR and full `check:push`.
- Check actual PROD/DEV PlanItem→Experience→FeedbackReaction and BookingRequest statuses with a read-only report on a database copy.
- Integration test against DEV DB for raw SQL enum casts and composite joins, including private plans and venue changes.
- Test 3 categories, no data, google off, missing Google Place ID, Google API non-200, high volume, Google attribution and mobile layout.
- Explicitly approve migrations and provider budget before enabling flags.
- Full cutover of old mixed star rating, old persisted Google review text and JSON-LD must be done before production rollout, not implied by this read projection.
