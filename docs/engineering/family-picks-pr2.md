# Family picks PR 2 — confirmed-age server policy

Requirement: https://github.com/asoftby/mamago2/issues/1059#issuecomment-6582043310.
Base: dev after #1063, 8604f777f8d1c615652b24b3d33d36d3e5097dc1.

## Runtime checklist

- [x] Internal `loadPersonalFamilyPicks` reuses the existing profile ACL and shared ranker. Selection is ALL_FAMILY or an authorized CHILD; inaccessible IDs fail with `selection_unavailable` before ranking.
- [x] DAY/MONTH conservative completed-month interval at the session's Minsk date. Unknown legacy precision is treated conservatively as MONTH. Unknown DOB/event age never earns MATCH. All children stay in the snapshot.
- [x] AND first, OR only when AND <4, at most seven unique events. Shared score/date/ID ordering; no hard category/business or novelty eviction. A single occurrence determines both the date and matching children.
- [x] Seven calendar days, then thirty only when zero proven age matches remain. Short results remain visible to the future renderer. Final response reports the actual period and explicit READY/EMPTY/UNAVAILABLE status.
- [x] Hydration rechecks canonical visibility plus published/live status; requires future non-withdrawn occurrences. No denormalized fallback when any materialized sessions exist. Undated recurring/always/on-demand do not qualify.
- [x] `isSaleOpen=false` and missing buyUrl are not sold out. No reliable sold-out column exists today; pure occurrence tests cover an explicitly trusted soldOut signal without deriving one from sale status.
- [x] Distinct surface policy version `family-picks-confirmed-v2` plus shared algorithm version. No trace writes in this internal path, even for non-empty previews or 7→30 fallback.
- [x] Legacy endpoint, Home, header selection, catalog URLs/filters/membership, PLAN_ADD and Feedback remain unchanged. Public selected-child ranking stays 409 until explicit delivery integration.
- [ ] PR 3: wire one Home branch, chips, cache/account persistence, UI states and final delivery tracing. This PR provides no runtime switch.
- [ ] PR 4: complete HOME action attribution, especially successful PLAN_ADD. No Feedback 5★ activation.

## Tests and review

- `pnpm test:family-picks`: legacy/profile baseline plus new policy unit tests.
- `pnpm test:family-picks-policy-integration`: real shared ranker, published/session hydration, birthday/card-date correctness, 7/30/empty results, FAMILY_CORE_READS off/on, changed membership/deleted/foreign child and no Run/Exposure writes.
- Integration refuses non-local hosts and databases whose name does not end in `_test`; it requires explicit FAMILY_PICKS_TEST_DB=1. Only synthetic fixtures are created; DEV/PROD are forbidden.
- Integration is wired into GitHub CI against the existing disposable PostgreSQL service. Production build remains a mandatory GitHub CI step.
- Review age interval boundaries, per-occurrence proof, group/fallback ordering, ACL and zero-trace behavior. Test success does not activate v2 or establish production configuration.

No Prisma schema or migration files are changed. Existing migrations may be applied only to disposable test databases. No merge/deployment is part of this task.
