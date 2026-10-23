# Exact-13 editorial Route HTTP gate — PR #695

This gate verifies the code for Issue #253. It does not authorize deployment,
close the production SEO incident, or demonstrate Google-selected canonicals.

## Runtime and safety

Next.js is lock-pinned to 16.3.8. `src/proxy.ts` uses its Node.js runtime
(no explicit `runtime` config is supported for Proxy). The Prisma import is
static: an incompatible import cannot silently disable the redirects inside a
catch around a lazy module import. The existing shared readiness resolver is
used before streaming; query failures skip the redirect and emit a redacted
`[editorial-route-redirect]` error message.

The frozen 13-slug list remains the only allowlist. Archived editorial source,
published CITY Article in Minsk, indexable target with renderable Article content, active real city in the public
country scope and active,
unarchived ARTICLE category «Маршруты» are required. No static DB-bypassing
redirects or migration of live content were introduced. The candidate target
must equal the deterministic canonical path for that exact approved slug.

The 308 response passes through the existing robots-header policy. Runtime
APP_ENV=dev/staging/test remains `noindex, nofollow`, even when the release flag
is enabled. Production follows the existing release switch.

## Reproduce

Use a clean isolated checkout with Node 22 and its own dependencies. No `.env`,
`.env.local`, `.env.production` or `.env.production.local` files are allowed.
Provision a **new disposable** PostgreSQL 16 database using only these synthetic
credentials; never point this gate at an existing application database:

```sh
export DATABASE_URL=postgresql://seo_redirect_test:synthetic_only@127.0.0.1:5432/seo_redirect_test
pnpm install --frozen-lockfile
APP_ENV=test pnpm build:ci
pnpm test:seo-http
```

A different loopback PostgreSQL port is supported. The test validates database
and user identity and an empty public schema before applying repository
migrations. It inserts synthetic Country/City/Category/Route/Article/User rows,
starts the built app on temporary loopback ports, checks actual HTTP responses,
stops its child app and drops only the schema it verified empty and migrated.
The caller must dispose of the temporary PostgreSQL instance/database afterward.
Never reuse the database concurrently with another job.

The mandatory `CI / typecheck` job provisions a PostgreSQL service with a health
check, builds the app, runs the complete SEO recovery gate and this HTTP gate.
No DEV/PROD connections or production secrets are used. GitHub removes the
service container when the job ends. Assertions are printed in the job log;
local evidence is also written to `/tmp/mamago-editorial-http-evidence.json`.

## Coverage

- All 13 slugs × GET/HEAD × slash/no-slash, preserving repeated and encoded query
  parameters, return a single 308 with exact Article Location and no HTML refresh.
- Each Article target is 200 with content and one correct self-canonical.
- The same immutable build runs with production, dev, staging and test settings;
  headers, meta robots and robots.txt enforce their respective indexing policy.
- Excluded Mogilev, unapproved/unknown slugs, missing/draft/noindex/wrong-city/
  wrong-scope Article, missing/inactive/archived/wrong-type category, inactive
  city, unarchived source and user-authored source cannot trigger a redirect.
- A public UGC route still renders. Anonymous me/admin/business requests still
  require login. API health, manifest redirect and normal slash redirect retain
  their behavior. Proxy unit tests also verify matcher and subdomain rewrites.
- Unreachable PostgreSQL cannot create a false redirect and produces the
  observable redacted error marker.

## Verification

Results are recorded after the local built-HTTP gate and final GitHub CI run.
