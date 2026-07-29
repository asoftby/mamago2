# Launch monitoring plan — 2026-07-29

Status: **new document.** No monitoring platform is introduced here — this
uses signals and tooling that already exist in the codebase (Sentry, the
redirect/SEO verifier scripts, `ActivationDeliveryAudit`, `AdminAuditLog`,
admin dashboard stat cards observed during this session's mobile UAT).

## First 15 minutes

| Check | Source | Threshold | Owner | Action if exceeded |
|---|---|---|---|---|
| Homepage loads | Manual + uptime check | Non-200 or >5s TTFB | Founder/on-call | Roll back application release |
| Critical entity URLs (a sample event/place/offer/article/route) | Manual smoke, same list as this session's UAT | Any 404/500 on a known-good URL | Founder/on-call | Investigate before declaring launch complete |
| Login | Manual smoke | Login fails for a known-good account | Founder/on-call | Halt further rollout steps (e.g. don't flip indexing) |
| Business cabinet loads for a real owner | Manual smoke | 404/500/blank | Founder/on-call | Investigate — this session found ownership-scoping bugs are high-severity by nature |
| Admin dashboard loads | Manual smoke | 404/500/blank | Founder/on-call | Investigate |
| Redirects (spot-check the 20 samples from `redirect-admin-visibility-proof.md`) | Manual | Any sample now loops/chains/404s | Founder/on-call | Redeploy previous build (cheapest rollback path) |
| 5xx rate | Sentry / hosting provider dashboard | Any sustained spike vs. pre-launch baseline | On-call | Roll back application release |
| Database connection health | App logs / hosting provider | Connection errors, pool exhaustion | On-call | Check DB target config, connection limits |
| Media loads | Manual spot-check | Broken images beyond the known external-Unsplash-fallback P1 | On-call | Distinguish code regression (roll back) vs. storage issue (check storage restore) |

## First hour

| Check | Source | Threshold | Owner | Action if exceeded |
|---|---|---|---|---|
| Error rate | Sentry | Above pre-launch baseline for >10 min | On-call | Investigate top errors; roll back if migration/release-caused |
| Failed API calls | Sentry / hosting provider access logs | Sustained >baseline | On-call | Same as above |
| Auth failures | App logs (`[auth] validateSession` style logging observed in dev) | Spike in failed logins/sessions | On-call | Check session/cookie config for the new deploy |
| Activation delivery (if canary running) | `ActivationDeliveryAudit` query | Any `FAILED` beyond expected `SKIPPED` | Founder (canary owner) | Stop canary per `activation-canary-plan-2026-07-29.md` STOP conditions |
| Redirect/canonical correctness | `scripts/validate-redirect-map.ts` re-run against production manifest | Any collision/chain/loop reported | On-call | Redeploy previous manifest/build |
| Sitemap/robots | Manual fetch of `/sitemap.xml` and `/robots.txt` on the production origin | Wrong origin, missing entries, or still noindex when it shouldn't be | On-call | Do not proceed to indexing switch until fixed |
| Server resource health | Hosting provider dashboard (CPU/memory/disk) | Sustained saturation | On-call | Scale or roll back |

## First 24 hours

| Check | Source | Threshold | Owner | Action if exceeded |
|---|---|---|---|---|
| Crawl/indexing signals | Search Console (external — not verified in this session per `seo-migration-closure.md`'s explicitly-deferred item) | Unexpected crawl errors | Founder | Investigate canonical/robots config |
| 404 reports | Hosting provider access logs | Spike beyond the known 836 INVALID_TARGET legacy rows already accounted for | On-call | Distinguish new regression from known legacy long-tail |
| Redirect misses | Same validator re-run | New misses not present in the 893-row manifest | On-call | Add to redirect backlog, not urgent unless volume is high |
| Email bounce/failure (if batches are running) | Resend dashboard (no webhook yet — manual check required, per `activation-canary-plan-2026-07-29.md`) | Any bounce | Founder | Stop batch per canary STOP conditions |
| User activation success rate | Reconciliation query: manifest-eligible vs. `SENT` vs. `usedAt IS NOT NULL` | Meaningfully below expected | Founder | Investigate delivery vs. click-through gap |
| Ownership/support incidents | Manual — support inbox / founder's direct channel | Any report of seeing another business's data | On-call | Treat as security incident — see DNS/cutover plan rollback triggers |
| Performance regressions | Sentry performance monitoring / hosting provider | Sustained latency increase vs. pre-launch baseline | On-call | Investigate before declaring launch stable |

## Notes

- This plan does not stand up new monitoring infrastructure — it is a
  checklist of what to look at, using tools already present (Sentry is
  already configured per the dev server's Sentry warnings observed in
  this session's mobile-UAT dev log; the redirect validator script exists;
  admin dashboard stat cards exist).
- The "abnormal failure rate" thresholds above are intentionally
  qualitative ("sustained", "spike beyond baseline") because no
  quantitative SLO was found documented anywhere in the checklist — if the
  founder wants numeric SLOs (e.g. "5xx rate > 1% for 5 minutes"), that is
  a new decision, not something this session found already agreed.
