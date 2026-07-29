# Activation canary plan — 2026-07-29

Status: **plan only — no real activation emails sent.** This formalizes
the PASS/STOP criteria for the canary already specified in
[`users-production-activation-delivery-plan.md`](users-production-activation-delivery-plan.md)
§4 ("Controlled production delivery plan (NOT executed — plan only)"). It
does not invent a new canary mechanism — it restates that plan's steps as
an explicit gate/criteria table and records the one open input (recipient
selection) as founder-required.

## Founder input fields (2026-07-30 — fill in before canary send)

| Field | Recipient 1 | Recipient 2 | Recipient 3 (optional) |
|---|---|---|---|
| Email | `FOUNDER_INPUT_REQUIRED` | `FOUNDER_INPUT_REQUIRED` | `FOUNDER_INPUT_REQUIRED` |
| Email confirmation (re-typed) | `FOUNDER_INPUT_REQUIRED` | `FOUNDER_INPUT_REQUIRED` | `FOUNDER_INPUT_REQUIRED` |
| Current status = PENDING_ACTIVATION | `FOUNDER_INPUT_REQUIRED` (must verify against production DB before send) | same | same |
| Role | `FOUNDER_INPUT_REQUIRED` (must not be ADMIN) | same | same |
| `sourceRecordKey` | `FOUNDER_INPUT_REQUIRED` (from the frozen 578-user activation manifest) | same | same |

Do not fill these in with guessed or convenient values — each row must be
verified against the production `User` table and the frozen activation
manifest (hash `56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1`)
immediately before use. Recipient 3 is optional per the delivery plan's
"3–5 accounts" range; 2 is the minimum.

## Proposed batch sequence (2026-07-30 — sizes proposed here, still subject to founder approval)

| Step | Size | Gate before proceeding |
|---|---|---|
| Canary | 2–3 | All 8 PASS criteria below hold for every canary recipient |
| Batch 1 | 25 | Canary PASS + reconciliation query clean (see below) |
| Batch 2 | 50 | Batch 1 reconciliation clean, 0 unexplained failures |
| Batch 3 | 100 | Batch 2 reconciliation clean, 0 unexplained failures |
| Remaining batches | Rest of the 578-eligible manifest, after reconciliation | Each prior batch's reconciliation clean; stop-on-first-error still applies within every batch |

This sequence is a **proposal**, not yet a founder-approved fixed plan —
the delivery plan explicitly leaves subsequent batch size "TBD by
founder." It is offered here as a concrete, conservative doubling-ish
ramp (2–3 → 25 → 50 → 100 → rest) for the founder to approve, adjust, or
replace.

## Exact commands (documented — NOT executed)

**1. Manifest hash re-verification (preview, read-only, before any send):**
```bash
pnpm migration:users:activation-manifest
# Compare the resulting hash against the frozen value:
# 56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1
# Any mismatch stops the run before step 2.
```

**2. Send (per recipient — the real endpoint, unauthenticated, always
returns a generic 202 regardless of outcome; the actual result is only
visible via the DB audit tables in step 3, never the HTTP response
itself):**
```bash
# Realistic path: the founder/canary recipient uses the production
# login page's "resend activation" / activation-request flow in the
# browser, exactly as a real end user would.
#
# Raw endpoint shape, for engineering reference only (needs a trusted
# proxy IP header in front of it in production — this is not meant to be
# curl'd directly from an operator machine):
curl -s -X POST https://<production-domain>/api/auth/activation/request \
  -H "Content-Type: application/json" \
  -d '{"email":"<recipient-email>"}'
```
All four env flags (`NODE_ENV=production`, `APP_ENV=production`,
`MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=true`,
`MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=true`) must be true on
the server for this to do anything at all — this is the kill switch
referenced throughout this plan.

**3. Reconcile (read-only SQL, run after every batch including the
canary):**
```sql
-- Per-recipient delivery status
SELECT
  "userId",
  "recipientMask",
  "status",
  "providerMessageId",
  "sentAt",
  "errorCode"
FROM "ActivationDeliveryAudit"
WHERE "userId" IN (/* canary/batch user ids */)
ORDER BY "requestedAt" DESC;

-- Activation completion check (token actually used = user really activated)
SELECT
  u.id,
  u.email,
  u.status,
  u.role,
  t."usedAt"
FROM "User" u
LEFT JOIN "UserActionToken" t
  ON t."userId" = u.id AND t.purpose = 'ACCOUNT_ACTIVATION'
WHERE u.id IN (/* canary/batch user ids */)
ORDER BY t."usedAt" DESC NULLS LAST;
```
Cross-check `providerMessageId` against the Resend dashboard manually
until the bounce webhook exists (see the bounce-handling decision below).

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
| 7 | More than one unexplained delivery error within a single batch (batches 1–3+, not the canary — canary uses rule 6's zero-tolerance threshold) | Halt; do not proceed to the next batch size until the cause is identified |
| 8 | Reconciliation audit mismatch (manifest-eligible count vs. `ActivationDeliveryAudit` `SENT` count vs. `UserActionToken.usedAt` count don't reconcile) | Halt; re-run the reconciliation query from this doc before any further send |

Per the delivery plan: a stopped run is resumed only manually, scoped to
exactly the remaining un-sent eligible users from the frozen manifest —
never a blind full re-send.

## Sequential batches after canary

Batch size beyond the canary is explicitly **"TBD by founder"** in the
delivery plan — the request endpoint is already per-IP/per-email rate
limited, so batch pacing is about provider/reputation limits, not the
app's own limiter. Each batch: reviewed before the next starts,
stop-on-first-error, manual resume only.

## Bounce handling decision (2026-07-30)

Checked directly against the current code: `resend` (`^6.12.4`) is the
only email-provider dependency in `package.json` — there is no `svix`
dependency (Resend's recommended webhook-signature-verification library)
and no webhook route anywhere under `src/app/api/` for Resend (the only
webhook routes in the codebase are for the Telegram bot integration,
unrelated). `ActivationDeliveryStatus` (the enum actually used by
`ActivationDeliveryAudit.status`) has exactly five values:
`BLOCKED_ENVIRONMENT`, `BLOCKED_KILL_SWITCH`, `QUEUED`, `SENT`, `FAILED` —
there is no `BOUNCED`, `DELIVERED`, or `COMPLAINED` state modeled at all.
**This means Option A (webhook ready) is not available today, and would
require both a new webhook route and a schema migration to add
bounce/complaint states — not just wiring an existing route.**

**Decision: Option B — temporary manual reconciliation**, for the full
578-recipient delivery (and every batch within it, including the canary):

1. After every send (canary or batch), run the reconciliation SQL in this
   doc against `ActivationDeliveryAudit` and `UserActionToken`.
2. Cross-check every `providerMessageId` from that query against the
   Resend provider dashboard manually — Resend's dashboard does show
   delivery/bounce/complaint status per message even without a webhook;
   this is a manual look, not an API integration.
3. **Batch stop until reconciliation is complete** — do not start the next
   batch size (25 → 50 → 100 → rest) until every prior batch's messages
   have been manually checked in the Resend dashboard and match the
   expected `SENT` count with no unexplained bounces.
4. This decision does **not** propose building a general email
   deliverability platform — it is scoped exactly to what this migration's
   578-recipient delivery needs: a documented manual step, not automation.

This does not close the underlying gap — a real webhook (with its own
schema migration) would be a genuine product improvement, but building it
is out of scope for this GO/NO-GO session per the instruction not to
change runtime code without a proven defect. **The founder must explicitly
accept the manual-reconciliation approach for the full 578-recipient
delivery**, or request the webhook be built first — this is the same
either/or the prior delivery plan already flagged, now with the exact
missing pieces (`svix`, webhook route, enum values) confirmed rather than
assumed.

## Reconciliation query (post-canary and post-batch)

Per delivery plan §4.10: compare manifest-eligible count vs.
`ActivationDeliveryAudit` rows with `status='SENT'` vs.
`UserActionToken.usedAt IS NOT NULL` (actually activated), cross-checked
against the Resend dashboard until the bounce webhook exists.
