# Launch-window checklist — 2026-07-30

One-page, day-of-launch checklist. Synthesizes
[`go-no-go-readiness-2026-07-29.md`](go-no-go-readiness-2026-07-29.md)'s
decision matrix, [`production-migration-runbook-2026-07-29.md`](production-migration-runbook-2026-07-29.md)'s
execution order, [`dns-cutover-plan-2026-07-29.md`](dns-cutover-plan-2026-07-29.md)'s
sequence, and [`activation-canary-plan-2026-07-29.md`](activation-canary-plan-2026-07-29.md)'s
canary steps into one ordered list. Does not replace those documents —
follow them for the full detail behind each line.

## Before the window opens (can be done ahead of time)

- [ ] All `FOUNDER_INPUT_REQUIRED` fields filled in: hosting target, DB
      target, storage target, deploy mechanism, DNS provider, domain,
      secrets owner, launch window, responsible operator
      (`production-migration-runbook-2026-07-29.md` §0).
- [ ] Rollback-trigger threshold decided and written down (not decided
      during an incident).
- [ ] Activation canary recipients (2–3) selected and verified against
      production `User`/manifest data.
- [ ] Batch-size ramp approved (proposed: 2–3 / 25 / 50 / 100 / rest) or
      replaced with founder's own sizes.
- [ ] Bounce-handling approach accepted: manual reconciliation (Option B —
      no webhook exists), or webhook + schema migration built first.
- [ ] Deferred content dispositions signed off: 2 CITY_BLOCKED Places,
      Event 64159, Mogilev Route, Offer Class H/I (36 rows).
- [ ] Content/source freeze window declared; WordPress source frozen
      read-only.

## Launch window — in order

1. [ ] **Freeze** confirmed active.
2. [ ] **Production backup** taken; restore command verified available
       (rehearsed locally this session — DB and storage both PASS).
3. [ ] **Deploy** exact frozen RC SHA (or founder-approved successor SHA
       after any P0 fix) — indexing OFF (`SITE_NOINDEX_FORCE=true` or
       `SITE_INDEXING_ENABLED` unset/false).
4. [ ] **Migrate**, in order: Users → Businesses → Places → Offers →
       Routes/RouteStops → Events → Articles → Redirects → Media.
       Sequential, stop-on-first-error, one idempotency rerun per entity.
5. [ ] **Content verification** — spot-check public URLs per entity.
6. [ ] **Activation canary** — manifest hash re-verified against
       `56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1`
       before send; canary sent; reconciliation query run; Resend
       dashboard checked manually for every canary message.
7. [ ] **Public smoke** — repeat this session's mobile + desktop UAT
       spot-checks against the real production deploy.
8. [ ] **Redirect/SEO smoke** — validator re-run, sitemap/robots checked.
9. [ ] **DNS switch** (only if host/IP changes) — TTL lowered in advance
       if planned.
10. [ ] **Post-DNS verification** — correct origin, no mixed old/new
        responses.
11. [ ] **Indexing switch** — only after 7–10 are clean and 0 open P0:
        `SITE_INDEXING_ENABLED=true`, confirm force/default flags aren't
        still forcing noindex.
12. [ ] **Monitoring window opens** — first 15 min / first hour / first
        24h checks per `launch-monitoring-plan-2026-07-29.md`.
13. [ ] **Sequential activation batches** (25 → 50 → 100 → rest) — each
        gated on the prior batch's reconciliation being clean.

## Stop-and-do-not-proceed triggers (any one halts the current step)

- Any real `FAILED` in a migration entity batch (not `SKIPPED`).
- Any bounce, wrong recipient, broken link, or token leakage in the
  activation canary.
- More than one unexplained delivery error in a batch beyond the canary.
- Reconciliation audit mismatch.
- Critical 5xx, auth failure, data corruption, wrong canonical origin,
  redirect loop, broken media at scale, or an ownership/access breach —
  see `dns-cutover-plan-2026-07-29.md`'s rollback-trigger table for what
  rolls back in each case.

## Explicit non-goals for this checklist

- Does not replace founder judgment on any of the "before the window
  opens" decisions — those must be made, not defaulted.
- Does not include DNS-provider-specific steps — unknown in this
  environment, must come from whoever holds registrar access.
