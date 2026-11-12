# Unified Boost v1 — Business publications

**Scope:** published Event (Activity `type=EVENT`) and Offer. **Place is excluded** by explicit product decision on 2026-11-12.

## Policy
- One free Boost per `Business.id` in a **rolling 24-hour window**, starting at the previous free Boost's `startAt`; business-local calendar midnight does not reset the quota. A free Boost lasts exactly 24 hours.
- Eligible targets: business-owned publicly listed Event, or business-owned published Offer backed by a publicly visible Place. Expired, unpublished, archived, inactive-business and foreign content is ineligible.
- No overlapping Boosts (paid or free) on the same target; a free Boost does not authorize paid overlap/extension.
- Paid purchases are independent of the free quota and allowed on *other* targets. Existing paid 1/3/7-day price configuration, region targeting, ledger atomicity and request-key idempotency remain authoritative. No active server prices means no checkout, not a guessed price.
- Free runs in the target's organic region only. Paid can target permitted regions. No Boost changes access, public status, date/age/category eligibility or strict geography. Boost is a bounded ranking signal, **not** a guarantee of placement.
- Reuse the existing `Boost` database table, `getPublicListingActivityWhere`, `getPublicPublishedOfferWhere`, `kudaDiscoveryFeed`, `classesDiscoveryFeed`, and the existing paid purchase pages. Do not introduce parallel ranking, payments or promotions.
- Keep native media ads (#1235) separate from Boost.

## Implementation notes
1. Serialize free activations with a `Business` row lock inside a database transaction; check `isFreeDaily` Boost `startAt > now - 24h` before insert; show next availability from the most recent `startAt + 24h`. Keep legacy `freeDailyDateKey` and unique index for backward compatibility.
2. Do not introduce `placeId` on Boost. Existing historical free Boosts remain in the cooldown timeline.
3. Promote paid > free in score while retaining the composer’s paid card density limit. Free must not use the old +1000 score.
4. Expose one navigation entry for both Event/Offer, offering the shared free action and existing paid purchase routes; never claim payment is enabled unless prices are available.
5. Analyze views/saves/CTA from existing UserEvent telemetry; figures are observations, not causal lift.

## Verification and release gates
- Boundary 23:59 → 00:01 denied; exactly 24h after last start allowed, subject to existing active-target lock.
- Concurrent actions by the same business: at most one write and no corruption.
- Event and Offer eligible, Place deliberately absent; archived, foreign and non-public targets rejected server-side.
- Active free blocks paid on the same target but not on a different target. Paid never spends free allowance.
- FREE score below PAID; no boosts crossing geographic/content filters.
- Typecheck, tests, CI and live DEV smoke required before merge; not merged or deployed as part of this PR.
