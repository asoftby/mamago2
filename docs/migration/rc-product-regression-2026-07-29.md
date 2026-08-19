# Product Regression / RC Readiness — 2026-07-29

## Decision

```text
RC branch:                 codex/product-regression-rc-20260729
Exact tested source SHA:   17c9dd29787bbab0462ca581c546ca83a5dc2e73
Base:                      release/integrated-rc@5edeaaac
Confirmed product P0:      0
Technical RC result:       PASS
Launch authorization:      NO — final Go/No-Go gates remain
Readiness estimate:        90%
Next phase:                FINAL GO/NO-GO PREPARATION
```

The exact source SHA above passed a production-configured build and a smoke of
that built artifact. No product code change was required. The only commit
created by this pass records evidence; no push, PR, merge, production write,
email delivery, DNS change, Search Console submission or indexing change was
performed.

## Scope and evidence

| Track | Result | Evidence / remaining gap |
| --- | --- | --- |
| Public discovery | **PASS** | `/`, `/minsk`, Events, representative Event, Offer, Article and Route rendered at 200 on desktop with working primary content and no stable console error or horizontal overflow. |
| Auth and activation | **PASS (automated)** | Eligibility, password policy, session eligibility, generic login failure, pending activation, activation request/delivery rehearsal, token service, activation page and endpoint security cases passed. |
| Business ownership/access | **PASS (automated)** | Golden/batch ownership, role elevation, cross-owner denial, wizard permission/action, draft state, Offer moderation, linked-business access and published-edit guards passed. |
| Business owner UI | **NOT TESTED** | Existing browser identity was ADMIN/non-owner. A separate authenticated BUSINESS_OWNER session is still required for create/edit/archive/restore/media and submission UI acceptance. No test data was left behind. |
| Admin | **PASS (desktop)** | Dashboard and Places (83), Offers (63), Events (10), Publications (26), Routes (14), Users and Redirect Center loaded. Redirect Center was read-only and its search/filter/pagination were verified. |
| Media | **PASS WITH P1 ENVIRONMENT NOTE** | 482 ignored per-file local upload mounts restored representative local media. Restricted access to an external Unsplash fallback remained an environment/P1 finding, not a local-media failure. |
| SEO / redirects | **PASS** | Indexing-enabled verifier: sitemap 200 with 199 unique URLs; 199 pages crawled, 0 issues; 20 redirect samples, 0 broken; 2 city-duplicate probes, 0 failing; no P0 codes. Manifest: 893 rows, 0 loops/chains/collisions. |
| Production artifact | **PASS** | Node 22 production build generated 382 static pages and loaded all 893 redirect rows. Built server returned 200 for representative city/Event/Offer/Article/Route, sitemap and robots; canonical used `https://mamago.by`, not localhost. |
| Responsive desktop | **PASS** | Representative public and admin surfaces had no desktop document overflow except the Admin Routes table finding below. |
| Responsive mobile | **NOT TESTED** | In-app viewport override did not change the actual viewport; the subsequent browser operation was refused by the browser security boundary. No alternate browser workaround was attempted. |
| Database / fixtures | **PASS** | 221 migrations, schema up to date. Post-test audit: 0 invalid example users, 0 test Places, 0 test Offers. |

## Automated gates

Passed on the RC worktree:

- production-configured `pnpm build` on Node `22.23.1`;
- `tsc --noEmit`;
- redirect manifest tests;
- WordPress legacy catch-all tests;
- 18 SEO verifier parser/rule tests;
- full warmed production-artifact SEO verifier;
- auth/activation suites and negative-path invariants;
- business ownership, elevation, access and lifecycle suites;
- Offer/Place edit and moderation guards;
- `git diff --check`.

Expected negative-path Prisma logs (deadlock retry, serialization and invalid IP
input) appeared during tests whose assertions passed. Rapid development HMR
navigation also produced transient chunk/fetch warnings; stable page checks and
the production artifact did not reproduce them.

## P0 accounting

### Confirmed open product P0 defects

None.

### Mandatory evidence gaps before launch

These are not reproduced product defects, but the checklist forbids launch
while their critical outcomes are unknown:

1. Mobile visual acceptance for public, auth, Business and Admin P0 journeys.
2. Authenticated BUSINESS_OWNER UI end to end: Business → Place → Offer →
   moderation submission, edit/archive/restore and media behavior.
3. Founder UAT acceptance plus the already documented production-only
   backup/restore, activation delivery, external SEO baseline and cutover gates.

## P1 / explicitly deferred findings

- Admin Routes table has desktop document-level horizontal overflow.
- External Unsplash fallback was unavailable in the restricted local network.
- Dedicated `/minsk/places`, `/minsk/offers` and `/minsk/blog` listing paths are
  absent; current navigation uses the city hub, typed Offer paths and
  `/blog?city=minsk`. Treat as route-policy/product backlog unless those URLs are
  declared contractual.
- Route map correctly shows an unavailable/empty state for insufficient geo
  data; RouteStop coordinate backfill remains deferred.
- Manual redirect persistence and the 836 invalid-target traffic review remain
  deferred as recorded by SEO closure.

## User and privilege invariant

The production migration manifest contains 578 eligible migrated users:
539 `USER`, 39 `BUSINESS_OWNER`, 0 `ADMIN`. The founder legacy `user:1` is an
existing ADMIN intentionally unchanged and excluded from migration lineage.
Additional ADMIN fixtures in the local development database are not members of
the production activation manifest and do not alter that production-scope
invariant.

## Final Go/No-Go preparation

Use the exact RC lineage above. First record mobile and BUSINESS_OWNER manual
evidence, then assemble founder acceptance and production-only gate owners,
timestamps, rollback/restore proof and external SEO baseline. Do not reopen
closed migration or SEO slices without new regression evidence.
