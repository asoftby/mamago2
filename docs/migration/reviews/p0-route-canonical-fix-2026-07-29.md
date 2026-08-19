# P0 Route canonical fix — 2026-07-29

Status: `RESOLVED LOCAL`; integrated RC revalidation required.

- Branch/worktree: `fix/prelaunch-p0-route-search`,
  `/Users/shapovalovalexey/dev/mamago2-prelaunch-p0-route-search`
- Base and HEAD before commits: `edf8af6b`.
- Root cause: Route metadata omitted `alternates.canonical`.
- Contract: only `PUBLISHED + PUBLIC` emits a canonical. A syntactically valid
  HTTP(S) stored URL on the configured public origin, with the exact current
  `/routes/{slug}` path and no query/hash, wins; otherwise the absolute
  `/routes/{slug}` fallback wins. A present slug is never replaced by an
  internal ID. Actual Route routing is non-city-scoped; city-prefixed stored
  paths are stale and rejected.
- Changed files: `src/app/(public)/routes/[slug]/page.tsx`,
  `src/lib/seo/resolveRouteCanonicalUrl.ts` and its test.
- Tests: `resolveRouteCanonicalUrl.test.ts` passes, including stored,
  missing, invalid/relative/unsafe/stale-origin/stale-path, slug-first and
  DRAFT/non-public cases. Runtime DOM inspection proves one canonical, so no
  metadata/layout/page duplicate is present.
- Runtime: exact worktree server command
  `NEXT_PUBLIC_APP_URL=http://localhost:3061 pnpm dev --port 3061`;
  representative URL
  `/routes/5-mini-puteshestvij-na-1-den-nedaleko-ot-minska` returned 200 and
  rendered exactly one canonical pointing to the same real slug URL.

Writes: DB lifecycle 0; content 0; search 0; canonical DB 0; media/storage 0.

Unrelated runtime findings: `ROUTE_RATINGS_PARAMS_NOT_AWAITED — OPEN P1` and
`MISSING_FAVICON_ASSET — OPEN P2`; neither changes canonical/indexability and
neither is fixed in this commit.

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC`
