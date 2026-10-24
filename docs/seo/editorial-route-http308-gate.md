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

Local verification on 2026-10-23 used a dedicated PostgreSQL 16 cluster on
127.0.0.1:55495, a non-superuser database owner and synthetic records only.
Fresh dev base: `1f3ff2b1b53e1cccfbf50003cff10a430259d467`.

- `sh scripts/git/task-check.sh`: PASS, including TypeScript, full `pnpm check:push`,
  SEO regression tests and production build (app + worker).
- ESLint of changed TypeScript files: PASS. Separate TypeScript check of the HTTP
  runner (scripts are excluded from the app tsconfig): PASS.
- `pnpm test:seo-http`: PASS, **312 actual HTTP requests**. There were **208 exact
  cutover 308 responses**, **52 Article target 200 responses**, **42 negative
  readiness/exclusion/outage responses**, and 10 remaining policy/auth/UGC probes.
- DEV/staging/test: each of the 52 cutover responses per environment has
  `X-Robots-Tag: noindex, nofollow`; all 13 Article targets per environment have
  the same header, meta noindex and one correct environment canonical.
  `robots.txt` disallows all. Production targets remain indexable with no global
  X-Robots noindex override.
- PostgreSQL outage: GET and HEAD both returned 500 with no Location and an
  observable readiness error marker, never 308.
- `/me` keeps its existing streamed login redirect; `/admin` and `/business`
  return 307 to login. All preserve exact `redirectTo` and private noindex.
- Same-origin redirects are serialized by Next as relative Location references.
  The gate resolves each against the request origin and compares the complete
  URL, including repeated and encoded query parameters. GET contains only Next's
  plain redirect path text; HEAD has no body. Neither renders HTML/meta refresh.

All rows below passed GET and HEAD, with and without trailing slash and with
query preservation, in production, dev, staging and test runtime modes. Target
prefix is `/minsk/blog/`; every target returned 200/content/self-canonical.

| Approved slug | HTTP | Article target |
| --- | --- | --- |

| `marshrut-po-drozdam-zhivopisno-i-razvlekatelno` | 308 | 200 |
| `marshrut-kurosovshchina-zoologicheski-ekstremalnaya` | 308 | 200 |
| `marshrut-majak-minska-krasivo-i-aktivno` | 308 | 200 |
| `marshrut-narochanskij-zhivopisno-i-peshehodno` | 308 | 200 |
| `chto-posmotret-turistu-za-2-dnya-v-kobrine-i-breste` | 308 | 200 |
| `marshrut-malinovka` | 308 | 200 |
| `marshrut-traktornyj-zavod` | 308 | 200 |
| `marshrut-braslav-nomad-houses-chto-posmotret-v-braslave` | 308 | 200 |
| `marshrut-shchorsy` | 308 | 200 |
| `novogodniy-marshrut` | 308 | 200 |
| `5-mini-puteshestvij-na-1-den-nedaleko-ot-minska` | 308 | 200 |
| `marshrut-na-avtodome-zoopark-vodopady-safari-gomel` | 308 | 200 |
| `marshrut-po-piteru-kulturnaya-programma-na-2-sutok-bez-detej` | 308 | 200 |

Final GitHub CI is linked in PR #695 on its final HEAD. No merge or deployment
was performed. Issue #253 must remain open for separately authorized deployment,
runtime identity/real-environment HTTP verification, Google canonical checks and
GSC recovery monitoring.
