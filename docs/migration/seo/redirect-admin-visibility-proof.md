# Redirect Center visibility and runtime proof

Date: 2026-07-29

Branch: `fix/seo-migration-closure`

Local origin: `http://localhost:3075` (no production endpoints)

## Architecture and admin contract

The empty Redirect Center was caused by a complete data-layer stub:
`getRedirectCenterData()` returned hardcoded empty arrays. The page now reads
`scripts/data/wp-redirect-map.json`, classifies it through
`src/lib/seo/redirectManifestClassifier.ts`, and sends only the filtered
25-row page to the client.

The same classifier is used by `scripts/validate-redirect-map.ts`; the CLI
contains no second classification implementation. System/migration rows have
no edit/delete controls. Manual count is separate and remains 0 because there
is no persisted admin create/update flow. The former React-state-only create
form was removed and the UI states that persistence is P1.

Observed summary:

```text
total migration redirects: 893
manual redirects: 0
EXACT_REDIRECT: 12
VALID_HUB_REMAP: 21
P1_START_OR_CONTAINS: 24
INVALID_TARGET: 836
COLLISION: 0
CHAIN: 0
LOOP: 0
```

Server-side contracts cover source/destination search, disposition filter,
unknown-filter fallback, page 2/last/out-of-range normalization, and 25 rows
per full page. The server-render contract contains summary and migration rows;
the inactive Radix Manual tab is ordinary framework behavior and is not forced
open by a heavy browser test.

## Runtime HTTP samples

Every checked manifest source returned one 308 hop to the exact manifest
destination. Every final destination returned 200. Locations were relative;
no `localhost` appeared in a public destination.

| Class | Source | Manifest/final destination | Result |
|---|---|---|---|
| EXACT | `/vesennie-kanikuly-2025-chem-zanyatsya-i-kuda-otpravit-detej` | `/minsk/blog/vesennie-kanikuly-2025-chem-zanyatsya-i-kuda-otpravit-detej` | 308, 1 hop, final 200 |
| EXACT | `/zimnie-kanikuly-kuda-pristroit-detey` | `/minsk/blog/zimnie-kanikuly-kuda-pristroit-detey` | 308, 1 hop, final 200 |
| EXACT | `/detskiy-sad-kubiki-v-stile-lego-v-minske-skoro` | `/minsk/blog/detskiy-sad-kubiki-v-stile-lego-v-minske-skoro` | 308, 1 hop, final 200 |
| HUB | `/master-klassy-dlya-detej` | `/minsk/events` | 308, 1 hop, final 200 |
| HUB | `/detskie-spektakli` | `/minsk/events` | 308, 1 hop, final 200 |
| HUB | `/detskie-mesta/detskij-den-rozhdenija` | `/minsk/birthday` | 308, 1 hop, final 200 |
| INVALID_TARGET | `/ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske` | `/minsk/blog/ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske` | 308, 1 hop, final 200 |
| INVALID_TARGET | `/events/festival-lidbeer-2025-lidbir` | `/minsk/events/festival-lidbeer-2025-lidbir` | 308, 1 hop, final 200 |

`INVALID_TARGET` means no migrated entity resolved in the classifier. The
runtime result above is safe under the current public route fallback policy,
but it is not proof of an exact SEO/content migration. Traffic-based remapping
of these 836 rows is P1 deferred.

Unknown WordPress samples:

- `/events/ne-sushhestvuet-legacy-2026` → 301 `/minsk` → 200, one hop.
- `/wordpress-neizvestnyj-put-codex-probe` → 301 `/minsk` → 200, one hop.

No chain, loop, 404/500, or localhost leakage was observed.

## Verification

Passed:

- shared classifier synthetic tests (exact/hub/P1/invalid, duplicate,
  self-redirect, chain, loop, deterministic summary);
- redirect admin data tests (count, pagination, last/out-of-range page,
  source/destination search, disposition filter, migration/read-only shape,
  manual count);
- server-render Redirect Center contract;
- existing redirect-manifest tests;
- existing WordPress catch-all tests;
- `tsc --noEmit`;
- targeted ESLint;
- `git diff --check`.

The shared CLI reproduced 893 and the exact disposition counts above. Its
non-zero exit remains the pre-existing result of 15 known source-format
warnings; classification output is deterministic and unchanged.
