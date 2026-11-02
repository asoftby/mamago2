# Family picks PR 1 — audience and selection contract

Issue #1059; mandatory review: https://github.com/asoftby/mamago2/issues/1059#issuecomment-6579745865.

## Runtime checklist

- [x] `loadFamilyPicksProfile(userId)` is server-only. Call it after `getCurrentUser`; userId must never come from request parameters. It reads through the existing `childScopeFor` (FAMILY_CORE_READS on/off, active membership); no separate ACL, profile cookie, cross-request cache, recommendation run or exposure.
- [x] Server snapshot retains all scoped children, raw DOB, birthPrecision and canonical interests for the existing loader. Errors propagate instead of producing a no-children audience.
- [x] Audience is `guest / no_child_with_DOB / personalized` based only on scoped DOB presence. This says nothing about exact age fit or ranking level. Incomplete children remain in context.
- [x] Legacy GET calls retain existing `audience: guest | user`, ranking, limits, windows, exclusions and cards. Additive `profileContext` contains audience, authenticated accountId, children `{id,name,hasBirthDate,birthPrecision}`, selectedChildId=null and selectionApplied=false. Raw DOB/interests are not serialized.
- [x] `GET /api/recommendations/family-picks?contextOnly=1[&selectedChildId=...]` returns only `{profileContext}`. It does not rank, access analytics sessions or record traces. Omit selectedChildId for the whole family.
- [x] Malformed/empty/duplicate selectedChildId → 400. Well-formed unavailable IDs (including guest, foreign, deleted, former family) → the same 404 `selection_unavailable`, with no echoed ID or profile data. All HTTP results, including 500s, are private/no-store.
- [x] A currently authorized child selection without contextOnly=1 → 409 `selection_not_enabled`. The API never acknowledges per-child ranking while returning old whole-family results. IDs stay on the private API, never public catalog URLs.
- [ ] Single Home branch, chip UI, switching cache and selection persistence: not enabled. CityHomePage and client components are unchanged.
- [ ] Conservative age proof over uncertain birth dates at session time, AND/OR policy, confirmed dates and 7→30 window: PR 2. MONTH is not an exact birthday; DOB presence is not MATCH.
- [ ] Account-scoped dismissals, cross-device persistence decision, UI states and catalogue CTA: later PRs; no claim that localStorage is account-wide persistence.
- [ ] HOME PLAN_ADD attribution and Feedback 5★: no changes in PR 1. Feedback remains outside this release.

## Verification

`pnpm test:family-picks` runs new dependency-injected profile/request behavior tests and existing window/config/select/view tests. Family ACL fragments are reused from `familyScope`; production profile queries use `childScopeFor` verbatim. Tests use no database and include account/family changes, missing DOB, MONTH precision, denied selection, malformed requests and propagated errors. They do not establish live DB configuration or replace future PostgreSQL ACL integration acceptance.

CI runs this suite explicitly; check:push includes it. Required additional checks: targeted ESLint, tsc, repository push gate and CI. No schema/migration or deployment changes belong to this PR.
