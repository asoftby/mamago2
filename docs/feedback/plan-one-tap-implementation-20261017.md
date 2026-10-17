# Feedback 1.0 — My Plan single-tap private reactions

Stack: PR #585 (schema) → PR #586 (reputation) → this PR.

## Behavior (feature flag off by default)

- Runtime env `FEEDBACK_V1_WRITE_ENABLED=1` (server-only): GET /api/plan/experiences includes `feedbackV1Enabled: true`; POST /api/plan/experiences/:id/feedback saves a user's personal sentiment without phone or optional text.
- Initial emoji tap records ATTENDED for the plan item, then feedback. Existing attended Experience goes straight to feedback. User sees immediate confirmation and card hides after 3 seconds unless they focus/type optional text.
- Text submission still requires a verified phone, then writes a `FeedbackReview` in `PENDING`. No text is public before moderation. If phone verification is needed, text remains in the form.
- Reaction shadow-writes to `FeedbackReaction` by `user:<id>` and the original plan item identity; `isPublicEligible=false`, `visitStatus=SELF_REPORTED`. No current venue is presumed to be the visited venue and `venuePlaceIdAtVisit` remains NULL.
- Reacting again updates the existing Experience sentiment and shadow reaction (no new vote). The old non-v1 endpoint retains its one-time conflict rule and phone gate.
- Family members cannot edit another adult's Experience in v1; prompts for non-owned experiences are hidden, though the family visit history remains visible.
- If the Feedback shadow write fails after the Experience is saved, POST returns an error; retry is idempotent. The underlying Experience remains a recoverable source of truth for future reconciliation.

## Required before flipping flag

1. PR #585 and #586 merged to dev and the foundation migrations applied only after backup and rehearsal. New application build deployed to DEV; don't set write flag during a rolling migration.
2. Check new API endpoint end-to-end on DEV, with/without phone and multiple adults sharing a family plan. Verify old/legacy behavior with flag OFF.
3. Verify reconciliation for partial writes; confirm PENDING review is not accidentally exposed via legacy PlaceReview UI.
4. Finish tag-chip persistence, public moderation and actual visit verification before enabling new public reputation stats. The new reaction remains private by default.
5. Test slow network / double tap / close during reaction; optional text must remain editable and retryable. No PROD deploy in this PR.

## Known limitation

This is a first working vertical slice for **event visits from My Plan**. It does not yet replace public feedback forms for places, offers and articles, and the 20 admin tags are not yet wired into this My Plan card. The rollout flag must remain OFF until those separate integration gates are met.
