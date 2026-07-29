# Activation canary plan — 2026-07-29

Status: **plan only — no real activation emails sent.** This formalizes
the PASS/STOP criteria for the canary already specified in
[`users-production-activation-delivery-plan.md`](users-production-activation-delivery-plan.md)
§4 ("Controlled production delivery plan (NOT executed — plan only)"). It
does not invent a new canary mechanism — it restates that plan's steps as
an explicit gate/criteria table and records the one open input (recipient
selection) as founder-required.

## Canary manifest (separate from the 578-recipient full manifest)

```text
ACTIVATION_CANARY_RECIPIENTS:
FOUNDER_SELECTION_REQUIRED
```

Requirements, per the delivery plan (unchanged, not relaxed):

- 1–3 (delivery plan says "3–5") founder-approved recipients — ideally
  accounts the founder personally controls.
- Status must be `PENDING_ACTIVATION` in the frozen manifest.
- Role must not be `ADMIN`.
- Valid, deliverable email address.
- Duplicate email count in the canary subset: 0.
- Exact manifest checksum re-verified against the frozen hash
  (`56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1`)
  immediately before send — any drift stops the run before step 4.
- All four production flags must be simultaneously true:
  `NODE_ENV=production`, `APP_ENV=production`,
  `MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=true`,
  `MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=true`. Any one
  `false` blocks all sends — this is the kill switch.
- Delivery audit (`ActivationDeliveryAudit`) must be enabled and observed
  for every attempt.
- Bounce/failure observation: no bounce webhook exists yet (delivery plan
  §1) — canary bounces must be checked manually against the provider
  (Resend) dashboard, not just the app's own `SENT` status.
- Token is one-time (`UserActionToken`), raw token must never appear in
  logs or `AdminAuditLog` — only the issuance event
  (`MIGRATED_ACCOUNT_ACTIVATION_TOKEN_ISSUED`) is logged.
- Role unchanged after activation (still `USER` or `BUSINESS_OWNER` per
  manifest, never elevated by the activation flow itself).

Do not choose canary recipients autonomously — this is explicitly a
founder decision, not an agent decision, per the delivery plan's own
wording ("ideally ones the founder personally controls").

## Canary PASS criteria

| # | Criterion |
|---|---|
| 1 | Provider (Resend) accepted the send for every canary recipient |
| 2 | Email physically received (manually confirmed, since no bounce webhook exists) |
| 3 | `/activate` link works end-to-end for every canary recipient, clicked through manually |
| 4 | User row transitions `PENDING_ACTIVATION` → `ACTIVE` |
| 5 | Role unchanged post-activation |
| 6 | `ActivationDeliveryAudit` shows `SENT` with a real provider message id for every recipient |
| 7 | `AdminAuditLog` shows the expected `MIGRATED_ACCOUNT_ACTIVATION_TOKEN_ISSUED` row per recipient, no raw token present |
| 8 | No security leakage (token not guessable/reused, one-time enforced) |

All 8 must hold for every canary recipient before subsequent batches are
authorized.

## Canary STOP conditions

| # | Condition | Action |
|---|---|---|
| 1 | Any bounce or provider rejection | Halt; do not proceed to subsequent batches; investigate before any further send |
| 2 | Wrong recipient (manifest drift) | Halt; re-verify manifest hash against frozen value before any retry |
| 3 | Broken activation URL (wrong origin, localhost leakage, malformed token) | Halt; this is a P0-class defect, fix and re-verify in a non-production environment first |
| 4 | Token leakage (raw token in logs, URL query strings visible in analytics, etc.) | Halt; treat as a security incident, not a retry-able failure |
| 5 | Role or status corruption (unexpected role change, status not transitioning to ACTIVE) | Halt; do not attempt automated correction — manual review required |
| 6 | Abnormal failure rate beyond the canary's small N (i.e., any real `FAILED`, not `SKIPPED`) | Halt per checklist §1 rule 6 — stop-on-first-error, no automatic retry |

Per the delivery plan: a stopped run is resumed only manually, scoped to
exactly the remaining un-sent eligible users from the frozen manifest —
never a blind full re-send.

## Sequential batches after canary

Batch size beyond the canary is explicitly **"TBD by founder"** in the
delivery plan — the request endpoint is already per-IP/per-email rate
limited, so batch pacing is about provider/reputation limits, not the
app's own limiter. Each batch: reviewed before the next starts,
stop-on-first-error, manual resume only.

## Explicit go/no-go blocker

Per the delivery plan (lines 125–130): the Resend bounce/complaint webhook
is not wired. A real batch send today has no proactive signal for
bounced/rejected addresses beyond `FAILED` at send time. **The founder must
explicitly accept this risk, or the webhook must be wired first, before
step 4 (the actual canary send) runs for real.** This gate is unchanged by
anything done in this session.

## Reconciliation query (post-canary and post-batch)

Per delivery plan §4.10: compare manifest-eligible count vs.
`ActivationDeliveryAudit` rows with `status='SENT'` vs.
`UserActionToken.usedAt IS NOT NULL` (actually activated), cross-checked
against the Resend dashboard until the bounce webhook exists.
