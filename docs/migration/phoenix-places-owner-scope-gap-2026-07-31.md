# Phoenix release bundle — Places owner-scope gap (2026-07-31)

## What happened

`scripts/phoenix-full-bundle-clean-run.ts` (new — runs all six executable
Phoenix phases together, through the real `buildPhoenixAdapterRegistry`,
against a disposable schema) is the first check to exercise cross-entity
dependency resolution end-to-end rather than one entity in isolation. It
found a real cross-entity bug (fixed, pushed: per-entity `MigrationSource`
rows meant Places couldn't find its own owner User's just-created lineage —
now one shared `MigrationSource` for the whole bundle) and, once that was
fixed, a second issue that is **not a bug** — a real scope gap:

**15 of the 78 approved Places (`phoenix-places-dev-release-scope-2026-07-31.json`)
are owned by a legacy WordPress user outside the frozen 559-user Phoenix
release scope**, so `createPlacesDependencyResolver` correctly fails closed
with `PLACE_OWNER_DEPENDENCY_NOT_FOUND` for each. This cascades to **20 of
the 63 approved Offers**, which resolve their dependency through those same
Places. 0 Routes/Events/Articles are affected.

## Root cause: three distinct, already-known owner identities — not one gap

| Owner (`post_author`) | Places affected | Offers affected | Status |
|---|---|---|---|
| `wordpress-db:user:1` | 5 (13487, 32271, 43622, 43635, 45634) | 16 | Pre-existing target ADMIN account. `users-manual-privileged-14-manifest.json` scope line states explicitly: "exactly the 14 legacy users neither kept ADMIN (**user:1**) ... " — user:1 was deliberately never migrated via any lineage-based track; it already exists in the target under a different identity. |
| `wordpress-db:user:43` | 1 (21778) | 4 | One of the 5 founder-excluded Phoenix Users records (`USERS_UNRESOLVED_SOURCE_RECORD_KEYS` in `src/lib/migration/release/knownBlockers.ts` — unrecoverable `first_name`/`last_name`). Also appears in `phoenix-business-ownership-base-2026-07-30.json` as one of the business-ownership EXACT_LINK_CANDIDATEs, already known to be excluded from that phase for the same reason. |
| `wordpress-db:user:129` | 9 (25756, 27759, 30346, 30411, 30426, 30502, 47316, 48375, 50033) | 0 | **Already migrated** — one of the "manual/privileged 14" Users, a separate, already-complete LOCAL track outside this Phoenix bundle's 559-user scope (`docs/migration/users-manual-privileged-14-manifest.json`: `sourceRecordKey: "wordpress-db:user:129"`, `placePostIdsCount: 9`, `action: "CREATE"` — matches exactly). Checklist line 90: "Users manual/privileged COMPLETE 14/14 ... 1 `BUSINESS_OWNER` (user:129, exact 9-Place ownership)". |

559 (Phoenix clean scope) + 14 (manual/privileged) + 5 (founder-excluded) =
578, matching the checklist's "Users migration COMPLETE 578/578" — so
every one of these three owners was already accounted for in some prior
decision. What was never done before is cross-checking the 78-record
Places scope's owners against the Phoenix bundle's 559-user boundary
specifically — the Places scope was frozen from "safe-scope LOCAL
publication complete" state, not from a check against this bundle's Users
phase.

## What this changes about the earlier framing

This is **not** the same shape of problem as the Businesses-phase blocker
(no implementation exists at all there). Here, two of the three owners
already have resolved, known target identities — the only genuinely open
question is *how* (or whether) this Phoenix release bundle should express
"this Place's owner already exists via a different track" as a dependency,
since `createPlacesDependencyResolver` only ever looks for an active USER
`MigrationLineage` row under the bundle's own `MigrationSource`.

## Not touched this session (per your "stop and hold" direction)

- `docs/migration/releases/phoenix-approved-2026-07-30.json` — unchanged;
  still declares all 78 Places / 63 Offers as CREATE.
- No exclusion list, no scope expansion, no owner-remapping logic added.
- `scripts/phoenix-full-bundle-clean-run.ts` was not re-run to a passing
  state — it currently fails closed at the first affected Place, exactly
  as designed.

## Options once you've decided

1. **Exclude the 35 records** (5+1+9 Places, 16+4 Offers) via
   `excludedSourceRecordKeys` + a blocker note, same pattern as the
   Businesses phase — ships the remaining 63 Places / 43 Offers this
   release, defers the rest.
2. **Wire user:1 and user:129 as resolvable dependencies** instead of
   excluding — e.g. a small, explicit owner-identity map (not a new
   classification subsystem) for these two known, already-resolved
   identities, while user:43's 1 Place/4 Offers still get excluded (its
   exclusion reason — unrecoverable name data — doesn't change). This
   would recover 14 of 15 Places and 16 of 20 Offers.
3. Something else you specify.

## Everything else from this session (done, tested, pushed)

- `src/lib/migration/release/adapters/registry.ts` — the common adapter
  registry (`buildPhoenixAdapterRegistry`), fail-closed structural checks,
  `registry.test.ts`.
- `scripts/migration-phoenix-release.ts` — `--apply`/`--rerun` now call
  the registry + `runPhoenixRelease` instead of throwing
  `RELEASE_ADAPTER_REGISTRY_EMPTY`.
- Articles phase in the manifest flipped from its original narrative-only
  `BLOCKED` (0 records) to `READY` with its already-proven 26-record scope
  artifact bound — the vertical slice was complete but the manifest had
  never been updated to reflect it.
- All Phoenix release/adapter tests, `tsc --noEmit`, and targeted ESLint
  pass clean. Pushed to `feat/phoenix-final-release-bundle` (PR #102,
  still Draft).
