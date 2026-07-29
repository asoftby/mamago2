# DNS, deploy & noindex cutover plan — 2026-07-29

Status: **new document — no equivalent existed before this session.**
`prelaunch-checklist.md` §5.9 only lists "DNS cutover, noindex switch,
monitoring/rollback decision window" as a single unchecked bullet; no
DNS-provider-specific sequence existed. This plan is authored from that gap
plus the noindex mechanism that already exists in code
(`src/lib/seo/globalNoindex.ts`, `ProductionMigrationGuard`). **No DNS
records were read or changed to produce this document** — this environment
has no production DNS access; the current DNS configuration must be
reviewed read-only by whoever holds registrar/DNS-provider access before
execution.

## Noindex mechanism (already implemented, precedence as coded)

1. `SITE_NOINDEX_FORCE=true` → **always noindex**, overrides everything else.
2. Else `SITE_INDEXING_ENABLED=true` → **indexing allowed** (noindex off).
3. Else `SITE_NOINDEX_DEFAULT=true` → noindex.
4. Else (nothing set) → **noindex by default** — fail-safe, matches
   `isGlobalNoindexEnabled()`'s final `return true`.

`ProductionMigrationGuard` additionally refuses to run a
`PRODUCTION`-profile migration commit unless the site is not globally
noindexed at that moment — i.e., the guard enforces that noindex reflects
reality, not just intent.

## Cutover sequence

1. **Freeze** — declare a content/source freeze window; WordPress remains
   strictly read-only (checklist §1 rule 3) for the duration.
2. **Backup** — production DB backup + verified restore (see
   `production-migration-runbook-2026-07-29.md` §1); storage manifest
   snapshot taken.
3. **Approved RC deploy** — deploy the exact frozen RC SHA
   (`17c9dd29787bbab0462ca581c546ca83a5dc2e73`, or whatever later SHA
   supersedes it after a founder-approved P0 fix) to the production
   environment. `SITE_NOINDEX_FORCE` should default `true` (or
   `SITE_INDEXING_ENABLED` absent/false) at this point — the new deploy
   must **not** be indexable yet.
4. **Migrations** — run the entity migration sequence from
   `production-migration-runbook-2026-07-29.md` §2, sequential,
   stop-on-first-error.
5. **Content verification** — spot-check public URLs, canonical tags,
   media rendering per entity, per the runbook's final-verification list.
6. **Activation canary** — per `activation-canary-plan-2026-07-29.md`;
   still with indexing off (canary is about email delivery, not public
   visibility).
7. **Public smoke** — full public/auth/business/admin smoke on the new
   production deploy, still pre-DNS-switch if the deploy is reachable via
   a staging/preview URL; otherwise this step folds into step 9.
8. **Redirects/SEO smoke** — redirect manifest still validates (0
   collisions/chains/loops, 893 rows or the then-current count), sitemap
   generates, structured data renders. This must pass **before** step 9 —
   `ProductionMigrationGuard`-style discipline: don't switch DNS onto a
   deploy whose SEO surface hasn't been smoke-tested.
9. **DNS switch** (only if the production deploy target changes host/IP —
   skip if deploying in place to the existing production host):
   - Confirm current DNS records and TTL with whoever holds
     registrar/DNS-provider access (read-only check — not performed in
     this session, no access here).
   - Lower TTL in advance if a host change is planned, to bound rollback
     latency.
   - Point the record at the new target.
   - Do **not** flip indexing on yet — noindex stays on through
     propagation.
10. **Post-DNS verification** — confirm the production origin now serves
    the new deploy (correct host header handling, no mixed old/new
    responses during propagation), canonical URLs resolve to the
    intended production origin (not a staging/preview host), redirects
    behave identically to step 8's smoke.
11. **Indexing/noindex switch** — only after confirming: correct
    production origin, sitemap correct, robots.txt correct, canonical
    tags correct, redirect behavior correct, DNS propagation essentially
    complete, and **zero open P0**. Then set `SITE_INDEXING_ENABLED=true`
    (and confirm `SITE_NOINDEX_FORCE`/`SITE_NOINDEX_DEFAULT` are not still
    forcing noindex) — this is also the exact condition
    `ProductionMigrationGuard` checks.
12. **Monitoring window** — enter the launch monitoring plan (see
    `launch-monitoring-plan-2026-07-29.md`) immediately; do not consider
    the cutover complete until the first-hour and first-24h checks have
    run clean.

## Rollback triggers and what rolls back

| Trigger | What rolls back |
|---|---|
| Critical 5xx rate | Application release — redeploy the previous known-good build/SHA |
| Auth failure (login/activation broken at scale) | Application release; if migration-caused, see targeted re-run in the migration runbook |
| Data corruption (wrong counts, orphaned rows, broken lineage) | **No automatic DB rollback** — founder must explicitly authorize a full restore from the pre-cutover backup, understanding anything written after the backup is lost |
| Wrong canonical origin (indexing points at staging/preview) | Indexing flag (`SITE_INDEXING_ENABLED=false` / `SITE_NOINDEX_FORCE=true`) — immediate, no deploy needed |
| Redirect loop/chain discovered post-launch | Application release (redeploy previous manifest/build) — cheapest first per the existing runbook's rollback-path ordering |
| Broken media at scale | Depends on cause: application release if a code regression, storage restore from the pre-cutover manifest if a storage-layer problem |
| Ownership/access breach (cross-tenant data leak) | Application release immediately; treat as a security incident, not a routine rollback — do not wait for the monitoring window to escalate |
| Migration delta mismatch (counts don't match manifest) | Migration execution — do not proceed to the next entity phase; targeted re-run per the runbook's partial-failure policy |

Explicitly, per the existing runbook: there is **no automatic database
rollback**. A full restore is the last resort, requires a separate founder
decision, and loses all writes after the backup — migration-related or not.

## What this plan does not cover

- DNS registrar/provider specifics (TTL values, exact record types) —
  depends on the actual production DNS provider, unknown in this
  environment.
- Whether a host/IP change is even needed (i.e., whether production
  already points at the deploy target and this is an in-place release
  rather than a DNS cutover) — founder/ops must clarify before step 9.
