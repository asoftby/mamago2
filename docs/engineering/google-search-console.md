# Direct Google Search Console ingestion (#705, #702)

## Audit and architecture

The repository already had a direct RS256 service-account JWT exchange and
Search Analytics client in `googleSearchConsole.ts`, registered in the existing
worker metric collector registry. It produced two seven-day KPI windows,
top-50 page/query responses (20 dimension samples), and three rising/falling
pages. `seoEvergreenWeekly.ts` separately used the same client for completed
ISO weeks and paginated pages. `MetricSample` is append-only; the runner locks
each collector and inserts its complete output atomically. Failed cycles write
no samples. The operations snapshot already projects GSC KPIs and evergreen
history; `gscSeoViewModel.ts` already calculates comparisons. The SEO overview,
however, still said Search Console was not connected. No Windsor dependency or
Windsor ingestion path was found in the application, schema or scripts.

This change extends those collectors, reuses their metric names and view model,
and replaces the SEO overview placeholder. No new scheduler, cron, external
connector, public API or browser-side Google access is introduced. Existing
admin route authorization remains in force. Market filters do **not** filter
GSC: the block explicitly identifies its whole-property scope.

## Authorization and owner setup for DEV

These are owner actions after code review; this task does not execute them.

1. Enable the Google Search Console API in a dedicated Google Cloud project.
2. Create a dedicated service account. It needs no Google Cloud project
   Owner/Editor role, domain-wide delegation, impersonation or OAuth consent
   callback. In Search Console, the property owner adds its email as a
   **Restricted** user on only the required property (Performance is readable).
3. Provision a PKCS#8 RSA private key through the deployment secret manager.
   Keep separate DEV and PROD identities. Never put keys, tokens, downloaded
   service-account JSON or screenshots of credentials in Git, logs or admin UI.
   Rotate/revoke keys and remove property access when retiring the integration.
4. Configure the worker's server-only values through the approved deployment
   configuration mechanism. Configure enabled/property on the web app too so
   the admin read path can identify the same property. No `NEXT_PUBLIC_` values.

| Variable | Meaning |
| --- | --- |
| `GOOGLE_SEARCH_CONSOLE_ENABLED` | `true` enables collectors; absent/false disables all Google calls |
| `GOOGLE_SEARCH_CONSOLE_SITE_URL` | Exact property identifier, e.g. `sc-domain:mamago.by` or `https://mamago.by/` (URL-prefix paths and trailing slash matter) |
| `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL` | Dedicated service account email, worker only |
| `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY` | PKCS#8 PEM private key, worker only; literal `\n` is accepted |

The only scope requested is
`https://www.googleapis.com/auth/webmasters.readonly`. The JWT lifetime is one
hour; access tokens live only in the current collection's memory. An enabled
but invalid configuration fails visibly with a sanitized error instead of
silently reporting successful collection. No Google credentials are returned
to the client. One deployment maps to **one explicitly configured property**;
we do not sum overlapping domain and URL-prefix properties. Changing property
starts a distinct query cache namespace and the admin waits for a matching
property marker before showing metrics. No guessed domain from a city filter.

## Synchronization, cache, correctness

- GSC dates are Pacific Time. The latest available day is conservatively
  today minus three days; only `dataState: final`, search type `web` is queried.
- Daily property aggregates cover the current and previous complete seven-day
  windows. Clicks/impressions are summed, CTR is recomputed from sums, and
  position is impression-weighted. No-dimension totals are independent of
  page/query sampling. An omitted daily aggregate falls back to Google's whole
  window aggregate. An empty whole window remains unknown and fails the cycle
  instead of inventing zero traffic.
- Successful responses use `GscQueryCache`, keyed by a SHA-256 hash of property,
  exact dates, dimensions, search type, data state, row limit and offset.
  Upsert replaces the same request, so retry/restart does not duplicate cache
  rows. Empty dimension responses are valid; empty aggregate responses and
  failed/malformed responses are not cached. Cache hits survive worker restart.
- Recent windows refresh after six hours. Windows ending more than ten days
  ago refresh after seven days. Moving daily windows reuse older cached days
  and fetch missing/new/expired days, while recent days can be corrected.
  Weekly backfill remains bounded to the most recent twelve completed weeks
  since the configured recovery baseline. Pagination is 25,000 rows per call,
  with the existing eight-request safety bound per week; hitting the bound
  fails the collection rather than storing a truncated weekly total.
- Page movers use only pages present in both top-50 windows. Neither top page
  nor query rows are a full export. Google itself limits results and omits some
  query data; do not infer a missing page/query is zero or sum query rows into
  property KPIs. Weekly page totals keep the existing page-group semantics.
- Requests are sequential within a collector. Each request has an eight-second
  timeout, at most three attempts, exponential jitter/backoff, and Retry-After
  handling. Retryable: network errors, 429, 5xx and known 403 quota reasons.
  Permanent 400/401/permission 403 fail immediately. A backoff longer than ten
  seconds is deferred to the next existing worker cycle, without a retry storm.
  A shared 110-second deadline bounds requests before the 120-second collector
  timeout. Google response bodies and credentials are never included in errors.
- Existing worker locks serialize each collector across workers. Successful
  cache writes can be reused after a later request fails. Metric publication
  still happens only after all required requests succeed, through the existing
  atomic `MetricSample.createMany`. Metric samples intentionally record each
  successful collection instant; they are **not** additive ingestion events.
- Admin reads one exact complete collection batch for the configured property,
  shows the date-through and update time, and flags data older than twelve
  hours. Failures retain the last good batch. Worker logs expose sanitized
  collector failures and `succeeded=false`; check them for quota/auth issues.
- The main collector deletes cache entries expired more than thirty days ago.
  No new cron or retention job. Existing MetricSample retention is unchanged.

## Migration and verification

Migration `20261022120000_gsc_query_cache` creates only `GscQueryCache` and its
expiry index. It does not alter/backfill existing metric data. Apply through
the normal reviewed migration/deployment process **before** enabling the
worker. It has not been applied to any real database by this task. To disable,
set enabled false via the approved process; leave cached/metric data intact.
Prisma Client generation needs no database connection.

Local credential-free checks (Node 22, independent worktree dependencies):

```sh
pnpm test:gsc
NODE_OPTIONS=--max-old-space-size=12288 pnpm exec tsc --noEmit
pnpm exec eslint src --quiet
pnpm build
```

Tests mock Google and Prisma: JWT signature/scope, property isolation,
request identity/upsert, cache expiry, malformed rows, date validation,
weighted metrics, bounded network/quota retries, Retry-After, error redaction,
and admin batch freshness. Existing weekly/mover tests also run. `test:gsc`
is included in the existing push gate. The optional `pnpm test:gsc:integration`
requires `GSC_TEST_DATABASE_URL` (not `DATABASE_URL`) pointing to a disposable
loopback database named `gsc_migration_test` containing only the new migration.
It checks actual Prisma upsert/restart/property isolation and failed refresh.
The migration SQL was applied and this test passed in a new `/tmp` PostgreSQL
cluster; the existing collector runner's DB tests passed in a separate empty
test DB. Google smoke is an owner follow-up requiring DEV access. Checks use
only a disposable local PostgreSQL cluster, never an environment database.

Owner DEV smoke after approved deployment/configuration:

1. Verify the expected Git/build SHA; confirm migration is present.
2. Let the existing worker run both collectors; no cron changes needed.
3. Confirm a successful cycle, then check admin SEO for the exact property,
   date-through, KPIs, comparisons and update time. Compare in Search Console
   with matching PT dates/type and aggregation; allow documented API omissions.
4. Rerun/restart: confirm cache reuse (stable request IDs) and complete metric
   batches; verify cache keys differ for another property in an isolated test.
5. In a sandbox, simulate denied access/quota: no new partial metric batch,
   last good batch retained, stale warning after twelve hours, no secret logs.

Until then, live Google authorization, DB migration execution and DEV smoke
remain unverified; code/mock checks do not claim an operational connection.

Official references:
- [Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Performance data and limits](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- [Usage quotas](https://developers.google.com/webmaster-tools/limits)
- [OAuth scopes](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing)
- [Search Console roles](https://support.google.com/webmasters/answer/7687615?hl=en)
