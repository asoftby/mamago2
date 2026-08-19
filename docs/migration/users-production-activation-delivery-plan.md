# Users production activation — delivery readiness + controlled delivery plan

**Status:** production activation *product flow* complete — provider wired,
manifest built, rehearsal passed, migrated-user login detection shipped,
`/activate` page shipped, delivery audit persistence shipped. **No
production email has been sent.** Real bulk delivery stays gated behind a
separate, explicit Go/No-Go — this document prepares that step, it does not
execute it.

---

## 1. Gap list — production delivery only

Reusing 100% of the existing activation foundation (request/complete
endpoints, hash-only `UserActionToken`, pending-activation lifecycle,
`activationEmailGate.ts`'s env gate, rate limiting). No second activation
flow was built.

| Gap | Status | Where |
| --- | --- | --- |
| Email provider adapter | **DONE** | [`activationEmailDelivery.ts`](../../src/server/auth/activationEmailDelivery.ts) — reuses `emailService`/Resend, lazily imported so LOCAL/DEV never needs email secrets to build or test |
| Template | **DONE (plain text, minimal)** | `buildMigratedAccountActivationEmailContent()` in the same file — subject + text body; no HTML/branding pass yet (P1 if founder wants a styled template) |
| Sender/from | **DONE (reused)** | `EMAIL_FROM`/`EMAIL_REPLY_TO`, same as every other transactional email |
| Activation URL | **DONE** | `buildMigratedAccountActivationUrl()` — `${NEXT_PUBLIC_APP_URL}/activate?token=...`; returns `null` (skips, never guesses a host) if the base URL isn't configured |
| Rate/batch limits | **DONE (reused)** | `activationRateLimit.ts` — existing Postgres-backed fixed window, already applied per-IP and per-email on the request endpoint; batch pacing for the production run itself is §3 below |
| Retry policy | **DONE (deliberately none automatic)** | A `FAILED` send is not retried by this code — matches Rule 6 (no automatic retry on a first write-run); retries are a manual, later, explicit re-request |
| Delivery audit | **DONE** | `ActivationDeliveryAudit` model (migration `20260728090000_add_activation_delivery_audit`) — every request writes BLOCKED_ENVIRONMENT/BLOCKED_KILL_SWITCH/QUEUED→SENT/FAILED, with masked recipient, provider, template, timestamps, provider message id, safe error code, and a hash-reference (`activationTokenId`, never the raw token) — no raw token, URL, email body, or provider secret ever stored |
| Bounce/failure handling | **NOT STARTED** | Resend bounce/complaint webhooks aren't wired; a failed/bounced send only shows up as `FAILED` in the audit table today, not proactively (P0 before real bulk send — see §4) |
| Kill switch | **DONE** | `MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=false` (or `_ENABLED=false`) takes effect on the *next* request — nothing to restart, nothing cached |
| Go/No-Go gate | **THIS DOCUMENT** | §4 below; still requires a human decision, not automatable |
| Migrated-user login detection | **DONE** | `src/app/api/auth/login/route.ts` — a `PENDING_ACTIVATION` account submitting the login form (any password) triggers the same activation-request flow and gets a neutral, distinct response; zero visual changes to the login form |
| `/activate` frontend page | **DONE** | `src/app/(auth)/activate/` — was the P0 gap flagged in the prior pass (link would have 404'd); also required adding `"activate"` to `KNOWN_ROOT_SEGMENTS` so the WP-legacy catch-all middleware stopped redirecting it |

---

## 2. What was proven (read-only + rehearsal, zero real sends)

- **Gate**: `resolveActivationEmailDelivery()` requires `NODE_ENV=production`
  **and** `APP_ENV=production` **and**
  `MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=true` **and**
  `MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=true` — any one flag
  missing/false returns `DELIVERY_DISABLED` and the request/complete route
  never reaches the email adapter at all.
- **LOCAL/DEV hard-disable**: re-verified directly against this shell's real
  `process.env` (not simulated) — `resolveActivationEmailDelivery()` returns
  `DELIVERY_DISABLED` here, and a rehearsal call with a real (fake-transport)
  sender injected still returns `SKIPPED` with zero transport calls.
- **Production-approved path**: proven with an injected fake/sandbox
  transport and an injected gate-environment override — no real
  `process.env` mutation, no network call, no real `emailService`/Resend
  import touched.
- **Token secrecy**: the raw token is used exactly once (build the URL, embed
  it in the email body) and never appears in the subject, in any
  `console.*` call, or anywhere else observable outside the transport
  payload itself.
- **One-time-use, expiry, invalid token, already-activated account, rate
  limiting**: all re-confirmed (existing endpoint/service tests re-run
  unchanged + new rehearsal scenarios) — see §4.
- **ADMIN/roles untouched**: ADMIN count and every fixture user's role were
  asserted unchanged before/after the rehearsal; the rehearsal fixture users
  and their tokens/audit rows/rate-limit entries are deleted in `finally`,
  leaving zero DB residue (verified: 0 leftover `activation-rehearsal*`
  users, 0 leftover `UserActionToken` rows, 0 leftover `RateLimitEntry`
  rows after the run).

## 3. Activation manifest

`docs/migration/users-production-activation-manifest.json` (built via
`pnpm migration:users:activation-manifest`, read-only, zero writes):

```text
totalMigratedUsers: 578   (564 clean + 14 manual/privileged; user:1 kept ADMIN excluded — no lineage; user:521/user:91 included, already USER)
eligibleCount:      578
exclusionCounts:    {}    (0 excluded — every migrated User is USER/BUSINESS_OWNER, PENDING_ACTIVATION, valid+unique email)
manifestHash:       56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1
```

Deterministic — rerunning the script against the same DB state reproduces
the identical hash. Excludes, by construction (never by a hand-picked
list): non-`PENDING_ACTIVATION` accounts, soft-deleted accounts, `ADMIN`/
`MODERATOR` roles, invalid email, duplicate email (defense-in-depth check;
`User.email` already has a DB-level unique constraint so this is
structurally always empty, but verified live rather than assumed).

---

## 4. Controlled production delivery plan (NOT executed — plan only)

1. **Exact RC SHA** — freeze the deploy commit before any send; record it in
   this doc's changelog when the real run is scheduled.
2. **Production backup** — fresh, verified-restorable backup immediately
   before step 4.
3. **Manifest hash verification** — re-run
   `migration:users:activation-manifest` against production and confirm the
   hash matches the one reviewed/approved here; any mismatch stops the run
   before a single email goes out (source data drifted since review).
4. **Canary batch** — a small, explicitly-picked subset (e.g. 3–5 accounts,
   ideally ones the founder personally controls) via the real
   `/api/auth/activation/request` flow with all four production flags on.
5. **Check delivery/provider/audit** — confirm the canary's `ActivationDeliveryAudit`
   rows show `SENT` with a real provider message id (not bounced — no
   webhook yet, so cross-check the Resend dashboard manually), confirm
   `AdminAuditLog` shows the expected `MIGRATED_ACCOUNT_ACTIVATION_TOKEN_ISSUED`
   rows, and manually click through the `/activate` link end-to-end for the
   canary accounts before trusting the flow for the rest.
6. **Sequential subsequent batches** — small fixed-size batches (size TBD by
   founder — the request endpoint itself is already per-IP/per-email rate
   limited, so batch pacing here is about provider/reputation limits, not
   the app's own limiter), each reviewed before the next starts.
7. **Stop-on-first-error** — any batch with a real failure (not an expected
   `SKIPPED`) halts the run; the already-sent prefix is not rolled back or
   retried automatically (Rule 6).
8. **No automatic full-retry** — a stopped run is resumed manually, scoped
   to exactly the remaining un-sent eligible users from the frozen manifest,
   never a blind full re-send.
9. **Kill switch** — flip `MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED`
   (or `_ENABLED`) to `false`; takes effect on the next request with no
   deploy/restart.
10. **Final delivery reconciliation** — `ActivationDeliveryAudit` now makes
    this a direct query: manifest-eligible count vs. `status='SENT'` count
    vs. `UserActionToken.usedAt IS NOT NULL` count (actually activated).
    Cross-check against the Resend dashboard until the bounce webhook (§1)
    exists.

**Explicit go/no-go blockers before step 4 can run for real:** the Resend
bounce/complaint webhook still isn't wired (§1) — a real batch send today
would have no proactive signal for bounced/rejected addresses beyond
`FAILED` at send time. Founder should explicitly accept that risk or wire
the webhook first. The `/activate` page and delivery-audit gaps from the
prior pass are both closed.
