# Offer business/public/admin smoke — 2026-07-28

## Performed

```text
Public detail page for a DRAFT Offer (id cmrvxhmnf0006wsizxm7v38oc,
  wordpress-db:hb-programs:18932):        404 — correct, not publicly visible
Business offers API without auth:          401 — correct, auth-gated
0 console errors on the 404 page
```

## Not performed — flagged, not skipped silently

A full authenticated Business-cabinet + Admin-moderation UI walkthrough (log in as the owning
Business, view the Offer's card/status there; log in as admin/moderator, confirm the same state in
the moderation queue; attempt a cross-owner edit and confirm it's rejected) was **not performed** in
this session. Reasons, stated plainly rather than glossed over:

1. All 63 Offers are `DRAFT` and were created by the migration writer, not by any real Business
   account acting through the normal flow — there is no natural "owning Business session" to log in
   as without either creating test credentials or reusing a real user's session, which this closure's
   own safety posture (no invented state, no acting outside exact scope) argues against doing
   casually.
2. Since none of the 63 are published or even `PENDING`, the *expected* result in every surface
   (Business cabinet, Admin moderation queue) is simply "still DRAFT, not awaiting review, not
   public" — the same structural fact already established via code reading in
   `offer-classification-2026-07-28.md` (New finding #2). There's no drift to catch here that a full
   login flow would newly reveal.
3. CTA/tariff/checkout mechanics: per this closure's own rule, not asserting these as implemented
   without confirming in code — not verified in this session either way; flagged as a separate,
   pre-existing product/UAT scope item, not something this migration closure introduces or resolves.

**Recommendation**: once the founder decision on Offer publication path (New finding #2) is made and
at least one Offer is moved through it for real, that is the right moment for a full authenticated
business/admin/public three-way smoke — testing it against 63 uniformly-DRAFT rows today would not
surface anything the classification audit hasn't already established.
