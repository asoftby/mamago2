# Project Phoenix: Prelaunch Checklist

**Статус:** актуальный источник истины по оставшейся работе до production cutover mamaGo 2.0.

> **Next one action:** review the narrow continuation-aware read-only `--plan`
> correction from exact source `bbf075c847b8c0011d30b827806ec8a33e38fcea`,
> then commit and build a new immutable migration image. Only after that image
> is loaded on DEV may one fixed-image continuation-aware `--plan` run (see
> §J/K). The plan must report both unresolved active City
> prerequisites — `Копище` and `Мир` — before any continuation write. Then
> prepare a separate exact City bootstrap plan and stop for explicit founder
> authorization before creating either City row.

**Обновлено:** 2026-08-03
**Текущая фаза:** `PHOENIX FINAL RELEASE BUNDLE — DEV REHEARSAL PREPARATION`
**PR:** [#102 — feat(migration): final Phoenix release bundle](https://github.com/asoftby/mamago2/pull/102) — base `dev` — Draft / open / unmerged
**Exact release code SHA:** `f466c34c0cf095d054ae79d86a12505129719739`
**Canonical release manifest:** `docs/migration/releases/phoenix-approved-2026-07-30.json`
**Manifest SHA-256:** `a0980ae387d7316327234c86b8355a8b439ffefd3cb5de58bb8238dec1a6768f`
**Canonical public artifact inventory SHA-256:** `68909b9a499a3d201b794248a845c765a3b5e62c1c47f5e857be1c21214c30ec`
**DEV migration image:** `mamago2-migrate:phoenix-f466c34c0cf0`
**Image ID:** `sha256:8d505c6147d142e3231f172e3c4b71b1cf5ccd6b6b3c012b78d1475790fb1bdc`

State:

- image built locally;
- image transferred and loaded on DEV;
- baked code SHA verified;
- Git and `.git` absent from the image;
- canonical manifest verified;
- no Phoenix plan/apply/rerun executed yet;
- no migration DB writes executed;
- temporary transfer archive removed;
- DEV services remained unchanged;
- disk-capacity housekeeping remains before DEV plan.

> Более ранняя история (Slices 1–19, PRODUCT REGRESSION / RC READINESS,
> FINAL GO/NO-GO PREPARATION 2026-07-29/30) сохранена в Git, в профильных
> proof-документах и в журнале сессий внизу этого файла — это evidence, не
> текущая фаза. Единственная актуальная фаза и единственное актуальное
> следующее действие — те, что указаны выше.

---

## Release mode: operating rules

1. The migration implementation phase is closed unless an actual regression
   is proven.
2. DEV is a rehearsal environment, not a second development phase.
3. PROD repeats the already-proven DEV procedure using the same release SHA,
   manifest, private bundle and environment contract.
4. Use one prompt/run per complete phase, not one prompt per shell command.
5. Do not reopen completed Docker, Git SHA, manifest, artifact or transfer
   gates without concrete regression evidence.
6. Non-P0 anomalies go to a documented backlog and do not stop the clean
   scope.
7. Housekeeping issues must be resolved narrowly and must not reopen
   completed migration work.
8. No additional migration architecture improvements after a successful DEV
   apply + rerun proof.

**Valid stop conditions (the only ones):**

- environment identity mismatch;
- canonical manifest or artifact hash mismatch;
- missing or inconsistent private frozen-content bundle;
- risk of target-data loss;
- uncontrolled or broader-than-approved writes;
- unexpected scope expansion;
- lineage uniqueness violation;
- failure of idempotency;
- inability to determine whether a partial write occurred.

**The following do NOT reopen completed work:**

- intermittent SSH after a completed, independently verified operation;
- harmless cleanup-marker loss when final state can be verified
  idempotently;
- documented P1/P2 content gaps;
- media intentionally deferred by the approved environment policy;
- non-P0 individual-record anomalies moved to backlog;
- obsolete Docker/build cache housekeeping.

---

## Final canonical release scope

| Entity | Approved action scope |
| --- | ---: |
| Users | 563 READY |
| Businesses | 38 READY |
| Places | 78 READY |
| Offers | 63 READY |
| Routes | 14 READY |
| Events | 8 READY |
| Articles | 26 READY |
| Redirects | VALIDATION_ONLY |

- This release scope supersedes older per-slice counts (§2, §3) as the
  production execution contract; those historical counts remain evidence,
  not the current runner input.
- No automatic scope expansion is allowed during DEV or PROD execution.

Protected/adoption rules:

- founder ADMIN remains unchanged;
- `wordpress-db:user:1` is adopted through the configured platform-owner
  identity without account mutation;
- `user:43` remains non-privileged;
- `user:129` follows the proven business-owner path;
- `user:27` remains an Events dependency;
- Place 43023 uses protected adoption;
- existing 15 Places and 20 Offers are preserved;
- target UUIDs are not frozen into the release bundle;
- lineage is logical and keyed by `sourceRecordKey`.

---

## Phoenix release bundle — completed, do not repeat

- [x] Local golden proofs for all six vertical slices.
- [x] Complete disposable full execution (`phoenix-full-bundle-clean-run.ts`).
- [x] Zero conflicts and zero failed actions.
- [x] Cumulative DB/storage checks.
- [x] Full common rerun with `CREATE 0` and `SKIP`/`NOOP` only.
- [x] Unique lineage proof.
- [x] Forbidden-table checks.
- [x] Canonical release manifest and public artifact verification.
- [x] Exact code SHA baked into the migration image.
- [x] Local image verification.
- [x] DEV transfer verification.
- [x] DEV image load and isolated verification.
- [x] Git-independent code SHA resolution.
- [x] No remote Docker build required.

These gates are closed and may only be reopened by exact regression
evidence — see "Release mode: operating rules" above.

---

## Current blockers before DEV apply

### A. DEV capacity gate — COMPLETE

- required minimum: `8589934592` bytes (8 GiB);
- final free disk: `14164168704` bytes (~13.19 GiB);
- exact narrow cleanup only — removed the obsolete broken old Phoenix image
  (`mamago2-migrate:phoenix-559240d77b36`, reclaimed ~5.45 GiB) from DEV; kept
  a local evidence copy on the build machine; no broad Docker prune, no
  BuildKit cache prune, no PROD-scoped cleanup;
- fixed image (`mamago2-migrate:phoenix-f466c34c0cf0`,
  `sha256:8d505c6147d142e3231f172e3c4b71b1cf5ccd6b6b3c012b78d1475790fb1bdc`)
  retained on DEV, identity and revision label re-verified after cleanup;
  the image verification gate was not reopened;
- DEV containers, database, networks, volumes and published ports confirmed
  unchanged before and after cleanup.

### B. DEV plan — PASS

Executed on the fixed image (`mamago2-migrate:phoenix-f466c34c0cf0`,
`sha256:8d505c6147d142e3231f172e3c4b71b1cf5ccd6b6b3c012b78d1475790fb1bdc`),
2026-08-03, one disposable `--rm` container (`phoenix-dev-plan-f466c34c0cf0`,
network `dev_dev_net`, read-only root + tmpfs `/tmp`, no host mounts, no
ports, capabilities dropped).

- exit code: `0`;
- `releaseId`: `phoenix-approved-2026-07-30`;
- `manifestHash`: `a0980ae387d7316327234c86b8355a8b439ffefd3cb5de58bb8238dec1a6768f`
  (matches canonical);
- `codeSha`: `f466c34c0cf095d054ae79d86a12505129719739` — resolved from the
  baked `/app/.phoenix-code-sha`, no Git fallback needed (none available);
- environment fingerprint: `DEV`, database `devmamago` (host `db`, schema
  `public`, `currentDatabase` matches — no fingerprint mismatch), storage
  provider `none` (media disabled for this DEV plan run) — no secrets or
  `DATABASE_URL` printed at any point;
- scope result — every phase exactly matches the canonical release scope,
  no blockers:

  | Entity | Result |
  | --- | ---: |
  | Users | 563 READY |
  | Businesses | 38 READY |
  | Places | 78 READY |
  | Offers | 63 READY |
  | Routes | 14 READY |
  | Events | 8 READY |
  | Articles | 26 READY |
  | Redirects | VALIDATION_ONLY |

- performed exactly one read-only DB fingerprint query;
- performed no target-table writes, no apply, no rerun;
- created no migration report requiring rollback;
- DEV containers, database, networks, volumes and published ports confirmed
  byte-for-byte unchanged before/after; plan container left no residue;
  `dev-db-1` remained healthy throughout; free disk remained
  `14164025344` bytes after (well above the `8589934592` minimum).

### C. Private Phoenix inputs — verified locally, transferred to DEV (see §D for blockers)

> **Corrects a previous false blocker.** An earlier pass reported
> `BLOCKED_PRIVATE_BUNDLE_INTEGRITY`, concluding `users/capture.json` was
> missing 3 required records. That check compared the file against the
> full 563 executable Users scope — the wrong completeness boundary. The
> Phoenix Users runtime deliberately splits its 563 inputs across **three
> separate sources**, and the file was never meant to contain all 563. No
> data was ever missing or corrupt; no recapture or repair was needed or
> performed.

**Exact runtime routing** (from `src/lib/migration/release/adapters/usersProductionWiring.ts`
at the exact fixed source `f466c34c0cf095d054ae79d86a12505129719739`):

| Source | Keys | Env var | Mechanism |
| --- | ---: | --- | --- |
| `users/capture.json` (clean track) | 560 | `PHOENIX_RELEASE_ARTIFACT_ROOT` | `rawSource.loadSourceCandidate(key)` |
| Manual privileged capture (reused track) | 2 | `PHOENIX_MANUAL_PRIVILEGED_CAPTURE` | `loadReusedTrackCandidate(key)`, keys `wordpress-db:user:27` and `wordpress-db:user:129` |
| Platform-owner adoption | 1 | `PHOENIX_PLATFORM_OWNER_EMAIL` | DB lookup by email + `MigrationLineage` link, key `wordpress-db:user:1` — no file read at all |
| **Total** | **563** | | matches the approved Users scope exactly |

Confirmed exhaustively from source: no other Users key is routed outside
`users/capture.json`; the exclusion set (`wordpress-db:user:7/17/22/42`,
handled separately by `EXCLUDED_USER_KEYS`) does not overlap with 1/27/129.

**A. Main private release bundle** —
`/Users/shapovalovalexey/.mamago2/migration-snapshots/phoenix-final-bundle-2026-07-31/`
— **PASS**

- structure: exact match, all 6 required files (`users`, `places`, `offers`,
  `routes`, `events`, `articles`), no extra files, no symlinks anywhere;
- checksums: all 6 match their canonical committed SHA-256 exactly;
- `users/capture.json`: **exactly 560/560** clean-track keys — 0 missing,
  0 extra, 0 duplicates, and correctly contains none of the 3
  externally-routed keys;
- other five entities: 100% source-record-key coverage, unchanged;
- permissions: files `0600` (good); bundle root and entity subdirectories
  are `0755` (not `0700`) — mitigated by `~/.mamago2` and
  `~/.mamago2/migration-snapshots` both being `0700` (owner-only
  traversal), but still worth tightening before transfer;
- deterministic inventory SHA-256 (sorted `relpath\tsize\tsha256`):
  `28745eeebb811f048cf4a0d3665feb5cdc41adbdec032b139ee36030f2e5d5d7`
  (unchanged from the original verification — nothing in this bundle was
  ever modified).

**B. Manual privileged capture** —
`/Users/shapovalovalexey/.mamago2/migration-snapshots/users/manual-privileged-14/raw-capture.json`
— **PASS** (already existed, captured 2026-07-28, before this session —
no new WordPress session was needed)

- regular file, not a symlink, mode `0600`; parent directory mode `0700`;
- structure matches the `ManualPrivilegedCapture` loader contract
  (`users`/`userMeta`/`posts`, plus informational `capturedAt`/`legacyUserIds`);
- exact fixed 14-legacy-ID scope present (0 missing, 0 extra) — **both
  `wordpress-db:user:27` and `wordpress-db:user:129` present**;
- no password/hash/secret/token/session/activation fields found;
- size: 16,313 bytes; SHA-256:
  `dd63ea2d560ce6ec0f13de8ee551341120b5d1eca2f088cc0e7396e139384d68`.

**C. Platform-owner adoption** — **PASS** (source-only verification, no DB
access)

- `wordpress-db:user:1` requires no source capture record of any kind —
  confirmed by exhaustive routing-branch review;
- target resolved by exact-match lookup on `PHOENIX_PLATFORM_OWNER_EMAIL`
  against the target DB, then linked via one `MigrationLineage` row —
  never mutates the existing account;
- `PHOENIX_PLATFORM_OWNER_EMAIL` must exist at apply time (fails closed if
  absent); its value was never resolved, read, or printed in this task.

**Exact future apply-time input contract** (documentation only — nothing
transferred, mounted, or executed):

1. `PHOENIX_RELEASE_ARTIFACT_ROOT` → mount the verified bundle root
   read-only at the container path the runner expects; 6-file inventory
   hash above is the pre-transfer evidence baseline.
2. `PHOENIX_MANUAL_PRIVILEGED_CAPTURE` → mount/copy
   `raw-capture.json` read-only; size/SHA-256 above is the pre-transfer
   evidence baseline.
3. `PHOENIX_PLATFORM_OWNER_EMAIL` → must be present in the DEV
   environment at apply time; presence-only check, no value ever surfaced.

No WordPress access, no artifact rebuild, no public manifest change, and no
Docker image rebuild are required. The already-completed DEV `--plan` and
the fixed image (`mamago2-migrate:phoenix-f466c34c0cf0`) remain current for
execution.

### D. DEV transfer — COMPLETE (two operational blockers found here; resolved in §E)

Both private inputs transferred (2026-08-03) via a single tar.gz archive
(504,024 bytes, SHA-256
`0217b2730573976e00f696a8cd3a1300b428120ec311d54f2fc3bb10d90a46be`; local
copy kept as reproducibility evidence), byte/hash-verified on arrival, then
atomically placed into the final immutable location — **PASS**:

- `PHOENIX_RELEASE_ARTIFACT_ROOT` source →
  `/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/release/`
  — all 6 files re-verified after placement, inventory SHA-256 unchanged
  (`28745eeebb811f048cf4a0d3665feb5cdc41adbdec032b139ee36030f2e5d5d7`);
- `PHOENIX_MANUAL_PRIVILEGED_CAPTURE` source →
  `/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/manual/raw-capture.json`
  — re-verified after placement, size `16313`, SHA-256
  `dd63ea2d560ce6ec0f13de8ee551341120b5d1eca2f088cc0e7396e139384d68`;
- permissions: every directory `0700`, every file `0600`, owned by the DEV
  deploy user — matches the required bar exactly (tighter than the local
  source, which had `0755` directories);
- original DEV transfer archive removed after verified placement; incoming
  staging directory removed.

**Two findings block a real `--apply`, discovered by this task's own
verification steps — neither requires touching the transferred files:**

1. **`PHOENIX_PLATFORM_OWNER_EMAIL` is absent from `/opt/mamago/dev/.env`.**
   Checked read-only, value never printed — confirmed twice, 0 matches for
   the key in the file. `usersProductionWiring.ts` fails closed
   (`MISSING_PHOENIX_PLATFORM_OWNER_EMAIL`) the moment the Users phase
   reaches `wordpress-db:user:1` without it. `.env` was **not** modified by
   this task. Needs the founder/admin email already resolvable in the DEV
   DB added to `.env` (or supplied as an explicit apply-time override)
   before `--apply` can succeed.

2. **Capability-profile mismatch found during read-only mount
   verification.** The fixed image runs as **root (UID 0) by default** (no
   `USER` directive). An isolated verification container run with
   `--cap-drop ALL` (matching this task's own specified hardened
   inspection profile) could `stat`/see both mounted inputs but got
   `Permission denied` trying to actually read their contents — because
   dropping all capabilities also drops `CAP_DAC_OVERRIDE`, the specific
   capability root needs to bypass file-owner checks on files it doesn't
   own (here, owned by the DEV deploy user, mode `0600`/`0700`). This is
   **not evidence the files are wrong** — a host-side `sha256sum` (run as
   the owning deploy user, outside Docker) confirmed both files match
   their canonical hashes exactly. It does mean: whatever capability
   profile the real `--apply` container uses must either keep normal
   (non-dropped) capabilities, or explicitly retain `CAP_DAC_OVERRIDE` if
   full `--cap-drop ALL` hardening is still wanted.

**Exact container mount/env arguments for the real future apply** (still
documentation only — not executed):

```
--mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/release,target=/phoenix-private/release,readonly
--mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/manual/raw-capture.json,target=/phoenix-private/manual/raw-capture.json,readonly
-e PHOENIX_RELEASE_ARTIFACT_ROOT=/phoenix-private/release
-e PHOENIX_MANUAL_PRIVILEGED_CAPTURE=/phoenix-private/manual/raw-capture.json
```

DEV non-interference reconfirmed after every transfer step: all 7 running
containers unchanged (same IDs/`StartedAt`/`RestartCount 0`), `dev-db-1`
healthy, networks/volumes/ports unchanged, no Phoenix process/container
left behind, fixed image unchanged, free disk `14,160,257,024` bytes
remaining (well above the 8 GiB minimum). No DB command, no plan/apply/
rerun, no `/opt/mamago/prod` access occurred.

### E. Both operational blockers resolved — `PHOENIX_PRIVATE_INPUTS_READY_ON_DEV`

Neither fix touched the image, either private capture, `/opt/mamago/dev/.env`,
or migration code. `CAP_DAC_OVERRIDE` was deliberately **not** granted, per
explicit decision — the container instead runs as the deploy UID/GID with
`--cap-drop ALL` retained.

**Exact runtime environment variable names** (from
`src/lib/migration/release/adapters/usersProductionWiring.ts` at the exact
fixed source `f466c34c0cf095d054ae79d86a12505129719739` — resolved from the
literal `process.env[...]` reads, not from prose):

- `PHOENIX_RELEASE_ARTIFACT_ROOT`
- `PHOENIX_MANUAL_PRIVILEGED_CAPTURE` — **not** `PHOENIX_MANUAL_PRIVILEGED_CAPTURE_ENV`;
  that longer name is only the JS constant identifier, not the runtime key
- `PHOENIX_PLATFORM_OWNER_EMAIL`

All three are required identically for both `--apply` and `--rerun` (both
modes build the adapter registry through the same code path in
`scripts/migration-phoenix-release.ts`).

**1. Platform-owner email — resolved uniquely, never printed.** One bounded
read-only query against the DEV database (`SELECT COUNT(*) ... WHERE
role='ADMIN' AND "deletedAt" IS NULL`, then the matching `email`, both via
`docker exec dev-db-1 sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" ...'`
— no password ever needed, no `DATABASE_URL` touched) found **exactly one**
candidate. Its email was written directly into a new **protected runtime env
file**, never through `/opt/mamago/dev/.env`:

```
/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/platform-owner.env
```

Created atomically (temp file + rename), single line
(`PHOENIX_PLATFORM_OWNER_EMAIL=<value>`), mode `0600`, owned by the deploy
user, no CRLF, not a symlink — verified structurally only (line count, key
shape, mode, owner); the value itself was never printed, logged, or echoed
at any point in this task.

**2. Capability/permission mismatch — resolved by matching the container's
runtime identity to the file owner, not by adding capabilities.** The fixed
image runs as root by default, but the private-input files are owned by the
DEV deploy user (uid `1000`) at `0600`/`0700`. Running the container with
`--user 1000:1000` (instead of root) means standard Unix owner-read
permissions apply directly — no `CAP_DAC_OVERRIDE` needed at all, even with
`--cap-drop ALL` retained in full.

**Hardened verification container** (`--rm --network none --read-only
--tmpfs /tmp --user 1000:1000 --cap-drop ALL --security-opt
no-new-privileges`, both inputs mounted read-only, protected env file via
`--env-file`, no DEV `.env`, no database variables) — **all PASS**:

- process identity: uid=1000, gid=1000 (confirmed non-root);
- `/app` runtime files readable and executable under the deploy UID — proven
  by running the image's own existing unit test suite
  (`migration-phoenix-release tests: OK`), without invoking the Phoenix CLI;
- both mounted inputs readable, neither writable;
- all 6 main-bundle artifact hashes match canonical values exactly;
- manual capture size (`16313`) and SHA-256
  (`dd63ea2d560ce6ec0f13de8ee551341120b5d1eca2f088cc0e7396e139384d68`) match
  exactly;
- `PHOENIX_PLATFORM_OWNER_EMAIL` present inside the container (value never
  printed);
- baked code SHA exactly `f466c34c0cf095d054ae79d86a12505129719739`; Git
  absent;
- disposable container confirmed removed afterward.

**Exact future full `--apply`/`--rerun` container contract** (documentation
only — still not executed):

```
--user 1000:1000
--cap-drop ALL
--security-opt no-new-privileges:true
--mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/release,target=/phoenix-private/release,readonly
--mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/manual/raw-capture.json,target=/phoenix-private/manual/raw-capture.json,readonly
--env-file /opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/platform-owner.env
-e PHOENIX_RELEASE_ARTIFACT_ROOT=/phoenix-private/release
-e PHOENIX_MANUAL_PRIVILEGED_CAPTURE=/phoenix-private/manual/raw-capture.json
--env-file /opt/mamago/dev/.env   # APP_ENV, PHOENIX_DATABASE_ENV, PHOENIX_STORAGE_ENV, DATABASE_URL, etc. — already proven by the passing DEV --plan
```

No `CAP_DAC_OVERRIDE` is required anywhere in this contract.

Final non-interference (same session): all 7 containers unchanged, `dev-db-1`
healthy, networks/volumes/ports unchanged, no Phoenix container/process
left behind, free disk `14,151,806,976` bytes remaining (well above 8 GiB).
No DB write, no plan/apply/rerun, no `/opt/mamago/prod` access.

### F. Final pre-apply baseline — `PHOENIX_DEV_PRE_APPLY_READY`

Captured 2026-08-03, one SSH session, fully read-only except for creating
one empty writable directory (see "report output" below — no code, data, or
`.env` touched).

**Infrastructure baseline:** all 7 containers unchanged (same IDs/
`StartedAt`/`RestartCount 0` as every prior snapshot in this effort),
`dev-db-1` healthy, networks/volumes/ports unchanged, fixed image identity
exact (`sha256:8d505c6147d142e3231f172e3c4b71b1cf5ccd6b6b3c012b78d1475790fb1bdc`,
revision `f466c34c0cf095d054ae79d86a12505129719739`), no Phoenix container or
process present, free disk `14,151,852,032` bytes.

**Private inputs re-confirmed:** main bundle inventory SHA-256
`28745eeebb811f048cf4a0d3665feb5cdc41adbdec032b139ee36030f2e5d5d7`, manual
capture SHA-256 `dd63ea2d560ce6ec0f13de8ee551341120b5d1eca2f088cc0e7396e139384d68`,
platform-owner env file structurally valid (1 line, correct key, `0600`) —
all unchanged since §E.

**Read-only DB baseline** (one aggregate `psql` session via `docker exec
dev-db-1`, local socket trust auth, no `DATABASE_URL` touched, no row
content printed — counts only):

| Table | Count |
| --- | ---: |
| User | 1 (the founder ADMIN account only) |
| Business | 0 |
| Place | 1 (the pre-seeded `atmosfera` reference used by protected-place adoption) |
| Offer | 0 |
| Route | 0 |
| RouteStop | 0 |
| Activity (Events target) | 0 |
| Article | 0 |
| MigrationLineage (active) | 1 |
| MigrationRecord | 2 |
| MigrationRun | 2 |
| Session | 4 |
| UserActionToken | 0 |
| MediaAsset | 1 |

**Invariants:** `founder_admin_count=1` (matches the platform-owner
resolution in §E); `duplicate_lineage_natural_key_count=0`; **`phoenix_release_bundle_lineage_count=0`**
— zero `MigrationLineage` rows exist yet under this release's own
`MigrationSource` namespace (`phoenix-release-bundle`), which is the
precise invariant proving no write has occurred *for this release*, even
though the DB already carries a few unrelated pre-existing rows (1 active
lineage, 2 runs, 2 records — from other, unrelated prior migration/import
activity on this shared DEV instance, not Phoenix).

**Expected apply actions**, derived from the canonical manifest plus this
baseline (not yet executed — informational only):

| Entity | Records | Classification |
| --- | ---: | --- |
| Users | 563 | 562 CREATE (new `User` rows) + 1 ADOPT (`wordpress-db:user:1` links the *existing* founder account via one `MigrationLineage` row — creates no new `User` row) |
| Businesses | 38 | 38 CREATE |
| Places | 78 | 78 CREATE, plus one separate PRESERVE/LINK side-effect: the protected-adoption wrapper links `wordpress-db:places:43023` to the existing `atmosfera` Place (4 `protectedSourceRecordKeys` are excluded from independent creation) |
| Offers | 63 | 63 CREATE |
| Routes | 14 | 14 CREATE |
| Events | 8 | 8 CREATE (2 `excludedSourceRecordKeys` already excluded from the manifest's executable set) |
| Articles | 26 | 26 CREATE |
| Redirects | — | VALIDATE_ONLY, no adapter, no write |

Known, already-documented deviation (not a new finding): the frozen
manifest statically declares `wordpress-db:user:38` as `SKIP_UNCHANGED`
(reflecting the state of the reference environment the manifest was
validated against), but on this untouched DEV target its real live action
will be `CREATE` — `scripts/phoenix-full-bundle-clean-run.ts` documents
this exact deviation for first-pass runs against a clean target.

Required and confirmed: blockers `0`, conflicts `0`, unexpected scope `0`,
duplicate lineage `0`. No records were approved individually.

**Report output — one necessary deviation from the `--plan` container
profile:** `--apply` writes an append-only JSONL progress report
(`JsonLinesPhoenixReportStore`, one line per completed phase) that
`--plan` never touches. Under a fully `--read-only` root with only a
tmpfs `/tmp`, that write would either fail or — if redirected into `/tmp`
— vanish the moment the container is removed, defeating "preserve
partial-write evidence" if the run fails partway. One additional **empty,
writable** directory was created for exactly this purpose (the only
non-read-only local change in this task):

```
/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/reports/   (0700, deploy-user owned)
```

**Exact prepared sequential `--apply` command** (not executed — no
`DATABASE_URL` or platform-owner email appears in it; both are supplied
only via `--env-file`):

```bash
docker run \
  --rm \
  --name phoenix-dev-apply-f466c34c0cf0 \
  --network dev_dev_net \
  --env-file /opt/mamago/dev/.env \
  --env-file /opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/platform-owner.env \
  -e APP_ENV=DEV \
  -e PHOENIX_DATABASE_ENV=DEV \
  -e PHOENIX_STORAGE_ENV=DEV \
  -e PHOENIX_STORAGE_PROVIDER=none \
  -e PHOENIX_STORAGE_LOCATION=dev-media-disabled \
  -e MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=false \
  -e SITE_INDEXING_ENABLED=false \
  -e SITE_NOINDEX_FORCE=true \
  -e HOME=/tmp \
  -e PHOENIX_RELEASE_ARTIFACT_ROOT=/phoenix-private/release \
  -e PHOENIX_MANUAL_PRIVILEGED_CAPTURE=/phoenix-private/manual/raw-capture.json \
  --user 1000:1000 \
  --read-only \
  --tmpfs /tmp \
  --mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/release,target=/phoenix-private/release,readonly \
  --mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/manual/raw-capture.json,target=/phoenix-private/manual/raw-capture.json,readonly \
  --mount type=bind,source=/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/reports,target=/phoenix-private/reports \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --restart no \
  --pids-limit 512 \
  --memory 1g \
  --cpus 1.0 \
  --entrypoint /bin/sh \
  mamago2-migrate:phoenix-f466c34c0cf0 \
  -lc 'cd /app && HOME=/tmp ./node_modules/.bin/tsx scripts/migration-phoenix-release.ts --environment DEV --manifest docs/migration/releases/phoenix-approved-2026-07-30.json --apply --report /phoenix-private/reports/dev.jsonl'
```

Expected execution behavior: one sequential run through
`phaseOrder` (users → businesses → places → offers → routes → events →
articles), stop on first writer error, no automatic retry, no automatic
rollback, partial-write evidence preserved in the mounted `reports/`
directory (survives container removal). Next action after a successful
apply is the **cumulative post-apply audit**, not an immediate `--rerun`.

**Stop conditions for the real apply** (unchanged from design, restated for
this run): environment mismatch, image/revision mismatch, private artifact
hash mismatch, platform-owner resolution mismatch, unexpected action or
scope expansion, lineage uniqueness violation, target conflict, first
writer error, or unknown partial-write state. Non-P0 individual content
anomalies go to backlog and do not reopen the canonical scope unless they
affect write safety.

Final non-interference (same session): unchanged from the infrastructure
baseline above — nothing was written to the database, no plan/apply/rerun
executed, no `/opt/mamago/prod` access.

### G. First DEV apply attempt — `PHOENIX_DEV_APPLY_PARTIAL_FAILURE`

**Pre-apply docs commit:** `a9d2b17520ea7eb3f41c75e7231aa39455752093`
(`docs(migration): record Phoenix DEV pre-apply readiness`, one file,
uncommitted checklist evidence from §A–§F) — not pushed.

**Founder authorization:** explicit, quoted: *"Подтверждаю запуск одного
последовательного DEV --apply. Без автоматического retry, rollback и
rerun. После завершения остановиться и выполнить cumulative audit."*

**Execution:** `2026-08-03T11:04:34Z`–`2026-08-03T11:04:37Z` (3s), exit
code `1`, container `phoenix-dev-apply-f466c34c0cf0` (auto-removed via
`--rm` — data written to the DB is not affected by container removal).

**Exact error:**
```
migration:phoenix-release failed: PHASE_FAILED: users:wordpress-db:user:38:UNEXPECTED_PLAN_ACTION:CREATE
```

**Root cause — confirmed from source, not a migration-engine bug.**
`src/lib/migration/release/adapters/usersAdapter.ts` (`UsersPhaseExecutor.execute`)
compares each record's live re-derived `plan.action` against the
manifest's *static* `expectedAction`, and fails closed on any mismatch —
by its own doc comment, deliberately: *"a plan that disagrees with what the
frozen manifest expects is a FAILED outcome ... never silently reconciled
to whichever action actually happened."* The committed manifest
(`docs/migration/releases/phoenix-approved-2026-07-30.json`) declares
`wordpress-db:user:38` as `SKIP_UNCHANGED` (frozen at generation time,
reflecting whatever reference state existed then); the live plan against
this genuinely untouched DEV target correctly resolves it to `CREATE`
(the user doesn't exist yet). This is exactly the deviation flagged as
"known" in §F — `scripts/phoenix-full-bundle-clean-run.ts` (a separate,
one-off test script) already carries a manifest patch for precisely this
key on a first/fresh-target pass; the general-purpose `--apply` CLI used
here does not, and correctly refused to proceed rather than silently
reinterpret the mismatch.

**Progress report (preserved, not deleted):**
`/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/reports/dev.jsonl`,
965 bytes, SHA-256
`77bc7f542ec816fcb8b5109085b5e0847ae021b9df27a34db3979a0f1fd7aeae`.

**Actual partial-write state — clean and fully isolated to the Users phase:**

| Table | Before | After | Delta |
| --- | ---: | ---: | ---: |
| User | 1 | 20 | **+19** |
| Business | 0 | 0 | 0 |
| Place | 1 | 1 | 0 |
| Offer | 0 | 0 | 0 |
| Route | 0 | 0 | 0 |
| RouteStop | 0 | 0 | 0 |
| Activity | 0 | 0 | 0 |
| Article | 0 | 0 | 0 |
| MigrationLineage (active) | 1 | 21 | +20 (19 CREATE + 1 ADOPT link) |
| MigrationRecord | 2 | 21 | +19 |
| MigrationRun | 2 | 21 | +19 |
| Session | 4 | 4 | 0 |
| UserActionToken | 0 | 0 | 0 |
| MediaAsset | 1 | 1 | 0 |

- **Forbidden/protected tables: zero unexpected writes** — Business, Place,
  Offer, Route, RouteStop, Activity, Article, Session, UserActionToken,
  MediaAsset all exactly unchanged, confirming write isolation held even
  under this partial/failed run;
- `phoenix_release_bundle_lineage_count`: `0` → `20`, all `targetType=USER`
  (`phoenix_lineage_by_target_type=USER:20`);
- `phoenix_platform_owner_link_exists=1` — the `wordpress-db:user:1`
  ADOPT/link succeeded before the 19 clean-track CREATEs ran, consistent
  with `phaseOrder`/record order;
- `founder_admin_count=1` (unchanged), `duplicate_lineage_natural_key_count=0`;
- one audit-query caveat, not a write-safety issue: `protected_atmosfera_place_still_single`
  queried `Place` by `slug='atmosfera'` and got `0`, even though `Place`
  count is unchanged at `1` (Places phase was never reached). This means
  either the pre-seeded reference Place's actual slug differs from
  `atmosfera`, or the query's assumption was imprecise — worth confirming
  before the Places phase is ever attempted, but it is unrelated to this
  apply's failure and nothing was written to `Place` in this run.
- **No rollback, no retry, no rerun** was performed, per explicit
  instruction and founder authorization scope.

**Non-interference:** all 7 containers unchanged (same IDs/`StartedAt`/
`RestartCount 0`), networks/volumes/ports unchanged, `dev-db-1` healthy,
fixed image unchanged, free disk `14,151,725,056` bytes remaining (well
above 8 GiB). No `/opt/mamago/prod` access, no manual SQL mutation, no
Docker build/load/prune/removal, no service restart.

### H. Safe continuation design for §G — `PHOENIX_PARTIAL_APPLY_CONTINUATION_READY`

**Scope of this entry:** design + implementation only, in an isolated
worktree. **No DEV write, no Docker build/push, no commit/push performed.**

**Partial-prefix reconstruction (proved, not assumed).** Cross-checked the
preserved `dev.jsonl` report against a bounded read-only DEV audit
(`MigrationLineage`, `targetType=USER`, active rows, ordered by creation)
and the canonical manifest's own `users` record order: exactly 20 completed
keys (19 `CREATE` + the `wordpress-db:user:1` platform-owner `ADOPT` link,
in manifest order), the 21st key (`wordpress-db:user:38`) is the proven
terminal failure (`UNEXPECTED_PLAN_ACTION:CREATE`), and the remaining
manifest suffix — the rest of `users` plus every phase after it — was never
started. DB order and manifest order agree exactly for this prefix, so the
reconstruction is exact, not inferred.

**Why neither existing mechanism can safely complete this state (from
source, not assumption):**
- A second plain `--apply` re-derives and re-executes the *entire* phase
  from record 1 — it does not know 20 records already succeeded, and would
  immediately fail again on the same `wordpress-db:user:38` mismatch
  before ever reaching new ground, since `--apply`/`--rerun` share one
  `runSequential` loop in `SequentialEntityPhaseAdapter`
  (`src/lib/migration/release/adapter.ts`) with no skip-prefix support.
- `--resume-from <phase>` (`assertResume` in `coordinator.ts`) operates at
  *phase* granularity only and explicitly rejects resuming into a phase
  whose own report shows `failed > 0` (`RESUME_INTO_FAILED_PHASE`) — it
  cannot resume *within* the failed `users` phase at all.
- Changing only the manifest's declared action for `wordpress-db:user:38`
  (§G's literal next-step note) is **not sufficient by itself**: even with
  that one record fixed, a plain re-`apply` still has no notion of "skip
  the 20 already-complete records" and would attempt to re-run the
  `CREATE`/`ADOPT` logic for all of them again — safe only if every one of
  those executors is perfectly idempotent against records that already
  exist, which the fail-closed design explicitly does not assume.

**Chosen design, revised 2026-08-03 (adversarial-review pass) — direct
continuation from the original §G report, no intermediate failing apply:**
a new, explicit three-flag CLI contract, valid only with `--apply`, mutually
exclusive with `--resume-from`, all three required together or none:
`--continue-from-report <path>`, `--continue-from-report-sha256 <sha256>`,
`--continue-from-code-sha <predecessor-40-hex-sha>`. This resumes **directly
from the original §G report** produced by predecessor code SHA
`f466c34c0cf095d054ae79d86a12505129719739` — it does **not** require a
throwaway intentionally-failing `--apply` under the new image merely to
mint a report stamped with the new SHA (the earlier version of this design,
superseded below, had exactly that gap).

**Cross-code-SHA identity (`continuation.ts`'s `loadCrossShaContinuationReport`),
every check fails closed:** the report file's SHA-256 must equal the
explicitly supplied hash · the report's own `codeSha` must equal the
explicitly supplied predecessor SHA · that predecessor SHA must be a member
of a small hardcoded allowlist (`KNOWN_PREDECESSOR_CODE_SHAS`, exactly one
entry today: `f466c34c...9739`) — **not** an open `--ignore-code-sha` escape
hatch; extending the allowlist to a new predecessor requires a reviewed
source change, never an operator-supplied flag · the currently-running
code's own baked SHA must differ from the predecessor · `releaseId` /
`manifestHash` / environment tier / full environment fingerprint
(host/port/db/schema/storage) must all match the current run exactly · the
report must genuinely describe a failure. The predecessor report file must
be exactly one JSONL line (a captured artifact, not an ongoing journal).

**Exact-prefix proof (`resolveExactCompletedPrefix`), replacing the earlier
count-bounds design entirely:** no longer trusts the report's own
`created + updated` count as authoritative (only as an advisory upper
bound — the count may legitimately be *lower* than the proven prefix, e.g.
a smaller chained report, but never higher). The authoritative proof is
positional: live `MigrationLineage` rows are checked one-for-one against
the manifest's own deterministic record order up to the failed key's exact
index — every prefix position must have a matching live row (no missing
key), no live-completed key may exist at or after the failed key's position
(no non-prefix write, and the failed key itself must not already be
complete), every live row must belong to a key actually in this phase's
record set (no unrelated-namespace contamination), and no key may appear
twice (no duplicate lineage). A prefix position whose manifest action is
not `CREATE`/`UPDATE` (i.e. would leave no lineage row even when correctly
processed) is rejected outright rather than guessed at
(`CONTINUATION_PREFIX_AMBIGUOUS_ACTION`) — this mechanism only ever proves
completion from evidence, never assumes it.

**`wordpress-db:user:38` handling — narrow release-exception registry, not
a general mismatch bypass:** `continuation.ts` now carries exactly one
itemized entry (`PHOENIX_RELEASE_ACTION_EXCEPTIONS`): phase `users`, key
`wordpress-db:user:38`, manifest-declared `SKIP_UNCHANGED` corrected to
`CREATE`, with its root-cause reason inline. `applyReleaseActionExceptions`
checks the manifest's *current* declared action for that exact key before
overriding it — a manifest that no longer says what the exception expects
fails closed (`CONTINUATION_RELEASE_EXCEPTION_STALE`) rather than silently
re-applying a stale correction. Applied to an **in-memory copy** of the
manifest only, unconditionally for every apply/rerun (continuation or not,
since this corrects stale manifest data, not continuation-specific
behavior) — the committed manifest file and `manifestHash` are never
touched, and `--plan` output is deliberately unaffected (it must keep
reflecting the raw frozen manifest). Every other record's manifest/live-plan
mismatch still fails closed exactly as before in `UsersPhaseExecutor`, and
every other entity executor is completely untouched — this is not a general
"trust the live plan" behavior change anywhere in the codebase.

**Continuation chain evidence:** every report line produced during a
continuation run (success or a fresh failure alike) now carries sanitized
provenance in its existing `resolvedIdentities` field — predecessor code
SHA, predecessor report SHA-256, predecessor's terminal failed key, exact
skipped-prefix count, and the exact continuation start key — alongside the
run's own native `releaseId`/`manifestHash`/`codeSha`/`created`/`updated`/
`failed`/`firstFailure`. No raw predecessor report lines or private data
are copied, and it stays in the same durable JSONL file
(`JsonLinesPhoenixReportStore`, unchanged, 0600, survives container exit).
A non-continuation run records nothing extra in that field, as before.

**Files changed (8, verified via `git status --short`) — still no
manifest, artifact, Dockerfile, or Prisma file touched:**
`src/lib/migration/release/continuation.ts` (rewritten),
`src/lib/migration/release/continuation.test.ts` (rewritten),
`src/lib/migration/release/adapter.ts` (unchanged from the first pass —
additive optional constructor param), `src/lib/migration/release/adapters/registry.ts`
(now calls the exact-prefix resolver), `src/lib/migration/release/coordinator.ts`
(new, additive optional `continuationEvidence` input, merged into
`resolvedIdentities` on both report branches — the one new file beyond the
original six), `scripts/migration-phoenix-release.ts` (three-flag CLI
contract + release-exception application), `scripts/migration-phoenix-release.test.ts`
and `src/lib/migration/release/release.test.ts` (new coverage).

**Tests/checks, all green in the isolated worktree:** every
`src/lib/migration/release/**/*.test.ts` and both `scripts/migration-phoenix-release.test.ts`
suites, `tsc --noEmit` clean, targeted ESLint clean, `git diff --check`
clean. New/updated coverage: cross-SHA report accepted only with the exact
explicit predecessor SHA + report SHA-256 (and rejected on an unknown
predecessor SHA, a wrong report hash, a codeSha disagreement, an unchanged
current SHA, any release-ID/manifest-hash/environment mismatch, a
non-failure, or a malformed/empty/multi-line/unreadable report) · the exact
20-key synthetic DEV-shaped prefix continues directly at `user:38` with no
intermediate failing apply, and every non-prefix/missing/duplicate/
unrelated/ambiguous-action/wrong-phase variation fails closed · the report
count may be lower than the proven prefix but never higher · the release
exception corrects exactly `user:38` and fails closed on a stale manifest
action or outside the `users` phase · continuation evidence lands in
`resolvedIdentities` on success and failure alike, and is absent otherwise ·
CLI `parseArgs` enforces all-three-or-none, apply-only, and no combination
with `--resume-from`.

**Release-artifact impact — a new image is required before use:** runtime
code changed (YES) → canonical manifest changed (NO) → public artifact
hashes changed (NO) → progress-report JSONL *shape* unchanged (only
`resolvedIdentities`, an existing free-form field, gains keys during
continuation runs) → Docker image (**a NEW image is still required** —
today's deployed `f466c34c0cf0` image has none of this CLI contract) → CLI
contract (extended additively; every existing flag/behavior unchanged).
Consequence: new commit SHA, new migration image build, and — per the
standing DEV rehearsal process — one fresh fixed-image DEV `--plan` before
any continuation `--apply` is authorized. The original §G `dev.jsonl`
report remains exactly as captured (path and SHA-256 unchanged: `/opt/mamago/dev/.phoenix-private/phoenix-approved-2026-07-30/reports/dev.jsonl`,
`77bc7f54...9a0f1fd7aeae`) and is now the direct, sole input to the first
continuation attempt — no replacement report needs to be minted first.

**Historical next action (completed and superseded by §J):** review this revised design; on approval, commit +
push from the isolated worktree, build and load the new migration image on
DEV, run one fixed-image DEV `--plan`, then request explicit founder
authorization for exactly one continuation `--apply` (`--continue-from-report`
pointed at the original §G `dev.jsonl`, its known SHA-256, and predecessor
SHA `f466c34c...9739` — same one-shot, no-retry/rollback/rerun discipline
as §G). No DEV write, image build/push, or commit/push has been performed
as part of this entry.

### J. First continuation stopped safely; Place City recovery ready

**Completed DEV writes (one authorized continuation, no retry).** The first
continuation completed Users 563/563 and Businesses 38/38, then created
exactly Places `wordpress-db:places:5457`, `wordpress-db:places:5492`, and
`wordpress-db:places:5515`. It stopped cleanly at
`wordpress-db:places:5528:PLACE_CITY_DEPENDENCY_NOT_FOUND`; the failed key
has no lineage. Offers, Routes, Events, and Articles were never started.
The durable three-line report and cumulative bounded audit agreed exactly:
no duplicate lineage, forbidden-table write, storage/media write, founder
record change, retry, rollback, rerun, or second continuation occurred.

**Current blocker and root cause.** Bounded read-only investigation proved
that Place `5528` has canonical City `Копище`, while later approved Place
`32271` has canonical City `Мир`; DEV has neither active City. The existing
Place City resolver is correct and unchanged: it requires exactly one active,
case-insensitive canonical match and fails closed on zero or multiple matches.
There is no default to Минск, no City creation inside the Place writer, no
skipped source key, and approved counts remain 563/38/78/63/14/8/26.

**Recovery contract.** Both `Копище` and `Мир` are checked together,
read-only, before the registry's first release write. Zero or ambiguous active
matches report all unsatisfied prerequisites and block. Continuation now
derives each phase independently: Users and Businesses require exact full
completed lineage sets; Places skips exactly `5457`, `5492`, and `5515` and
first executes `5528`; Offers, Routes, Events, and Articles use empty skip
sets. Missing prefix lineage, non-prefix completion, duplicate lineage, and
unrelated release lineage all fail closed. A fully completed repeat is proven
to emit CREATE 0 and UPDATE 0.

**Exact second-hop identity.** The only authorized predecessor is code SHA
`2dc00b6026651c0d1b1008598a19a6833930820f` with report SHA-256
`257671d8dd039d803d5571cdcd0d00a8ddbdeaf4fba55c1a21b4f35850a9cfcc`,
embedded predecessor SHA, canonical release ID, manifest hash, complete
environment fingerprint, terminal key `wordpress-db:places:5528`, and exact
completed phase prefix Users → Businesses. There is no ignore-SHA flag or
arbitrary predecessor acceptance; the full chain remains
`f466c34c0cf095d054ae79d86a12505129719739` →
`2dc00b6026651c0d1b1008598a19a6833930820f` → the new fixed recovery SHA.

**Exit-code observability and next gate.** Future execution must run detached
without `--rm`, capture the container ID, record the exact exit code with
`docker wait`, inspect the durable report, complete the cumulative audit, and
only then run `docker rm`. This changes observability only, not migration
semantics. Runtime changed, so a new immutable fixed-SHA image and fixed-image
DEV plan are required. That read-only plan must report both missing active
Cities before continuation. A separate City bootstrap plan then requires
explicit founder authorization before either City row is created. Canonical
manifests, captures, and artifact hashes remain unchanged; no Docker, DEV,
City seed, retry, rollback, or rerun occurred during recovery implementation.

### K. Continuation-aware plan tooling correction selected (not yet run)

The fixed image built from `bbf075c847b8c0011d30b827806ec8a33e38fcea`
proved a tooling gap before its DEV plan was attempted: plain `--plan` returns
the static manifest summary before Prisma, continuation-prefix validation, or
the aggregated City prerequisite check. Passing continuation identity flags was
also apply-only, so that image could not produce the required pre-write proof.
No DEV plan, continuation, database mutation, City mutation, image load, or
cleanup was performed after discovering the mismatch.

The selected correction preserves plain `--plan` unchanged and adds an explicit
live read-only mode only when `--plan` receives all three predecessor identity
flags. The new path authorizes the report and environment, proves the exact
multi-phase lineage boundary, proves all later phases untouched, and aggregates
missing/ambiguous active Cities. Its Prisma surface exposes only City and
MigrationLineage reads; it does not construct adapters, executors, report
stores, or mutation delegates. This is tooling readiness only: the DEV
preflight has **not** passed and requires a newly committed and built image.

---

## DEV rehearsal critical path

- [x] Restore the agreed free-disk safety margin.
- [x] Run one fixed-image DEV `--plan`.
- [x] Verify exact DEV environment fingerprint and expected plan output.
- [x] Locate and verify the private frozen-content bundle.
- [x] Capture one pre-apply DEV DB/storage baseline.
- [x] Run one sequential DEV continuation `--apply`, stop-on-first-error —
      partial completion recorded in §J.
- [x] Perform the cumulative post-continuation audit for the partial state.
- [ ] Run one common DEV `--rerun`.
- [ ] Require `CREATE 0` and only expected `NOOP`/`SKIP_UNCHANGED` outcomes.
- [ ] Perform product smoke checks for representative migrated entities.
- [ ] Record anomalies in backlog without reopening clean scope.
- [ ] Founder DEV rehearsal acceptance.

There must not be per-record approval for clean canonical records.

---

## PROD cutover critical path

- [ ] Complete capacity audit for DEV + PROD + migration bundle + media +
      backups + rollback images.
- [ ] Increase hosting disk before cutover when the calculated safety reserve
      cannot be maintained.
- [ ] Freeze the exact release SHA, image ID, manifest and private bundle
      hash.
- [ ] Create and verify the production DB backup.
- [ ] Capture production DB/storage/container baseline.
- [ ] Run production `--plan`.
- [ ] Founder Go/No-Go.
- [ ] Run sequential production `--apply`.
- [ ] Perform cumulative audit.
- [ ] Run one production `--rerun`.
- [ ] Require `CREATE 0` and expected `NOOP`/`SKIP` results.
- [ ] Verify users, ownership, Places, Offers, Routes, Events and Articles.
- [ ] Verify redirects, canonical URLs, noindex/indexing configuration and
      DNS.
- [ ] Run product smoke/UAT.
- [ ] Begin post-launch monitoring.
- [ ] Retain rollback evidence for the defined retention window.

Clarifications:

- WordPress remains the read-only legacy source during validation/cutover;
- WordPress is currently hosted separately and should not be assumed to
  consume the DEV/PROD Docker-host disk;
- however, frozen source artifacts, media import, DB backups, old/new Docker
  images and rollback material require temporary additional capacity;
- exact hosting-capacity requirement must come from a dedicated read-only
  capacity audit — no unsupported storage number is hard-coded here.

---

## Launch readiness — three independent tracks

| Track | Owner | Status | Next action | Exit criterion |
| --- | --- | --- | --- | --- |
| 1. Migration readiness | Agent + founder sign-off | DEV rehearsal preparation (see critical path above) | Narrow DEV capacity housekeeping, then one fixed-image DEV `--plan` | DEV apply + rerun proof, founder DEV rehearsal acceptance |
| 2. Product/UAT readiness | Founder | PARTIAL — see appendix "Integrated RC (2026-07-29/30)" below | Mobile visual UAT and authenticated BUSINESS_OWNER end-to-end UAT evidence | Founder product acceptance, 0 confirmed P0 defects |
| 3. Production infrastructure/cutover readiness | Founder | NOT STARTED | Dedicated read-only hosting-capacity audit | Capacity, backup, DNS and rollback readiness confirmed |

- Completing the Phoenix migration alone does **not** automatically approve
  launch.
- Old product/UAT/SEO gates (§2, §5) remain valid where still unresolved.
- Historical RC text (below) is evidence for track 2, not the current
  Phoenix phase.
- Each track needs its own founder Go/No-Go; all three must close before
  production cutover.

---

## Appendix: Integrated RC (2026-07-29/30) — Product/UAT regression evidence

> Historical evidence for Launch readiness track 2 (Product/UAT readiness).
> Kept as proof, not as the current phase.

```text
Status:             PRODUCT REGRESSION TECHNICAL PASS
Technical baseline: CODE/BUILD/TYPECHECK PASS
RC branch:          codex/product-regression-rc-20260729
Exact tested SHA:   17c9dd29787bbab0462ca581c546ca83a5dc2e73
RC base:            release/integrated-rc@5edeaaac
Browser/runtime:    DESKTOP PASS; MOBILE VISUAL NOT TESTED
SEO closure:        LOCAL TECHNICAL PASS
UAT Pass 1:         PARTIAL — owner/mobile manual evidence remains
```

Known non-P0 defects retained:

- `ROUTE_RATINGS_PARAMS_NOT_AWAITED` — **OPEN P1**.
- `MISSING_FAVICON_ASSET` — **OPEN P2**.

Integrated-RC runtime findings to reconcile during SEO MIGRATION CLOSURE:

- Representative Event renders with no canonical.
- Representative Article/Place/Offer render one absolute slug-based canonical,
  but its stored origin remains `mamago.local:3000` rather than the exact RC
  runtime origin.
- Browser console recorded a client-side `MutationObserver` target `TypeError`.
- Media-backed representative pages produced local file 404s because the
  sibling RC worktree intentionally did not copy `storage/uploads`; no
  media/storage writes or copies were performed.
- Representative Route renders exactly one absolute slug canonical, hides the
  unusable map below two valid unique points, shows its empty state and has no
  horizontal overflow.

---

## 1. Неподвижные правила

1. Перед Prisma/auth/migration работой читать `CLAUDE.md` и профильные runbooks.
2. Запрещены `prisma migrate dev`, `prisma db push`, reset и destructive cleanup.
3. WordPress — строго read-only source. Production writes разрешаются только отдельным Go/No-Go.
4. Для каждой новой сущности: один environment gate, один SSH probe и один агрегированный immutable capture.
5. После source capture дальнейшие inventory/classification/planning выполняются локально.
6. Первый полный write-run каждой сущности — последовательный, `stop-on-first-error`, без автоматических retry, cleanup и rollback записанного prefix.
7. Snapshot, fixed manifest, canonical hashes и expected actions фиксируются до первого write.
8. Writes используют exact lineage/sourceRecordKey, CAS/conditional updates и fail-closed guards.
9. После batch обязателен cumulative DB/storage audit и один общий idempotency rerun.
10. Аномалии не исправляются внутри clean batch: они переносятся в documented backlog.
11. Media выполняются только по заранее подготовленному manifest и отдельному gate.
12. Один связный vertical slice → одна ветка → один Draft PR → один adversarial review → один fix batch → финальный CI/review cycle.
13. Production разрешён только после local golden, local batch, idempotency proof, rehearsal и Go/No-Go.
14. Raw immutable snapshots запрещено хранить только в `/tmp`. Source-of-truth хранится в приватном non-Git пути:

```text
/Users/shapovalovalexey/.mamago2/migration-snapshots/<entity>/
```

Permissions: `0700` для директорий, `0600` для файлов. Raw snapshots в Git не коммитятся.

15. Тесты не зависят от `/tmp` или приватных home-directory snapshots: только committed sanitized fixtures либо self-generated temporary fixtures.
16. Content-bearing entities (Article/Place/Event/Route/Offer) не могут быть полностью смигрированы из lightweight dependency-snapshot'ов — их SSH-based vertical slice (exact `--source-record-key`, один exact-key read) остаётся единственным источником `title`/`content`/postmeta/terms и разрешён без отдельного нового "snapshot capture" gate.

---

## 2. Текущий прогресс

| Трек | Статус | Что остаётся |
| --- | --- | --- |
| Migration engine | COMPLETE | Regression и production validation |
| Places | **LOCAL PUBLICATION COMPLETE** — 80/80 publishable lineage PUBLISHED (4 protected + 76 newly published); 2 CITY_BLOCKED remain PENDING; 1 non-lineage seed accounted separately | Disposition of 2 CITY_BLOCKED Places; production execution; integrated-RC revalidation |
| Offers | **SAFE-SCOPE LOCAL PUBLICATION COMPLETE 63/63** — moderation lifecycle used; media explicitly deferred P1 | Authenticated owner/admin UAT and CTA end-to-end; production execution; backlog H/I |
| Routes | **COMPLETE** — 14/14 lineage accounted for, 13/13 reviewed Routes PUBLISHED, 1 CITY_BLOCKED kept DRAFT; canonical and map-guard P0 fixes RESOLVED LOCAL | Integrated-RC revalidation; Mogilev onboarding backlog |
| Events | **COMPLETE** — 10/10 lineage accounted for, 8/8 publishable eligible PUBLISHED + 1 protected legacy PUBLISHED; final publication indexing race RESOLVED LOCAL | Integrated-RC revalidation; founder disposition for expired source 64159; Event images P1 |
| Users migration | **COMPLETE 578/578** — clean 564/564 + manual/privileged 14/14; all migrated users `PENDING_ACTIVATION`; role/ownership audit complete | Production activation delivery |
| Users activation | **LOCAL/REHEARSAL COMPLETE; PRODUCTION DELIVERY GATED** | Resend production secrets, verified sending domain, final manifest/checksum, canary, sequential batches, bounce/failure reconciliation and production proof |
| Business-linked Users | **FULLY CLOSED** | 38/38 ownership, 38/38 `BUSINESS_OWNER`, backlog 0 |
| Users manual/privileged | **COMPLETE 14/14** | 1 existing ADMIN unchanged, 13 `USER`, 1 `BUSINESS_OWNER` (user:129, exact 9-Place ownership); rerun 14×`SKIP_UNCHANGED`, 0 deltas |
| Activities | P0 CLOSED | 63 expired Events → `P1_HISTORICAL_EXPIRED_ACTIVITY` |
| Articles / authorship | **ARTICLES COMPLETE** — 2/2 target Articles, exact authorship, common rerun `ALREADY_SATISFIED`, public rendering verified | Integrated-RC revalidation only |
| User/Business profile media | NOT STARTED | P0/P1 decision, manifest, proof, production gate |
| Article media | **PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS** | Source 404 gaps documented; placeholders absent; do not reopen without regression evidence |
| Reviews | NOT STARTED | Реализовать либо явно defer в P1 |
| Redirects/pages/SEO | **LOCAL TECHNICAL COMPLETE** — see §5.7 | Legal/about/contact page audit; external baseline |
| SEO MIGRATION CLOSURE | **LOCAL TECHNICAL: PASS** — see §5.7 | External Search Console/Analytics/backlink baseline, founder SEO Go/No-Go, cutover runbook, monitoring plan. **Full launch Go/No-Go still requires these; local technical closure alone is not launch clearance.** |
| Product regressions | PARTIAL | Event discovery/404, Article city visibility, full smoke |
| Full product acceptance / UAT | **NOT STARTED** | Pass 1, defect cycle, Pass 2, founder acceptance |
| RC / production cutover | NOT STARTED | Freeze, backup, rehearsal, Go/No-Go, production migration, DNS |

---

## 3. Завершено и не должно повторяться

### 3.1 Migration foundation

- [x] `MigrationRun`, `MigrationRecord`, `MigrationLineage`.
- [x] Canonical hashes, unique lineage, idempotent classification.
- [x] Local/dev/prod profiles и production cutover runbook.
- [x] Sequential first-write safety, CAS/conditional updates, no auto cleanup.

### 3.2 Offers

- [x] Source inventory: 99 published records.
- [x] Canonical scope: 91; safe canonical scope: 63.
- [x] Full source → normalize → draft → validate → write → lineage flow.
- [x] Local import: 63/63.
- [x] Common rerun: `63 SKIP_UNCHANGED`.
- [x] Duplicate Offer/lineage и forbidden-table deltas: 0.

Deferred:

```text
class H: 28 — missing required Place relation
class I: 8 — noncanonical alias
Offer media: separate gate
production Offer execution: not started
Phoenix OfferDomainHashV2 transition: BLOCKED — 63/63 LOCAL targets have unsupported multi-field drift; see phoenix-offers-domain-hash-v2-audit-2026-07-31.json
```

### 3.3 Users identity and activation foundation

- [x] 579 source Users planned; legacy password hashes excluded.
- [x] Automatic ADMIN inheritance forbidden.
- [x] Pending-activation Prisma/auth foundation.
- [x] Hash-only activation token service.
- [x] Activation request/complete endpoints and security proofs.
- [x] Clean local scope: 564/564.
- [x] Common rerun: 564 `SKIP_UNCHANGED`.
- [x] Migrated Users remain `PENDING_ACTIVATION`, without password/session/token/provider writes.

### 3.4a Users manual/privileged — founder-final disposition, fully closed

Founder rule (final, overrides all prior manual/privileged dispositions that
excluded or deferred purely on legacy WordPress role): Administrator/
Editor/Author capabilities are never inherited; the only kept ADMIN is the
existing founder account; every other legacy user migrates as `USER` unless
a fresh, exact, proven Place ownership resolves `BUSINESS_OWNER`.

```text
kept unchanged:     wordpress-db:user:1 (existing ADMIN, no lineage, untouched)
                    wordpress-db:user:521, wordpress-db:user:91 (already USER/PENDING_ACTIVATION)
migrated:           14/14 — wordpress-db:user:{4,6,14,16,21,27,51,52,108,123,129,134,438,439}
new snapshot:       bounded, exact-key, read-only WP capture (14 users only) —
                    the original 579-user raw snapshot is lost (see §3.7);
                    fixed manifest: docs/migration/users-manual-privileged-14-manifest.json
role outcome:       13 × USER/PENDING_ACTIVATION; 1 × BUSINESS_OWNER (user:129)
ownership evidence: only user:129 had published `places` authorship (9 posts,
                    all exact, full lineage coverage) — reused the existing
                    Slice 7/9 golden mechanisms unmodified
                    (planBusinessOwnershipGolden/writeBusinessOwnershipGolden,
                    planRoleElevationGolden/writeRoleElevationGolden)
first run deltas:   User +14, Business +1, MigrationLineage +15, MigrationRecord +15,
                    ADMIN +0, Session +0, UserActionToken +0, Place row count +0
                    (existing Place rows re-owned, none created/deleted)
rerun:              14 × SKIP_UNCHANGED; ownership/role re-check: 0 deltas everywhere
```

- [x] No legacy WordPress role ever consulted for classification or exclusion.
- [x] `wordpress-db:user:1` left with zero lineage, zero writes — founder's
      existing ADMIN account untouched (personal email omitted from proof).
- [x] No password, session, token, or activation email ever written.
- [x] No content authorship touched in this slice.

### 3.4 Business-linked Users — fully closed

```text
Business ownership:       38/38 COMPLETE
BUSINESS_OWNER elevation: 38/38 COMPLETE
Business-linked backlog:  0
Excluded draft/unpublished Places: untouched
```

Slices 6–14 закрыли planning, golden/batch ownership, partial-coverage users 89/130 и role elevation.

### 3.5 Authorship and Activity decisions

- [x] Slice 15: 12 content-author users reconciled read-only.
- [x] Slice 16: standalone durable Activity snapshot and dependency inventory.
- [x] Все 63 authored Events у 9 пользователей имеют `post_status=expired`.
- [x] Product decision: не расширять launch P0 на historical expired Events.
- [x] Эти 63 Events и связанная authorship классифицированы как `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- [x] `user:521` остаётся manual existing-author conflict.
- [x] `user:91` остаётся partial-lineage backlog.

### 3.6 Slice 17 — published Articles user:575

PR #88 merged, merge SHA `7ce3c8cadc71ccbd166a82ef2190bc02609c9507`.

```text
wordpress-db:post:56250  publish  ARTICLE_TARGET_NOT_MIGRATED
wordpress-db:post:57731  publish  ARTICLE_TARGET_NOT_MIGRATED
User lineage user:575:   active
Article lineage:         absent for both
MigrationRecord history: absent for both
Decision:                ARTICLE_GOLDEN_REQUIRED
Golden candidate:        wordpress-db:post:56250
```

- [x] Count gate: ровно 2 published Articles.
- [x] Durable Activity snapshot и committed Slice 16 manifest совпали.
- [x] Read-only proof, DB/storage/media/author writes: 0.
- [x] 28 autonomous tests; targeted planning regression: 86/86.
- [x] Canonical manifest hash: `833e67d396300bd42d67a7218a0340770b7ff9544b68535d90e453c036710b8b`.

### 3.7 Документированный test debt

- [x] Три ранее snapshot-dependent test files переведены на autonomous fixtures.
- [x] Full migration suite sequential: 155 pass, 2 skipped, 0 fail на границе PR #87.
- [ ] Два `UserCleanBatch.test.ts` остаются explicit skip: требуют утерянный полный 579-user raw snapshot и production invariant hash.
- [ ] Не перезахватывать USERS snapshot только ради этих тестов.

### 3.8 Slice 18 — Article golden migration (post:56250)

```text
candidate:        wordpress-db:post:56250
source gap:       Slice 16 snapshot has no post_content/title/excerpt;
                  no JSON-fixture path exists for Article (only Place has one)
authorized fix:   one scoped, exact-key, read-only SSH fetch via the
                  already-existing fetchPublishedArticleEnvelopeBySourceRecordKey
                  (same mechanism every Article import already uses)
first run:        LINKED (CREATE) — Article +1 (24->25), ARTICLE lineage +1
                  (910->911), MigrationRecord +1, media writes: 0
rerun:            SKIPPED — byte-identical, 0 duplicate lineage,
                  MigrationRecord +1 (fresh bookkeeping row, not a re-CREATE)
written Article:  status PENDING, cityId null, geoScope null,
                  coverImageId null, authorUserId null
```

- [x] Preconditions verified: exact source key, `publish` status, active
      User lineage, no prior Article lineage/MigrationRecord, no slug
      collision.
- [x] Zero new code — reused `migration-commit-wordpress-db.ts --entity
      article` unchanged; `ArticleCommitContext.authorUserId` was
      available but deliberately left unset (authorship stays a
      separate, later-authorized step — Slice 20/21).
- [x] Full 12-table before/after audit: only `Article`/`MigrationLineage`/
      `MigrationRecord` moved; User/Session/UserActionToken/Business/
      Place/Offer/Route/Activity/MediaAsset unchanged.
- [x] Not publicly visible yet — no city/geo scope assigned (out of
      scope for this MVP writer, same as every other entity's first
      golden write).

### 3.9 Users production activation readiness (email delivery)

No production email sent. Reused 100% of the existing foundation (request/
complete endpoints, hash-only `UserActionToken`, pending-activation
lifecycle, rate limiting, `activationEmailGate.ts`'s env gate) — no second
activation flow.

```text
provider:          Resend, via existing emailService — new adapter is
                   src/server/auth/activationEmailDelivery.ts
                   (deliverMigratedAccountActivationEmail), wired into
                   POST /api/auth/activation/request (previously discarded
                   both the issued raw token and the gate result)
gate:              resolveActivationEmailDelivery() — renamed its
                   always-returned "PROVIDER_UNAVAILABLE" placeholder to
                   "DELIVERY_ALLOWED" now that a provider exists; requires
                   NODE_ENV=production AND APP_ENV=production AND
                   MIGRATED_USER_ACTIVATION_EMAIL_ENABLED=true AND
                   MIGRATED_USER_ACTIVATION_EMAIL_PRODUCTION_APPROVED=true
kill switch:       either flag back to false, effective next request
manifest:          578/578 eligible, 0 exclusions, hash
                   56c0a18295d8aacf155bfb98182cd26cf1f8064c868e9d578e743627623a49a1
                   (docs/migration/users-production-activation-manifest.json)
rehearsal:         fake/sandbox transport + injected gate-environment —
                   proved LOCAL/DEV hard-disable (incl. against this shell's
                   real env), production-approved send path, token secrecy,
                   one-time-use, expiry, invalid token, already-activated
                   rejection, rate limiting, ADMIN/roles untouched; 0 real
                   sends, 0 DB residue after cleanup
tests:             existing userActionToken.service.integration.test.ts +
                   activationEndpoints.integration.test.ts re-run unchanged
                   (both pass; one string literal updated for the gate
                   rename); new activationEmailDelivery.rehearsal.test.ts
tsc --noEmit:      clean
```

- [x] No password/session/token/provider write in this pass.
- [x] `ADMIN` count and every migrated User's role confirmed unchanged.

### 3.9a Migrated-user login detection, `/activate` page, delivery audit — product-complete

Closed all three remaining product blockers from §3.9. No commit/push.

```text
login detection:   src/app/api/auth/login/route.ts — after the existing
                   constant-time verifyLoginPassword() call (never skipped,
                   preserves timing safety: a PENDING_ACTIVATION account
                   costs exactly as much time as wrong-password/unknown-
                   email), a PENDING_ACTIVATION account with isValid=false
                   triggers requestMigratedAccountActivationByEmail(source:
                   LOGIN_FLOW) and returns 200 {pendingActivation:true,
                   message} instead of the generic 401. Zero visual/field/
                   button changes — both call sites (useAuthCredentialsFlow,
                   CompactSaveAuthPanel) reuse the existing error-message
                   slot for the neutral text. No manifest scan, no WP call —
                   only the already-fetched User.status.
shared flow:       src/server/auth/activationRequestFlow.ts
                   (requestMigratedAccountActivationByEmail) — extracted so
                   /api/auth/activation/request and the login branch share
                   one rate-limited lookup+issue+deliver+audit path; token
                   issuance always happens regardless of delivery-gate
                   state (fixed a bug caught by re-running the existing
                   token-count assertion: an early version skipped issuance
                   entirely in LOCAL/DEV).
/activate page:    src/app/(auth)/activate/ — reads token from the URL into
                   local state once (never re-read, never logged), calls a
                   new read-only POST /api/auth/activation/status (hash
                   lookup only, never consumes the token) to resolve
                   VALID/EXPIRED/USED/INVALID/ALREADY_ACTIVE before showing
                   the password form, then calls the existing POST
                   /api/auth/activation/complete unchanged. States: loading,
                   blocked (4 variants with distinct copy), form, success
                   (offers login, does not auto-sign-in). Added "activate"
                   to KNOWN_ROOT_SEGMENTS (wpLegacyCatchAll routing) — the
                   page 404'd via the WP-legacy catch-all redirect until
                   this was added; wpLegacyCatchAll.test.ts still passes.
                   Name/terms-consent step skipped: no backend field exists
                   for either, and normal registration doesn't collect them
                   either — same static terms/privacy notice as AuthForm's
                   register mode.
delivery audit:    ActivationDeliveryAudit model + manual migration
                   20260728090000_add_activation_delivery_audit — userId,
                   sourceRecordKey (MigrationLineage lookup, best-effort),
                   provider, recipientMask, template, requestedAt/
                   attemptedAt/sentAt, providerMessageId, status
                   (BLOCKED_ENVIRONMENT/BLOCKED_KILL_SWITCH/QUEUED/SENT/
                   FAILED), errorCode, activationTokenId (FK to
                   UserActionToken — hash reference, never the raw token),
                   source (LOGIN_FLOW/MANUAL_REQUEST/PRODUCTION_BATCH). No
                   raw token, no activation URL, no email body, no provider
                   secret ever stored. Cascade-deletes with the User/token.
tests:             new activationActivatePage.integration.test.ts (status +
                   complete over real HTTP handlers: valid->complete->used,
                   already-active, expired) and login/
                   pendingActivation.integration.test.ts (PENDING_ACTIVATION
                   branch, ACTIVE unaffected, wrong-password/unknown-email
                   still identical generic 401); all pre-existing activation
                   tests re-run unchanged and pass.
verification:      real organic traffic on the shared local dev server
                   (not my own test) exercised the login branch for two
                   real migrated accounts and produced correctly-shaped
                   BLOCKED_ENVIRONMENT audit rows (masked recipient, no raw
                   token) — left untouched, not test residue.
tsc --noEmit / git diff --check: clean.
```

- [x] Migrated-user login detection COMPLETE.
- [x] `/activate` frontend COMPLETE.
- [x] Delivery audit persistence COMPLETE.
- [x] End-to-end activation flow rehearsal COMPLETE (no real email sent).
- [ ] Production bulk delivery остаётся gated финальным Go/No-Go (только
      RC SHA freeze, backup, canary, provider bounce-webhook wiring и
      явное решение founder — см. delivery plan §4).

---

## 4. Текущий Articles/authorship critical path

Slice 18 закрыт: `wordpress-db:post:56250` смигрирован (см. §3.8).

### Slice 19 — второй Article + общий rerun + authorship reconciliation

Только:

```text
wordpress-db:post:57731
```

Выполнено:

```text
first run: LINKED / CREATE
Article: +1 (25->26)
ARTICLE MigrationLineage: +1 (911->912)
MigrationRecord: +1, затем +2 на общий rerun
media importer calls / MediaAsset / storage writes: 0
rerun: post:56250 SKIPPED; post:57731 SKIPPED; rows byte-identical
authorship reconciliation: 2 × EXACT_AUTHORSHIP_CANDIDATE; writes 0
```

Источник: тот же один scoped exact-key read-only SSH fetch (Rule 16) —
не новый snapshot capture, не broad discovery.

Запрещено в Slice 19:

- выполнять отдельный authorship write;
- импортировать media;
- трогать expired Activities, user:521 или user:91.

### После Slice 19

```text
Next slice: targeted authorship assignment for user:575 across both Articles,
            sequential first write + common rerun -> SKIP_UNCHANGED
```

---

## 5. Обязательный P0 остаток до запуска

### 5.1 Articles и content authorship

- [x] Slice 18: golden Article `wordpress-db:post:56250` + rerun.
- [x] Slice 19: второй published Article `wordpress-db:post:57731` + общий rerun 2/2 + read-only authorship reconciliation.
- [x] Read-only authorship reconciliation user:575 объединён со Slice 19: 2 exact candidates.
- [x] Slice 20: exact CAS authorship write для обеих Article + общий rerun `ALREADY_SATISFIED` 2/2.
- [ ] `user:521` — founder/manual conflict decision либо явный P1 defer.
- [ ] `user:91` — lineage review либо явный P1 defer.

### 5.2 Users production и activation

- [x] Manual/privileged Users dispositions — founder decisions COMPLETE (см. §3.4a):
  - 1 existing ADMIN (`user:1`) unchanged;
  - 14/14 остальных migrated: 13 `USER`, 1 `BUSINESS_OWNER` (`user:129`, exact ownership);
  - `user:521`/`user:91` остаются USER/PENDING_ACTIVATION без изменений (P1 defer, см. §5.1).
- [x] Production email provider integration COMPLETE — см. §3.9.
- [x] LOCAL/DEV delivery hard-disable VERIFIED (re-checked against real shell env + rehearsal).
- [x] Activation manifest PREPARED — 578/578 eligible, hash `56c0a18...49a1`.
- [x] Production-like rehearsal COMPLETE — fake/sandbox transport, 0 real sends, 0 DB residue.
- [x] Controlled delivery plan READY — [users-production-activation-delivery-plan.md](users-production-activation-delivery-plan.md).
- [x] Migrated-user login detection, `/activate` frontend, delivery audit persistence — все COMPLETE (см. §3.9a). Оба прежних блокера закрыты.
- [ ] Реальная production delivery остаётся gated финальным Go/No-Go — оставшиеся пункты: RC SHA freeze, production backup, canary batch, provider bounce/failure webhook (см. delivery plan §1/§4).
- [ ] Решить P0/P1 для User/Business avatars и logos.

### 5.3 Events — COMPLETE: 10/10 lineage records accounted for, 8/8 publishable eligible PUBLISHED

The prior "4/9 imported, 5 CREATE remaining, 67 pending sessions" snapshot was
stale: an earlier, never-merged session (`docs/event-migration-mvp-complete`,
2026-07-21, never merged to `dev`) had already CREATE'd all 9 eligible Events
plus canonicalized their lineage hash to v2 (PR #64/#65, both on `dev`) — the
checklist just never reflected it. All 9 eligible + the 1 legacy/protected
(`wordpress-db:events:55980`) already had `Activity` rows with active
lineage. There was **no remaining CREATE work** — confirmed twice, by direct
DB read and again structurally: the new resync tool below refuses to CREATE
under any circumstance (`BLOCKED_LINEAGE_MISSING`, no write, if lineage is
ever absent).

**Session 1 (initial audit + partial publish):** read-only audit
(`migration:preview:wordpress-db --entity event`, exact-key + full scan)
classified all 9: `VALID_FUTURE` no-drift (56226, 56062, 64505), 5 events
with materialized sessions gone stale since their 07-19/20 creation
(56479, 60404, 62977, 63510, 64251), 1 fully expired at the source
(64159 — WP post no longer published at all), plus one brand-new,
already-past-only discovery (49842, auto `SKIP_POLICY`, no action). Trying
to fix the drift via the ordinary `migration-commit-wordpress-db.ts` UPDATE
path worked for 2 of the 5 (56479, 60404 — their lineage hash was still
pre-canonical-v2, so a real UPDATE ran) but exposed two real defects in
`EventCommitWriter` for the other 3 (already on canonical v2 hash →
`SKIP_UNCHANGED`, so no rebuild happened at all) and, worse, actively
regressed two already-published Events when used to "verify idempotency."

**Two regressions found, root-caused, and fixed in code this session**
(`src/lib/migration/commit/event/EventCommitWriter.ts`):
1. **cityId clobber** — `buildEventCreateDraft()` is a pure function with no
   knowledge of any existing row; `context.cityId` absent/unmatched always
   produces `draft.cityId: null`. `updateEventFromDraft()` wrote that `null`
   to `Activity.cityId`/`EventVenue.cityId` unconditionally, with no
   preserve-existing-if-unresolved guard (unlike `EventVenue`'s own
   never-clear-on-no-evidence rule for every *other* field). This nulled
   `wordpress-db:events:60404`'s city mid-session.
2. **status reset** — `EventCreateDraft.status` is hardcoded `"PENDING"`
   (the CREATE-only default); `updateEventFromDraft()` wrote it
   unconditionally on every UPDATE too, silently reverting any
   already-`PUBLISHED` Event back to `PENDING` the moment its content hash
   ever changes (or, as happened here, the first time it's ever actually
   re-committed). Unpublished `56226`/`56062`.

**Fix**: `updateEventFromDraft()` now never sends a `status` key at all
(lifecycle is exclusively an approval-flow concern, never a migration-UPDATE
concern), and only sends `cityId` when the draft has a proven non-null
value — absence of city evidence no longer overwrites a city already on the
row, on both `Activity` and `EventVenue`. 8 new regression tests
(`EventCommitWriter.test.ts`) cover both directions (preserve-on-null,
still-applies-when-proven) for both fields, plus confirm CREATE is
unaffected. Both incidents were also corrected in the live DB before the
fix landed (scoped, precondition-checked, transactional).

**New capability**: `scripts/migration-event-sessions-resync.ts`
(`pnpm migration:events:sessions-resync`) — the actual gap that caused the
3 SKIP_UNCHANGED events to get stuck. A canonical content hash correctly
proves "the WordPress post is unchanged"; it says nothing about whether a
multi-date schedule's *materialized* `ActivitySession` rows still match
what today's date would produce from that same unchanged content (past
sessions get pruned as calendar days pass, independent of any content
edit). This tool computes a second, independent, deterministic fingerprint
(`computeEventScheduleResyncPlan.ts`, reusing the existing
`eventSessionScheduleFingerprint`/`eventSessionFingerprintFromStoredSessions`
helpers) and — only when it detects real drift — rewrites *exclusively*
`ActivitySession` rows and `Activity.nextOccurrenceAt` inside one
transaction per Event (`EventScheduleResyncWriter.ts`), through a Prisma
client type with no `status`/`cityId`/`slug`/`title`/`ownerUserId`/venue/
media/lineage delegates reachable at all — structurally, not just by
convention. Never CREATEs (`BLOCKED_LINEAGE_MISSING`/`_AMBIGUOUS` if
lineage isn't exactly one active row); never touches an unpublishable
source (`BLOCKED_EXPIRED_SOURCE` if the WP post is gone or fully
past-dated). `--preview`/`--commit`, exact `--source-record-key` only, no
mass scan mode. Every commit re-reads and asserts protected fields
byte-identical before and after, and re-verifies the post-write fingerprint
matches the desired one — either failure aborts the batch (stop-on-first-
error) rather than silently continuing. 17 tests across 3 files (pure plan
logic, writer, CLI arg parsing).

**Session 2 (close-out, same day)**: ran the new resync tool against the 3
stuck keys — all `RESYNC` (62977: 29→23 sessions, 63510: 35→27, 64251:
34→25, all now spanning today→their real end date), all protected fields
verified byte-identical before/after, all fingerprints verified matching
post-write. Published all 3 via the unchanged `scripts/approve-event.ts`
lifecycle path. Re-ran the resync tool in `--preview` against all 8 eligible
+ published keys (the 3 just-fixed plus the 5 from session 1): **8/8
`NOOP_ALREADY_SYNCED`, 0 writes** — proves both the fix and the new tool's
own idempotency, through the tool that's actually safe to use for this
(never resets status/city, unlike the old commit CLI).

**Final accounting (2026-07-28, local `mamago2`, direct DB read — do not
recompute from earlier session logs)** — this replaces every prior "X/Y
published" framing in this section, which conflated *eligible* with
*publishable* and made an intentionally-excluded expired source look like
unfinished work:

```text
Total Event MigrationLineage records (targetType=ACTIVITY, active):  10
Total ActivitySession rows across those 10 Activities:              109
Duplicate sourceRecordKey / Activity linkage / slug / session rows:  0 / 0 / 0 / 0
Orphan ActivitySession rows (no matching Activity):                 0

Protected legacy (wordpress-db:events:55980):     1 — PUBLISHED (untouched, out of scope)
Eligible migrated Events (the 9 from the WP tail): 9/9 accounted for
  Future-valid, publishable:                       8/8 — all PUBLISHED
  Expired source (wordpress-db:events:64159):       1 — retained PENDING, excluded from publication

Events migration is considered complete: all 8 future-valid eligible
Events are published; the expired source (64159) is a deliberate
exclusion, not an unfinished CREATE or a blocked publish.
```

Classification table (all 10 lineage records):

| sourceRecordKey | Activity id | classification | status | sessions | nextOccurrenceAt | city | public URL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `...:55980` | `cmrb48y2q...` | PROTECTED_LEGACY_PUBLISHED | PUBLISHED | 1 | 2026-07-12 | Минск | `/minsk/events/interaktivnyy-kvest-mir-naoschup` |
| `...:56226` | `cmrs53a6u...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-08-01 | Минск | `/minsk/events/igra-zvuki-temnoty` |
| `...:56479` | `cmrsdnl2d...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-08-09 | Минск | `/minsk/events/semeynyy-kvest-priklyucheniya-v-hogvartse` |
| `...:60404` | `cmrsduuwv...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 28 | 2026-07-29 | Минск | `/minsk/events/letnyaya-aktivnaya-razvlekatelnaya-zagorodnaya-programma-2026-aktiv-polis-na-baze-sanatoriya` |
| `...:56062` | `cmrt4fhmq...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-08-06 | Минск | `/minsk/events/psihologicheskiy-trening-aromamagiya` |
| `...:64505` | `cmrt4ibs5...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 1 | 2026-09-12 | Минск | `/minsk/events/s-kibirova-balet-tri-porosenka` |
| `...:62977` | `cmrt4k8ec...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 23 | 2026-07-29 | Минск | `/minsk/events/letniy-gorodskoy-otdyh-v-minske-dlya-detey-6-13-let` |
| `...:63510` | `cmrt4ltsz...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 27 | 2026-07-29 | Минск | `/minsk/events/immersivnaya-vystavka-neboreka-planeta-posle-shuma` |
| `...:64251` | `cmrrljj8c...` | FUTURE_VALID_PUBLISHED | PUBLISHED | 25 | 2026-07-29 | Минск | `/minsk/events/letniy-klub-dlya-detey-na-angliyskom` |
| `...:64159` | `cmrt4gvoz...` | EXPIRED_SOURCE_PENDING | PENDING | 1 (stale, 07-25) | — | Минск | none (no slug, not public — reconfirmed live: WP source still returns no published post) |

`PROTECTED_LEGACY_PUBLISHED: 1`, `FUTURE_VALID_PUBLISHED: 8`,
`EXPIRED_SOURCE_PENDING: 1` — matches the expected split exactly, no
discrepancy found.

All 5 originally-published + 3 resynced-then-published + the 1 legacy URL
(9 total) verified live: correct title/city/date, appear in
`/minsk/events` discovery, 0 console errors, mobile smoke clean. 0
`MediaAsset`/`MigrationMediaAsset` writes across any session.

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` — this live smoke ran
against the already-running main-repo dev server, not this worktree's own
(documented above as a deliberate workaround for a Next dev port/lock
conflict at the time). A later session (2026-07-29, Places/Offers) found
that the shared `dev` preview tooling always launches from the main repo
checkout regardless of the active worktree — meaning this smoke verified
DB/content rendering correctly, but not necessarily against this worktree's
exact code (no code changes were needed for the public Event pages
themselves, so risk is low, but not zero). Not re-verified now — data/
migration closure is not reopened; revalidate on the integrated RC worktree
instead (see §11/next-action).

Backlog — the only remaining non-published record:

```text
64159  EXPIRED_SOURCE_PENDING — WP post no longer published
       (post_type=events, post_status=publish returns nothing, reconfirmed
       live via the resync tool's --preview). DB's own materialized
       session was already past (2026-07-25) anyway. Left PENDING, not
       counted against "publishable" — this is a deliberate exclusion,
       not unfinished CREATE work. Founder decision still open:
       hard-exclude permanently vs. leave PENDING indefinitely — not a
       blocker for Routes or anything else.
```

**Known defect — backlogged, not fixed in this slice (found during
publication, unrelated to the Event UPDATE/resync code above):**

```text
EVENT_SEARCH_INDEX_PUBLICATION_RACE

Severity: P0 (reproduced twice under ordinary use; produces a genuinely
incorrect, non-canonical public-facing URL — see reproduction below).

Root cause: publishing an Event performs two separate Activity.update()
calls in sequence — approve-event.ts's own status:PUBLISHED update, then
a second update (slug + slugUpdatedAt) inside
assignActivitySlugIfMissing()'s own transaction, called via
ensurePublishedActivityHasSlug(). Prisma's search-indexing extension
(extendPrismaWithSearchIndexing, wired in src/lib/prisma.ts) fires an
independent, unawaited SearchIndexerService.upsertActivity(id) after
*every* Activity.update() call ("fire-and-forget", src/lib/search/
prismaSearchExtension.ts). Each dispatch independently re-reads the
Activity fresh (buildActivityDocument) and upserts SearchDocument — there
is no ordering or deduplication between the two dispatches from the same
publish. Whichever of the two async chains' upsert reaches the DB last
wins, regardless of which one has the complete (post-slug-assignment)
state. buildActivityDocument falls back to the raw Activity id for
urlPath when slug is still null at read time (publicActivityPath()), so
the losing race leaves SearchDocument.urlPath as
"/minsk/events/{activityId}" instead of the canonical slug path.

Reproduction (real, not synthetic): observed on 2/9 Events published this
session (wordpress-db:events:62977 and :56479, from two different
approve-event.ts invocations in two different sessions) — i.e. roughly
1-in-4-5 publishes hit it in practice. Both were repaired with a manual
`new SearchIndexerService(prisma).upsertActivity(id)` re-index (data
repair only, no code change) and reconfirmed correct; all 9 published
Events' SearchDocument.urlPath now match their canonical slug path
exactly (verified 2026-07-28).

User impact: the affected page itself does NOT 404 — [city]/events/
[slugOrId]/page.tsx's dynamic route accepts either the slug or the raw id
(confirmed: /minsk/events/cmrt4k8ec0006wswzelvt2e5d returned 200 OK with
the correct event rendered) — so this is a site-search/SEO/canonical-URL
correctness defect, not a hard broken-link defect. Classified P0 anyway
per the "reproducible + incorrect URL" bar, since it was empirically hit
twice under completely ordinary publish actions, not contrived.

Fix (not implemented here — out of scope for the Events migration slice,
touches shared search-indexing infrastructure used by Places/Articles/
Offers/Routes too, not just Events): a single deterministic reindex call
after the full publish lifecycle transaction completes, replacing the two
independent fire-and-forget dispatches — or an ordering/deduplication
queue in the indexer itself. Needs its own scoped review before any
implementation.
```

- [x] Exact Docker/CI environment gate — LOCAL, `mamago2`, this worktree.
- [x] Read-only audit of all 9 eligible + 1 legacy Event.
- [x] Sequential targeted commits/resyncs, stop-on-first-error (none hit).
- [x] Session/cumulative delta validation, duplicate check, media-write check, orphan-session check.
- [x] City/date discovery и отсутствие 404 — all 9 published URLs verified.
- [x] Event UPDATE lifecycle/cityId regressions fixed in code + regression-tested.
- [x] Event schedule resync capability built, tested, used to close all 3 stuck records.
- [x] Common resync-tool rerun — 8/8 `NOOP_ALREADY_SYNCED`, 0 writes.
- [x] Search-index race root-caused, reproduced, documented as P0 backlog, current data repaired.
- [ ] Decide 64159's fate (source gone — hard-exclude vs. leave pending indefinitely).
- [ ] `EVENT_SEARCH_INDEX_PUBLICATION_RACE` fix — separate scoped slice, touches shared search infra.

Event images остаются вне frozen P0 scope.

### 5.4 Routes — COMPLETE: 14/14 lineage accounted for, 13/13 reviewed Routes PUBLISHED

```text
worktree:                  mamago2-routes-review, branch feat/routes-review-publication
base:                      feat/events-tail-import @ 525aedec (contains all 3 Events tail commits)
aggregate read-only audit: 14/14 active ROUTE lineage records, 14/14 Route rows exist
                           (buildRouteEditorialReview, already-existing tooling from
                           commit 2e0df3b6, first run 2026-07-13, rerun live 2026-07-28)
classification:            13 x READY (after editorial review, see below), 1 x CITY_BLOCKED
                           (Mogilev, wordpress-db:routes:46963 — found already
                           status=PUBLISHED/visibility=PUBLIC/cityId=null in shared local
                           DB, pre-existing anomaly from outside this session, not created
                           by this slice)
```

Editorial copy review (13 routes, 86 RouteStop notes, one aggregated pass):

```text
method:              every stop's source note read in full and compared against the
                      existing auto-shortener's proposal (proposeShortRouteStopNote,
                      >300 chars -> first 1-3 sentences)
finding:              the auto-shortener systematically drops the practical tail of
                      almost every stop (contact phone, address, price, opening hours,
                      coordinates, safety warnings) because that content sits after the
                      narrative lead-in — unusable as-is under the "never change
                      prices/hours/addresses/age limits/warnings" rule
classification:       ACCEPT_SHORT 2, KEEP_FULL 84, EDIT_SHORT 0, BLOCKED 0
mojibake fixes:       12 RouteStop rows (11 distinct single-byte corruptions, one route
                      had 2 separate corrupted stops) — e.g. "сре��а" -> "среда",
                      "Брас��авский" -> "Браславский"; unambiguous from Russian
                      grammar/context, restores meaning, invents no new fact
final write scope:    ONLY the 12 mojibake-affected RouteStop.note rows written
                      (byte-identical exact-substring replacement); the other 74 stops
                      left byte-identical in DB — no whitespace/paragraph normalization
                      applied to avoid unrelated writes (narrowed from an earlier,
                      broader 86-row whitespace-cleanup proposal after review)
manifests:            docs/migration/reviews/route-review-2026-07-28.md/.json (live audit),
                      docs/migration/reviews/route-apply-plan-2026-07-28.json (applied plan),
                      docs/migration/reviews/route-note-diff-manifest-2026-07-28.json
                      (per-stop before/after hash + NOOP/UPDATE action for all 86 stops)
```

Publication (existing reviewed tooling, `scripts/migration-apply-route-review.ts` /
`applyRouteReviewPlan`, guarded per-route transaction, stop-on-first-error):

```text
dry run:              13/13 DRY_RUN, 0 SKIPPED/FAILED
apply:                13/13 APPLIED — Route.status DRAFT->PUBLISHED,
                      Route.visibility PRIVATE->PUBLIC, authorId remains null (unchanged)
                      + the 12 mojibake RouteStop.note updates in the same transaction
seo canonical sync:   syncRouteCanonical() (existing exported helper, same one the real
                      admin publish endpoint calls) run for all 13 — 13/13 UPDATE
                      (null -> /routes/<slug> canonical), search index upserted
                      synchronously and confirmed isPublished:true per route
idempotency rerun:    re-running the identical apply plan -> 13/13 SKIPPED
                      (ROUTE_STATUS_CHANGED:PUBLISHED), 0 writes — deterministic
```

Mogilev (`wordpress-db:routes:46963`) — CITY_BLOCKED, kept out of public state:

```text
found:                already status=PUBLISHED/visibility=PUBLIC/cityId=null in the
                      shared local DB before this session touched anything
city check:           read-only exact lookup confirmed no City "Могилёв" exists
                      (only Минск, Марьина Горка, and 3 inactive villages) — no City
                      created, no cityId assigned, per explicit decision not to expand
                      geography inside this Routes slice
action:               UNPUBLISH_TO_NON_PUBLIC_STATE via a bounded script that reuses
                      the exact same operations as the existing admin lifecycle
                      endpoint (PATCH /api/admin/routes/[id] { publish:false }):
                      prisma.route.update({ data: { status: DRAFT } }) — visibility
                      untouched, matching that endpoint's own behavior — plus
                      syncRouteCanonical(); guarded by an explicit before-state assert
                      (PUBLISHED/PUBLIC/cityId null/authorId null) that aborts on
                      mismatch
preserved:            content, all 4 RouteStops, media, slug (marshrut-mogilev),
                      authorId (null), MigrationLineage — all byte/value-identical
                      before/after (asserted programmatically)
verified:              status=DRAFT, visibility unchanged=PUBLIC (status alone gates
                      public visibility — listPublicRoutes/listPublicRoutesByCity/
                      getRouteBySlug's page-level canViewRoute() all require
                      status===PUBLISHED AND visibility===PUBLIC), SearchDocument
                      isPublished:false, absent from listPublicRoutesByCity(Минск),
                      public page canViewRoute() returns false for anonymous users on
                      a non-PUBLISHED route -> notFound() (404)
backlog:              Mogilev City onboarding — City creation/configuration, slug,
                      country, discovery, SEO, sitemap, redirects, public smoke —
                      requires a separate founder-approved geography-expansion
                      decision; this Route is not a failed/incomplete CREATE, it is
                      imported and lineage-accounted-for, only excluded from
                      publication
```

Cumulative audit (post-batch):

```text
active ROUTE lineage:       14 (unchanged)
duplicate sourceRecordKey:  0
duplicate lineage targetId: 0
Route rows total:           14 (unchanged, 0 CREATE, 0 DELETE)
published/public:           13
draft:                      1 (Mogilev)
duplicate city+slug pairs:  0
non-null authorId:          0 (all editorial, ownership untouched)
RouteStop rows total:       90 (unchanged, 0 CREATE, 0 DELETE)
orphan RouteStops:          0 (routeId is a required FK — structurally impossible)
RouteSlugHistory rows:      0 (unchanged — no slug was touched)
```

Public validation — service layer AND live browser smoke, both done:

```text
service layer:               listPublicRoutesByCity -> exactly the 13 published
                            routes, Mogilev absent; canViewRoute -> anonymous users
                            get notFound() for any status!==PUBLISHED route
live browser smoke:          done against the already-running main-repo dev server
                            (localhost:3000, same shared local DB) — this worktree's
                            own server couldn't bind (Next dev lock shared with main
                            repo dir), so the running instance was reused read-only
  13 public URLs:             all -> HTTP 200 (curl-verified)
  Mogilev URL:                 HTTP 404, real Next 404 page content confirmed
                              (not a soft-404)
  discovery listing (/routes): exactly 13 cards, titles correct, stop counts sum to
                              86 (matches DB), Mogilev absent
  stop order/content:          verified on 2 routes (6-stop "Дрозды", 9-stop
                              "Новогодний") — order, titles, note text render
                              correctly and in sequence
  console/hydration errors:    0 across all pages checked (detail x2, listing,
                              Mogilev 404)
  mobile viewport (375x812):   renders correctly, no layout breakage
  desktop viewport:            renders correctly
  images:                      no broken images — expected, since 0/90 RouteStops
                              have photoUrl (pre-existing media policy, unchanged)
  robots meta:                 "noindex, nofollow" on every page — confirmed this is
                              the existing site-wide src/lib/seo/globalNoindex.ts
                              dev/local switch (see checklist §5.9 "noindex switch"),
                              not Route-specific, not caused by this session
```

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` — same caveat as Events
above: this smoke ran against the already-running main-repo dev server, not
this worktree's own (the tooling-level reason was only identified later, in
the 2026-07-29 Places/Offers session). No Route code changes were made this
session (100% existing tooling reused), so risk is low, but the smoke itself
was not proven to run against this exact worktree's checkout. Not reopened
now; revalidate on the integrated RC worktree.

Two genuine gaps found during smoke — pre-existing, not introduced by this session
(this session never touched `lat`/`lng`/`address`/`seoCanonicalUrl`-consumption code),
recorded as backlog, do not block the COMPLETE status below:

```text
1. Canonical <link> missing in HTML: RouteDetailPage's generateMetadata() never reads
   Route.seoCanonicalUrl (the field syncRouteCanonical() correctly computed and wrote
   for all 13+Mogilev) — only city/event listing pages set `alternates.canonical`.
   Route detail pages have emitted no canonical tag since this code was written,
   before this session. Backlog: add `alternates: { canonical: db.seoCanonicalUrl }`
   to RouteDetailPage generateMetadata.
2. Map polyline is meaningless on every Route page: 0/90 RouteStops (all 13
   published + Mogilev) have lat/lng/address populated, despite source notes
   containing embedded "Координаты: ..." text — coordinates were never parsed into
   RouteStop columns during the original WordPress import (pre-existing migration
   gap, this session only touched the `note` field). The map widget falls back to
   drawing a nonsensical line across the country. Backlog: RouteStop geo-enrichment
   from source coordinates, separate migration slice.
```

- [x] Ручной review 14/14 (13 editorial + 1 CITY_BLOCKED classification).
- [x] Stops, descriptions review; RouteStop images intentionally not imported (media
      policy METADATA-skip, pre-existing decision, INFO-level warning only, not a
      blocker); city mappings verified for 13/13 published (Минск, evidence-based).
- [x] Publish approved Routes — 13/13 PUBLISHED/PUBLIC.
- [ ] Slug history и redirect map — no slug changes occurred (0 RouteSlugHistory rows,
      expected); legacy WordPress URL -> new slug redirect mapping for these 14 Routes
      not separately re-verified against the 893-row WP redirect manifest this session.
- [x] Public URL validation — verified at both the service/access-control layer AND
      live browser smoke (13/13 URLs 200, Mogilev 404, discovery correct, 0 console
      errors, mobile+desktop render clean). Two pre-existing, non-blocking gaps found
      and backlogged (canonical `<link>`, RouteStop coordinates) — see §6.

### 5.5 Places, Offers, Articles и media

**Places — 2026-07-28 (two sessions), worktree `mamago2-places-offers-closure`, branch
`feat/places-offers-production-media-closure`, base `feat/routes-review-publication`@`657c6c59`.**
Full detail: `docs/migration/reviews/place-*-2026-07-28.{md,json}`, corrected/exact matrix:
`docs/migration/reviews/place-status-classification-matrix-2026-07-28.{md,json}`.

```text
PLACES:
DATA AND MIGRATION CLOSURE COMPLETE

82/82 lineage records accounted for
1 non-migration seed accounted for separately ("Невидимый мир", no lineage — out of migration scope)
0 unexpected CREATE/DELETE
0 duplicate lineage/source keys/slugs
0 orphan media links
1 writer regression found + fixed + tested (see below)

PUBLICATION:
NOT COMPLETE — exact editorial/lifecycle scope remains

Published:                                    5   (4 lineage + 1 non-migration seed)
Ready for editorial publication review:      76   (READY_NOOP + PENDING — content matches source
                                                    exactly, but SKIP_UNCHANGED proves content
                                                    parity, not publication readiness; no bulk
                                                    review/publish tool exists for Place yet)
Manual-content review required:               0   (the 4 UPDATE_CONFLICT places are already
                                                    PUBLISHED and were browser-verified valid this
                                                    session — see matrix doc for the distinction)
City blocked:                                  2   (no cityId, and the source itself has none either
                                                    — not drift, a real content gap; excluded from
                                                    any bulk-publish candidate universe)
Source unpublished/excluded:                   0

MEDIA:
PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS — existing sampled-media policy (3 hand-picked Place keys
get FULL in LOCAL/DEV, proven working end-to-end: real download/dedup/storage/link); the other 79
get METADATA_ONLY by the same pre-existing, deliberate policy, not expanded this session — see
place-media-manifest-2026-07-28.md for the founder-decision framing.

PUBLIC RUNTIME VALIDATION:
PASS for all 5 currently-PUBLISHED Places (200 OK, correct content/city/media/hours/reviews, 0
console errors, desktop+mobile clean, a PENDING place correctly 404s) — but NEW P0 found:
PLACE_CANONICAL_METADATA_MISSING. `generateMetadata()` never reads `Place.seoCanonicalUrl`;
`seoCanonicalUrl` can be populated in the DB while the rendered HTML still has no
`<link rel="canonical">` at all — confirmed on all 5 published Places. Current Place canonical
validation = FAIL. This blocks final Go/No-Go but does NOT reopen or invalidate the
data/migration closure above.

PRODUCTION EXECUTION:
NOT STARTED — manifest generation deliberately deferred to actual cutover time (no bulk Place
discovery gap here, unlike Offer; deferred purely because source content could drift between now
and cutover, so freezing today's hashes would be less rigorous than generating fresh ones then).

Regression found+fixed: PlaceCommitWriter.buildUpdateData() unconditionally reset status to PENDING
  and clobbered cityId on every UPDATE (same class as the EventCommitWriter bug) — dormant today (0
  Places in an UPDATE_SAFE state) but a live risk for the next WP edit to any of the 76 clean rows.
  Fixed + 3 regression tests added, full Place test suite green.
```

- [x] Places DB/source aggregate audit, exact status/classification matrix, safe-UPDATE regression
      fix, media manifest, public validation — see above and `docs/migration/reviews/place-*-2026-07-28.*`.
- [x] Founder decision (applied 2026-07-29): publish the 76 `READY_FOR_EDITORIAL_PUBLICATION_REVIEW`
      Places via the existing `approvePlace()` lifecycle — see PLACES LOCAL PUBLICATION below.
- [x] `PLACE_CANONICAL_METADATA_MISSING` fixed — see below.
- [ ] Founder decision: disposition of the 2 `CITY_BLOCKED` Places (assign city with real evidence,
      or leave excluded indefinitely) — unresolved, still `PENDING`.
- [ ] Production execution Places (manifest generation deferred to cutover time, not frozen now).

**Places — 2026-07-29, worktree `mamago2-places-offers-publication`, branch
`feat/places-offers-publication-closure`, base `feat/places-offers-production-media-closure`@`74bcb483`.**
Full detail: `docs/migration/reviews/place-publication-result-2026-07-29.md`,
`docs/migration/reviews/place-publication-manifest-2026-07-28.json`.

```text
PLACES LOCAL PUBLICATION:
COMPLETE

82/82 lineage accounted for
80/80 publishable lineage Places PUBLISHED:
  4 protected existing (437/895/5389/43023, untouched)
  76 newly published via existing approvePlace() lifecycle (0 raw status mutations)
2 CITY_BLOCKED remain PENDING (untouched, no evidence to assign a city, correctly excluded from
  the publishable-lineage count above):
  wordpress-db:places:32409 (Be English)
  wordpress-db:places:60742 (Школа архитектурного мышления)
1 non-migration seed PUBLISHED, accounted for separately (out of migration scope)
(81/83 total Place rows are PUBLISHED: 80 lineage + 1 seed)

Place canonical:
RESOLVED LOCAL, integrated RC revalidation required — PLACE_CANONICAL_METADATA_MISSING fixed
(generateMetadata() now reads seoCanonicalUrl, falls back to slug-based path, never uses id when a
slug exists); verified via current-worktree HTTP/browser proof (own dev server, port 3050, launched
from this worktree's own pwd, .next cleared first — see place-publication-result-2026-07-29.md
for exact provenance) on real HTML for all 76 newly-published Places (76/76 have
<link rel="canonical">, 0/76 id-based) plus the 4 pre-existing published Places. Not yet
re-verified against an integrated RC build.

Place local media:
existing sampled policy verified unchanged (not expanded); 76 newly-published Places use
METADATA-only media (no cover), render cleanly with no broken images.

Place production FULL media:
GATED (unchanged from prior session)

Place production publication:
GATED (manifest generation deferred to actual cutover time)

Common rerun:
76/76 ALREADY_PUBLISHED_CANONICAL_AND_INDEX_RESYNC — 0 lifecycle/content/relation writes, but
canonical-table (76 unconditional UPDATEs) and search-index (76 unconditional upserts) writes did
occur, value-neutral (timestamp-only — see place-publication-result-2026-07-29.md §7 for the exact
code-level reasoning). Not a bare "0 writes"; precision matters here.

Public/city/browser (current-worktree HTTP/browser proof):
PASS — 76/76 HTTP 200, correct city/title/category, 0 console errors on representative deep smoke
(desktop+mobile), both CITY_BLOCKED Places confirmed still 404. Integrated RC browser revalidation
still required (BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC).

Protected fields (title/cityId/ownerBusinessId) verified byte-identical before/after for all 76;
slug allowed to change only from null->assigned (existing approvePlace() behavior, not new).
```

**Offers — 2026-07-28 (two sessions), same worktree.** Full detail:
`docs/migration/reviews/offer-*-2026-07-28.{md,json}`.

```text
OFFERS SAFE SCOPE:
DATA CLOSURE COMPLETE 63/63

63/63 safe canonical Offers accounted for (matches 2026-07-22 closure, commit 1fca8c8b — golden +
  Batch 1-4, immutable manifest hashes on record; NOT re-run this session, per that session's own
  "must not run again")
63/63 linked to proven Places (0 duplicate source keys/linkage/slugs, 0 wrong-Place Offers)
63/63 cityId backfilled from linked Place (writer regression found+fixed, see below)
0 unexpected CREATE/DELETE
common backfill rerun: 0 eligible, 0 writes — deterministic

PUBLICATION:
NOT COMPLETE — all 63 remain DRAFT

Approved lifecycle path:
NOT YET DEFINED. `approveOffer()` only accepts a PENDING→PUBLISHED transition; none of the 63 ever
went through a DRAFT→PENDING submit step (they were migration-created, not Business-submitted) — a
structural capability gap, not a reason to bypass the normal lifecycle. Preferred future lifecycle
for a separate task:  DRAFT → (submit-for-moderation, not yet implemented) → PENDING →
`approveOffer()` → PUBLISHED. A technical path to set `PUBLISHED` directly exists today via the
privileged-role Business PATCH endpoint — it is explicitly NOT to be used for a mass direct
DRAFT→PUBLISHED move without its own separate founder decision.

MEDIA:
NOT IMPLEMENTED — founder P0/P1 decision required.
  Option A (P0): implement a minimal source-backed Offer media pipeline (cover image, reusing
    PlaceMediaSyncer's dedup/storage pattern) before any Offer goes to production.
  Option B (P1 defer): launch Offers without media, conditional on: layout doesn't break, CTA
    works, no misleading placeholder is shown, and public/business/admin UAT passes.
  Not declared deferred without explicit founder approval — recorded here as an open decision, not
  as a settled P1.

Class H: 28 documented backlog — no required Place relation (carried forward from the 2026-07-22
  closure, not re-derived; no bulk Offer source-discovery tool exists in this codebase to redo it).
Class I: 8 documented backlog — noncanonical alias (same as above).

CANONICAL:
Offer's public-page code already reads `seoCanonicalUrl` and sets `alternates.canonical` correctly
(confirmed via code reading) — but with all 63 still DRAFT, there is no PUBLISHED Offer to browser-
verify the rendered HTML against yet. Status: `IMPLEMENTED_IN_CODE, PUBLIC RUNTIME PROOF PENDING`
— not declared a full PASS until at least one Offer is PUBLISHED and its HTML verified.

PUBLIC/BUSINESS/ADMIN VALIDATION:
PARTIAL — public 404 confirmed for a DRAFT Offer (correct), auth gating confirmed (401
unauthenticated); full authenticated business/admin walkthrough NOT performed (all 63 are uniformly
DRAFT, nothing a login flow would newly reveal beyond the DRAFT-status finding above — see
offer-business-admin-smoke-2026-07-28.md).

PRODUCTION EXECUTION:
GATED — exact 63-key scope identified, prerequisite (writer fix) must ship before any production
Offer commit; byte-exact manifest hash deferred to actual cutover time (no bulk preview tool exists
to freeze one today) — see offer-local-execution-2026-07-28.md.

Regression found+fixed: OfferCommitWriter.createOfferFromDraft() resolved+validated
  draft.ownership.cityId (buildOfferCreateDraft blocks on MISSING_CITY otherwise) but never
  persisted it — all 63 Offers had cityId: null despite their Place always having a real city. Fixed
  the writer (+regression test, new OfferCommitWriter.test.ts — none existed before) and backfilled
  all 63 existing rows from Offer.place.cityId (CAS-guarded, one-off runner — deleted after use, not
  a committed reusable tool — protected fields verified byte-identical, reran to confirm 0 further
  writes). 0/63 city mismatches now.
```

- [x] Offers DB/source reconfirmation, `cityId` regression fix+backfill, media capability-gap
      assessment — see above and `docs/migration/reviews/offer-*-2026-07-28.*`.
- [x] Founder decision (applied 2026-07-29): implement `submitOfferForModeration()` and publish the
      safe-canonical 63 via `DRAFT → PENDING → PUBLISHED` — see OFFERS SAFE SCOPE LOCAL PUBLICATION below.
- [x] Founder decision (applied 2026-07-29): Offer media Option B (explicit P1 defer), approved only
      after fixing a real broken-image defect found during runtime validation — see below.
- [ ] Production execution Offers safe scope 63/63 (manifest generation deferred to cutover time).

**Offers — 2026-07-29, same worktree as Places above.** Full detail:
`docs/migration/reviews/offer-publication-result-2026-07-29.md`,
`docs/migration/reviews/offer-publication-manifest-2026-07-28.json`.

```text
OFFERS SAFE-SCOPE LOCAL PUBLICATION:
DATA/LIFECYCLE COMPLETE 63/63

Lifecycle:
DRAFT -> PENDING -> PUBLISHED, via new submitOfferForModeration() (no prior submit path existed for
Offer) + existing approveOffer() — never the privileged direct-publish endpoint.

Safe scope:
63/63 PUBLISHED, 0 DRAFT remaining, 0 CREATE, 0 DELETE, 0 duplicate ids/sourceRecordKeys/slugs,
0 unexpected PENDING rows.

Class H:
28 untouched backlog (never persisted, nothing to touch)

Class I:
8 untouched backlog (same)

PUBLIC RUNTIME:

63/63 HTTP 200 (following the canonical /offers/[slug] -> /[city]/offers/[section]/[slug] redirect).

Canonical runtime:
PASS — Offer's existing code-level canonical implementation confirmed correct against real rendered
HTML (current-worktree server, port 3050, own pwd — see offer-publication-result-2026-07-29.md for
exact provenance) now that Offers are published: 63/63 have <link rel="canonical">, 0/63 id-based.
Integrated RC browser revalidation still required.

Offer media (shared fallback image):
EXPLICIT P1 DEFER — APPROVED, after fixing a real pre-existing defect: the shared fallback image
(public/og-default.jpg — rendered directly in the public content layout as the hero image when no
cover exists, not only as an OG meta tag; also used by Events) was a 49-byte placeholder TEXT file
mislabeled as image/jpeg, causing a genuine broken <img> on every Offer/Event page with no cover.
Replaced with a real 1200x630 JPEG (decodes cleanly, sRGB, no EXIF/embedded data, solid on-brand
color, synthetically generated — not a third-party image; asset-only fix, no code change, not a
media migration/storage write). Re-verified: no broken images, CTA visible/functional, clean
desktop+mobile, 0 console errors.

Authenticated business/admin:
AUTHENTICATED BUSINESS/ADMIN UAT: NOT PERFORMED. Unauthenticated 401 (auth gate present) was
reconfirmed, but that does not prove owner/wrong-owner/admin visibility or lifecycle correctness —
no safe local credentials existed this session to test those without creating a user, resetting a
password, or fabricating a session, all explicitly prohibited. Not declared PASS.

CTA:
CTA UI SMOKE: PASS (both CTAs render, visible, open the expected form).
CTA END-TO-END REQUEST: UAT PENDING (no request was actually submitted; no client-side validation
or notification delivery exercised).

Common rerun:
63/63 ALREADY_PUBLISHED_CANONICAL_AND_INDEX_RESYNC — 0 lifecycle/relation/content writes, but
canonical-table (63 unconditional UPDATEs) and search-index (63 unconditional upserts) writes did
occur, value-neutral (timestamp-only). Not a bare "0 writes".

PRODUCTION:
GATED — unchanged, exact 63-key scope ready, manifest hash deferred to cutover time.
```

**Articles** — out of scope for this session (per explicit instruction):

```text
ARTICLES: COMPLETE
ARTICLE MEDIA: PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS
```

Not revisited without new regression evidence.

**Shared finding (Places + Offers):** `EVENT_SEARCH_INDEX_PUBLICATION_RACE`'s defect class
(fire-and-forget, unordered, unawaited `SearchDocument` upserts in
`extendPrismaWithSearchIndexing`) is structurally applicable to Place/Offer too — same shared
infrastructure. Did not reproduce this session because migration writes bypass that extension
entirely (bare `PrismaClient`, confirmed by reading `scripts/migration-commit-wordpress-db.ts`); it
would only become live once these entities are published through the normal admin/business app flow.
Not re-investigated further (shared infra, its own scoped fix, same posture as the existing Events
backlog entry).

### 5.6 Reviews

- [ ] Подтвердить approved source scope.
- [ ] Users + Places dependency gate.
- [ ] Review vertical slice, golden sample, small batch и rerun.
- [ ] Public rating aggregates validation.

Допустимо перенести Reviews в P1 только явным founder decision.

### 5.7 Redirects, mandatory pages и SEO

**2026-07-29, worktree `mamago2-seo-migration-closure`, branch
`fix/seo-migration-closure`, base `release/integrated-rc`@`5edeaaac`.**

```text
SEO MIGRATION CLOSURE (local technical):
COMPLETE

Canonical P0 (Event/Place/Offer/Article) fixed + tested (5 entity resolvers,
all sharing one validateStoredCanonical origin/path/slug/query-hash check —
Route's pre-existing pattern generalized). Event canonical was completely
absent (buildOgMeta never set alternates.canonical); Place/Offer/Article
trusted a stored seoCanonicalUrl unconditionally (stale mamago.local:3000
rendered verbatim); Offer's write-side sync computed the wrong path entirely
(missing city+section — a stored value could point at a URL that itself
301-redirects). Also found the same unvalidated-canonical bug leaking into
Article JSON-LD (separate code path from generateMetadata, same fix).

City duplicate matrix: Route/Article/Event were already structurally safe
(query-level city filtering). Two real bugs found and fixed: [city]/places/
[slug] re-exported the non-city route unconditionally (ignored its own city
param — every city segment rendered 200), now redirects to the one true
canonical in a single hop; [city]/offers/[section]/[slug] resolved by slug
alone (no city filter) and leaked the URL's (possibly wrong) city into its
own computed canonical, now resolves the offer's real city and redirects on
any mismatch.

Sitemap expanded to 199 directly resolving URLs; individual
Place/Offer/Route/Article/Event URLs were previously absent. Populated using each
entity's own public-visibility predicate + the same canonical resolvers, so
sitemap URLs always match each page's own <link rel="canonical">. Found
live during the dev crawl: content belonging to isActive:false cities
(ratomka/mir/kopische — 4 Places, 7 Offers) was included despite not being
in the static KNOWN_CITY_SLUGS allowlist the WP legacy catch-all uses at
Edge-middleware time — a real canonical-to-redirect defect (7 Offer sitemap
URLs 301'd to /minsk instead of resolving 200). Fixed by excluding
inactive-city content, matching the pre-existing city-hub loop's own filter.
Also removed the sitemap's separate root entry (the public surface's own
middleware unconditionally 307-redirects "/" to the flagship city hub
outside dev/localhost — pre-existing, NODE_ENV=production-specific
behavior only caught by the production-build crawl, not the dev one) —
the flagship city's hub entry now carries priority 1 instead.

Robots/noindex: contract-tested (globalNoindex.test.ts) that meta robots
and X-Robots-Tag can never disagree — both already derive from one flag by
construction, locked with a test.

Redirect manifest (893 rows, scripts/data/wp-redirect-map.json ->
manifest.csv -> next.config.ts): loadRedirectManifest() (the exact function
next.config.ts calls) reports 893/893 structurally valid, 0 issues — no bad
paths, self-redirects, duplicate-source conflicts, unknown-destination
sections, or cycles. validate-redirect-map.ts extended (not rebuilt) with a
disposition classification: EXACT_REDIRECT 12, VALID_HUB_REMAP 21,
P1_START_OR_CONTAINS 24, INVALID_TARGET 836 (destination well-formed, no
live entity yet — expected migration-scope gap: only ~26 Articles and 10
Activity/Event lineage records were ever migrated against 106/717
Article/event-type legacy rows; not a redirect-config defect), COLLISION 0,
CHAIN 0, LOOP 0. One source (/places) collides with a reserved app-root
segment but doesn't hijack a live route (no dedicated /places listing page
exists). 0 redirects to bare "/". Full report:
docs/migration/seo/redirect-audit-summary.md.

Structured data: audited all builders (Article/Event/Place/Route/Offer/
Organization/WebSite/Breadcrumb/FAQ). Organization/WebSite emitted exactly
once (shared layout). No fake ratings (aggregateRating only emitted with a
real DB-backed reviewCount > 0). Full report:
docs/migration/seo/structured-data-audit.md.

Media runtime: MEDIA_STORAGE_ROOT has no env override; per-file symlinks
(not a directory symlink, to avoid touching the git-tracked
storage/uploads/.gitkeep) from this worktree to the main worktree's real
uploads (482 files, source untouched). Closes MEDIA_RUNTIME_PROOF_BLOCKED.
Favicon P2 confirmed fully resolved end-to-end (official asset already
existed, was only missing from this worktree's storage) — no code change
needed. MutationObserver TypeError: attempted reproduction via real browser
across 5 entity page types, not reproduced — classified DEV_ONLY/
NOT_REPRODUCED. Full report: docs/migration/seo/media-runtime-audit.md.

Bounded verifier (scripts/verify-prelaunch-seo.ts + .test.ts, 18 parser/rule
tests, no external dependencies): dev crawl (port 3075, both
SITE_INDEXING_ENABLED on and off) and production build + standalone-server
crawl (port 3076, APP_PUBLIC_URL=https://mamago.by,
REQUIRE_REDIRECT_MANIFEST=1) both report 0 P0 findings and 0 remaining
issues after fixes. Canonical/robots.txt/sitemap confirmed to always show
the real production origin, never localhost, despite being served from
localhost:3076. Full reports: docs/migration/seo/integrated-rc-crawl-summary.md.

Local-only phase: no push, no PR, no merge into release/integrated-rc/dev/
main; release/integrated-rc and all source worktrees confirmed untouched
throughout. The final count is computed from the current base with
`git rev-list --count b30325f5..HEAD` (40 commits after the two redirect-center
closure commits), not a hand-maintained phase estimate.

REMAINING (not blocking local technical closure, explicitly deferred):
- External Search Console/Analytics/backlink baseline — not available
  locally; full SEO Go/No-Go needs it, local technical closure does not.
- Legacy URL -> new URL action manifest CSV (KEEP_200/REDIRECT_301/
  GONE_410/REAL_404/BLOCKED_NOINDEX/MANUAL_DECISION per source row) — the
  disposition classification above covers the same ground at a coarser
  grain; a full per-row manifest with founder-reviewable dispositions for
  the 836 INVALID_TARGET rows was not built this session (P1_START_OR_CONTAINS
  vs REAL_404 vs GONE_410 is a founder/content call, not inferrable from
  code).
- Content/metadata parity report (title/description/H1/OG per entity) not
  built as a separate CSV this session.
- Internal-link audit found one dead link (PlaceHero.tsx -> /places, no
  dedicated listing page exists) — flagged, not fixed (no clear correct
  target without a product decision).
```

- [x] RankMath `exact` redirects subset — covered by the EXACT_REDIRECT/
      VALID_HUB_REMAP disposition classes (33 of 893 rows resolve to live
      content today; the rest are migration-scope gaps, not manifest bugs).
- [x] Redirects на `/` вручную перемапить на релевантные hubs — 0 rows in
      the legacy manifest target bare `/`.
- [ ] Legal/about/contact pages — not audited this session.
- [x] WordPress catch-all — verified it does not swallow valid app routes
      beyond the one known false-positive class (Edge-static
      `KNOWN_CITY_SLUGS` missing DB-only inactive cities, worked around by
      excluding that content from the sitemap rather than touching the
      Edge-time allowlist).
- [x] Canonical/no-trailing-slash и city-scoped URLs — see canonical P0 and
      city-duplicate-matrix summary above.
- [x] Sitemap/robots/noindex launch gate — see sitemap/robots summary
      above; verified in both dev and production-build crawls.
- [x] Redirect manifest minimum и collision audit — 893 rows (fixed actual
      count, not chased toward the old 900 threshold per instruction), 0
      collisions/chains/loops confirmed by two independent checks.

`start`/`contains` redirects остаются P1 (P1_START_OR_CONTAINS, 24 rows).

### 5.8 Product regressions — launch blockers

- [ ] Event появляется в правильном городе и на правильной дате.
- [ ] Event public URL не отдаёт 404.
- [ ] Published Article виден в блоге selected/default city.
- [ ] Auth и migrated-account activation smoke.
- [ ] Business cabinet и admin lifecycle smoke.
- [ ] Public Places/Offers/Events/Articles/Routes smoke.
- [ ] Mobile/desktop critical navigation smoke.

### 5.9 Release candidate и production cutover

- [ ] Freeze production source snapshots. — founder/ops action, not yet declared.
- [x] Production manifests и checksums. — **Users, Articles, Places, Offers
      (+ Place/Offer media) all frozen** as of 2026-07-30:
      [production-entity-manifests-2026-07-29.md](production-entity-manifests-2026-07-29.md),
      raw manifests in `docs/migration/manifests/`. Places manifest is a
      live read-only WordPress-source preview (82 discovered, 78
      SKIP_UNCHANGED, 4 expected UPDATE_CONFLICT — see
      `migration-manual-protected-places` memory); Offers manifest is
      built from the already-reviewed committed local state (63/63
      cross-referenced against active lineage, 0 orphans) since the
      per-record WP-source tool needs a missing `offers-inventory.json`
      snapshot (documented blocker, not silently worked around).
- [x] Fresh production backup и подтверждённый restore procedure —
      **local rehearsal PASS** 2026-07-29 (DB: 13/13 table counts, 507
      constraints, 736 indexes identical; storage: 482 files/38,494,112
      bytes, 0 checksum discrepancies). Production execution still
      `PENDING GO WINDOW` — no production DB/hosting target exists to
      back up yet.
- [ ] Full local production-like rehearsal.
- [ ] Dev metadata-only rehearsal.
- [ ] Cumulative DB/storage delta и forbidden fields/tables audits.
- [ ] Redirect/SEO validation report.
- [ ] Docker Build & Push exact RC SHA — GREEN.
- [ ] Финальный Go/No-Go. — matrix (CONDITIONAL GO, narrowed 2026-07-30 to
      production-environment-only gates):
      [go-no-go-readiness-2026-07-29.md](go-no-go-readiness-2026-07-29.md).
- [ ] Последовательная production migration. — runbook + production target
      worksheet:
      [production-migration-runbook-2026-07-29.md](production-migration-runbook-2026-07-29.md).
- [ ] Post-migration validation и разрешённые idempotency reruns.
- [ ] DNS cutover, noindex switch, monitoring/rollback decision window. —
      plans drafted:
      [dns-cutover-plan-2026-07-29.md](dns-cutover-plan-2026-07-29.md),
      [launch-monitoring-plan-2026-07-29.md](launch-monitoring-plan-2026-07-29.md),
      [launch-window-checklist-2026-07-30.md](launch-window-checklist-2026-07-30.md).
      Activation canary formalized with founder input fields, batch
      sequence proposal, and exact preview/send/reconcile commands
      (documented, not run):
      [activation-canary-plan-2026-07-29.md](activation-canary-plan-2026-07-29.md).
      Bounce handling: manual reconciliation decided (no webhook or
      bounce/complaint schema states exist today — confirmed by code
      inspection, not assumed).

---

## 6. FULL PRODUCT ACCEPTANCE / UAT — обязательный P0 gate

Полная матрица, evidence contract и журнал выполнения:
[full-product-acceptance.md](../prelaunch/full-product-acceptance.md).

```text
Full product acceptance / UAT: NOT STARTED
Pass 1:                       NOT STARTED
P0 defects:                   UNKNOWN
Pass 2:                       NOT STARTED
Founder acceptance:           NOT RECORDED
```

Source document: `docs/prelaunch/full-product-acceptance.md`.
Authenticated BUSINESS_OWNER/MODERATOR/ADMIN execution is pending; CTA
request-to-business receipt and response is pending end to end. UAT Pass 1
must run on the integrated RC exact SHA. Older isolated browser proofs do not
replace integrated-RC UAT evidence.

Техническая готовность, успешная миграция и зелёный CI не являются
достаточным доказательством готовности к запуску. Перед Go/No-Go должны быть
вручную пройдены критичные пользовательские, бизнесовые и административные
сценарии от начала до конца.

Запуск запрещён при:

- открытом P0 defect;
- непройденном P0 user journey;
- неизвестном результате критичного сценария;
- расхождении UI, API и состояния БД;
- недоказанной production rollback/restore процедуре.

### UAT PASS 1 — full critical-flow acceptance

Цель: найти реальные дефекты на сквозных пользовательских сценариях.

После Pass 1:

- зарегистрировать дефекты и классифицировать P0/P1/P2;
- исправить все P0;
- P1 исправить либо получить явный founder defer;
- P2 отправить в backlog.

### UAT PASS 2 — regression and founder acceptance

Цель: повторно пройти все критичные flows после исправлений.

Launch gate:

- 0 открытых P0 defects;
- нет неизвестных `BLOCKED` P0 scenarios;
- все P1 имеют fix либо явное defer-решение;
- production-only gates имеют подтверждённый план выполнения;
- founder acceptance recorded.

Если после Pass 2 исправлялись критичные flows, обязателен targeted Pass 3
по затронутым областям и их зависимостям.

Обязательный порядок фаз:

```text
migration completion
→ content/public validation
→ full product UAT Pass 1
→ defect fixes
→ UAT Pass 2
→ RC rehearsal
→ production Go/No-Go
→ cutover
```

### P0 launch journeys

1. `P0-J1` — новый пользователь регистрируется, входит и использует публичный продукт.
2. `P0-J2` — мигрированный пользователь активирует аккаунт и входит.
3. `P0-J3` — BUSINESS_OWNER создаёт Business → Place → Offer и отправляет на модерацию.
4. `P0-J4` — ADMIN/MODERATOR проверяет и публикует контент.
5. `P0-J5` — опубликованная сущность появляется в правильном городе и discovery.
6. `P0-J6` — пользователь открывает сущность и отправляет заявку/бронирование.
7. `P0-J7` — бизнес получает заявку и отвечает.
8. `P0-J8` — пользователь получает ответ и видит актуальный статус.
9. `P0-J9` — Event корректно работает с датами, sessions и завершением.
10. `P0-J10` — основные public/admin/business flows работают на mobile и desktop.
11. `P0-J11` — старые WordPress URL корректно перенаправляются.
12. `P0-J12` — backup, restore, RC build и production migration gates подтверждены.

Birthday/custom-request не включён в P0 автоматически: реализация присутствует
частично (`Occasion`, birthday discovery, Direct/editorial request surfaces), но
полный обещанный пользователю request → matching → proposals → selection flow
не доказан. Нужен founder decision: `P0 BLOCKER` либо `P1 DEFER`.

Reviews реализованы в schema/admin/public surfaces, но migration и сквозная
приёмка не начаты: founder decision `P0` либо явный `P1 DEFER` остаётся gate.

Production-ready пользовательский checkout/payment callback flow кодом не
подтверждён. Billing ledger и административные credit/debit/refund операции не
считаются таким flow. Нужен founder decision: payments вне launch P0 либо
отдельный P0 blocker; реальные платежи в UAT запрещены.

---


## 7. Blockers classification — confirmed OPEN P0 vs decision/backlog

**P0 launch blockers resolved locally; integrated RC revalidation required:**

```text
1. EVENT_SEARCH_INDEX_PUBLICATION_RACE — RESOLVED LOCAL.
   Per-entity indexing is now ordered and the final publication index is strict + awaited.
   Event/Place/Offer fixture regressions pass; INTEGRATED RC REVALIDATION REQUIRED.
   Historical root cause:
   fire-and-forget, unordered SearchDocument upserts raced on
   any entity publish flow (extendPrismaWithSearchIndexing). Reproduced twice for Events; confirmed
   structurally applicable to Place/Offer's own app-level publish flow too (not reproduced there —
   this session's Place/Offer publications went through it correctly, see §5.5 — but the shared
   infra defect is unfixed). Fix: one deterministic reindex after the full publish transaction,
   replacing the two independent dispatches, OR an ordering/dedup queue in the indexer. Shared
   infra, its own scoped slice. See §5.3 for full reproduction detail.
2. ROUTE_CANONICAL_METADATA_MISSING — RESOLVED LOCAL.
   Published PUBLIC Routes emit one absolute stored-or-slug-fallback canonical; stale/invalid
   stored origins fall back safely. DRAFT/non-public Routes emit no public canonical.
   INTEGRATED RC REVALIDATION REQUIRED. Historical root cause:
   RouteDetailPage's generateMetadata() never read
   Route.seoCanonicalUrl; confirmed via browser smoke, pre-dates the Routes closure session, not
   fixed there. (Place's equivalent defect, PLACE_CANONICAL_METADATA_MISSING, IS fixed as of this
   session — RESOLVED LOCAL, integrated RC revalidation required — but the Route one remains open;
   these are two separate fixes to two separate files, not one shared change.) Fix: read
   Route.seoCanonicalUrl into alternates.canonical, same pattern as the now-fixed Place page.
3. ROUTE_MAP_WITHOUT_VALID_COORDINATES — RESOLVED LOCAL.
   MAP HIDDEN/REPLACED BELOW 2 VALID DISTINCT POINTS. COORDINATE BACKFILL NOT PERFORMED.
   INTEGRATED RC REVALIDATION REQUIRED. Historical root cause:
   0/90 RouteStops have lat/lng/address populated, so the
   public map widget renders a meaningless line across the country on every Route page. Minimum
   required fix: hide or replace the map when fewer than 2 valid coordinate points exist for a
   Route (a small, bounded rendering-guard change) — this alone resolves the P0 (a broken/misleading
   map is the launch-blocking defect, not the absence of coordinates itself). Full RouteStop
   coordinate extraction/backfill from the embedded "Координаты: ..." source text remains a
   separate, valuable, but non-blocking opportunity — it is not a required condition for closing
   this P0.
```

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` remains mandatory for
this slice and all earlier critical runtime proofs whose exact checkout
provenance was not established.

Side findings from the bounded Route runtime audit:

- `ROUTE_RATINGS_PARAMS_NOT_AWAITED — OPEN P1`: the automatically mounted
  rating block calls `GET /api/routes/ratings/[routeId]`; its Next 16 handler
  reads Promise-based `params` synchronously and returns 400/default counts.
  The Route HTTP 200, canonical, map guard and main content remain functional.
  Proposed next fix: await typed Promise params in the GET handler and add the
  existing route-handler test pattern. Not fixed in this P0 slice.
- `MISSING_FAVICON_ASSET — OPEN P2`: `/favicon.ico?...` redirects to
  `/api/media/file/1783033874844-9q4z9h5fueo-favicomamago.webp?...`, which is
  absent from this worktree's local upload storage and returns 404. This is a
  branding/static cosmetic request; it does not affect layout, canonical,
  indexability or primary content. Not fixed in this P0 slice.

**Decision/backlog (require a founder decision; not automatic launch blockers — may remain excluded/deferred by explicit approval):**

- Mogilev City onboarding (`wordpress-db:routes:46963`, Route `marshrut-mogilev`) —
  City creation/configuration, slug, country, discovery, SEO, sitemap, redirects,
  public smoke; Route stays DRAFT until this is a separate founder-approved decision.
- Route stop images (`ROUTE_STOP_MEDIA_POLICY_METADATA_SKIPPED`) — media policy
  decision, not imported for any of the 14 Routes; separate media gate if revisited.
- RouteStop geo backfill (full extraction from source text, beyond the P0's minimum map-hiding fix
  above) — separate migration slice, valuable but non-blocking.
- Past Events и Event images.
- 63 expired Activities и связанная authorship — `P1_HISTORICAL_EXPIRED_ACTIVITY`.
- `wordpress-db:events:64159` disposition (hard-exclude vs. leave PENDING indefinitely) — may
  remain unpublished by founder-approved exclusion.
- Noncanonical Offer class I (8) — may remain excluded by founder-approved exclusion.
- Offer class H (28) без Place relation — may remain excluded by founder-approved exclusion.
- Place `32409`/`60742` `CITY_BLOCKED` — may remain non-public (still `PENDING`) by
  founder-approved exclusion, pending real city evidence.
- Offer media (cover/gallery import) — genuinely unimplemented (explicit code-level gate, not a
  regression); `OFFER_MEDIA_DEFERRED_P1` already approved this session for the current 63-Offer
  scope (see §5.5), conditional on the layout/CTA checks that were performed — a real P0
  implementation remains a separate, explicitly-deferred opportunity, not a blocker for what's
  already published.
- Full public profile content classification.
- RankMath `start`/`contains` redirects.
- Historical bookings, WooCommerce/LatePoint и social feeds.
- Collections и редкие custom post types.

---

## 8. Раздельная оценка готовности

> Историческая оценка от 2026-07-29 (до Phoenix release bundle). Актуальный
> статус по трём независимым трекам запуска — см. "Launch readiness — three
> independent tracks" в начале документа.

Это операционная оценка, не календарное обещание:

```text
Implementation readiness:  ~95% — critical surfaces и guards существуют;
                            confirmed open product P0 defects: 0.
Migration readiness:       ~85% — local scope и manifests закрыты;
                            production execution и production audits остаются.
Product UAT readiness:      ~75% — desktop, automated auth/business/admin и
                            public smoke пройдены; mobile и owner UI остаются.
Production readiness:      ~30% — activation rehearsal готов, но backup/restore,
                            RC exact-SHA, providers и production gates не пройдены.
Overall launch readiness:   ~90% technical RC / ~45% launch — технический RC
                            зелёный, но production gates всё ещё не пройдены;
                            это не среднее арифметическое остальных оценок.
```

Почему остаток всё ещё крупный: самые рискованные Users identity/ownership writes, Events tail и Routes review уже закрыты, но впереди media/SEO/regressions и весь RC/cutover цикл.

Крупные обязательные launch gates:

1. Integrated-RC technical and representative runtime verification.
2. SEO MIGRATION CLOSURE.
3. Full product UAT Pass 1, defect cycle, Pass 2 and founder acceptance.
4. Users production activation delivery Go/No-Go.
5. Reviews and remaining media scope: implementation or explicit founder P1 defer.
6. Redirects/pages/product regression and production cutover rehearsal.

Events, Routes, Places/Offers safe publication, Articles, Users migration and the three local P0 fixes are complete; they require integrated-RC revalidation, not reopening.

Ориентир по объёму работы:

```text
примерно 12–18 связных slices/PR до cutover,
если Reviews и часть media будут явно перенесены в P1;
больше — если весь перечисленный media/reviews scope остаётся обязательным P0.
```

---

## 9. Следующее одно действие

> Хронологический журнал сессий, самая свежая запись — внизу (последняя:
> `PHOENIX RELEASE BUNDLE`, 2026-07-31). Единственное актуальное «следующее
> действие» — в блоке `Next one action` в начале документа; записи ниже —
> evidence, не текущая фаза.

```text
Phase: PRODUCT REGRESSION / RC READINESS — TECHNICAL PASS
Completed 2026-07-29 on exact source SHA
`17c9dd29787bbab0462ca581c546ca83a5dc2e73`: production build, built-artifact
smoke, public discovery, desktop Admin/Redirect Center, automated auth,
activation, ownership/access/lifecycle, typecheck and warmed SEO crawl. Confirmed
open product P0 defects: 0. Full evidence:
`docs/migration/rc-product-regression-2026-07-29.md`.

Next single action: FINAL GO/NO-GO PREPARATION. First attach manual mobile and
authenticated BUSINESS_OWNER end-to-end evidence to this exact RC lineage;
then assemble founder acceptance and owners/timestamps/proof for the existing
production-only gates. Do not return to already-closed migration entities or
SEO items without new regression evidence.

Out of scope for this phase: UAT Pass 1, production writes/email, DNS, Search
Console submission, payments, CITY_BLOCKED Places disposition, Event 64159
disposition, Mogilev onboarding, and deferred P1 implementation (favicon —
already closed; MutationObserver — DEV_ONLY/NOT_REPRODUCED; legal/about/
contact page audit; content/metadata parity CSV; per-row legacy-URL action
manifest for the 836 INVALID_TARGET redirect rows; PlaceHero.tsx dead
/places link).
```

```text
Phase: FINAL GO/NO-GO PREPARATION — readiness package assembled
2026-07-29, worktree mamago2-product-regression-rc, branch
codex/product-regression-rc-20260729, on RC source SHA
17c9dd29787bbab0462ca581c546ca83a5dc2e73 (docs-only HEAD, verified no code
diff to that SHA before starting).

Both mandatory evidence gaps named above are now closed locally:
- Mobile visual UAT at 390x844 and 412x915 across public/auth/business/admin
  surfaces — no page-level horizontal overflow found; one console error
  ("Rendered more hooks than during the previous render") observed on
  client-side navigation under `next dev` + React StrictMode, plausibly a
  dev-only double-invocation artifact (not yet re-verified under a
  production build in this session — flag for a quick targeted check before
  final sign-off); the already-known Admin Routes column-clipping P1 and
  external-Unsplash-fallback P1 both reproduced as expected, no new P0.
- BUSINESS_OWNER UI end-to-end, via a disposable local fixture (created and
  fully deleted after the test, zero residue, counts diffed before/after):
  own-Business scoping confirmed, edit → save correctly created a PENDING
  `PlaceRevision` (moderation lifecycle working), cross-tenant edit URL
  access was safely redirected to the actor's own list (no data leak), a
  plain `USER` account was redirected away from `/business`, ADMIN/BUSINESS
  fixture roles unchanged after testing.

New this session, added to the readiness package:
- `production-entity-manifests-2026-07-29.md` — manifest index consolidating
  already-confirmed counts (Users 578, Articles 2 frozen with hashes; Places
  and Offers explicitly still deferred to cutover time, per §5.5).
- `production-migration-runbook-2026-07-29.md` — synthesized cross-entity
  execution order (Users → Businesses → Places → Offers → Routes → Events →
  Articles → Redirects → Media → Activation canary), preflight table with
  explicit gaps flagged (no production DB/hosting target named anywhere in
  the corpus — founder must supply).
- `activation-canary-plan-2026-07-29.md` — formalizes the existing delivery
  plan's canary step into PASS/STOP tables; recipients still
  FOUNDER_SELECTION_REQUIRED, batch size still TBD by founder, bounce-webhook
  gap unchanged.
- `dns-cutover-plan-2026-07-29.md` — new; no equivalent existed. Built on the
  existing noindex mechanism (`SITE_INDEXING_ENABLED` /
  `SITE_NOINDEX_FORCE` / `SITE_NOINDEX_DEFAULT`, fail-safe default noindex)
  and `ProductionMigrationGuard`.
- `launch-monitoring-plan-2026-07-29.md` — new; first-15-min/hour/24h
  checklist using existing tooling (Sentry, redirect validator, activation
  audit), no new monitoring platform introduced.
- Local DB backup/restore rehearsal: `pg_dump` → disposable database →
  13/13 key table counts, 507 constraints, 736 indexes, role distribution
  and published-content counts all identical; `prisma migrate status`
  reports up to date against the restored copy; disposable database
  dropped. PASS.
- Local storage/media restore rehearsal: 482 files, 38,494,112 bytes,
  per-file SHA-256 manifest; copied to a disposable directory, re-hashed,
  0 discrepancies; disposable copy deleted. PASS.

Next single action: FOUNDER FINAL APPROVAL of the exact RC SHA and launch
window — production backup execution, production entity manifests for
Places/Offers, canary recipient selection, DB/hosting target confirmation,
and the rollback-trigger threshold are the remaining explicit founder
inputs before a CONDITIONAL GO can become a GO. See
`go-no-go-readiness-2026-07-29.md` for the full decision matrix.
```

```text
Phase: FINAL GO/NO-GO PREPARATION — remaining conditional gates closed
2026-07-30, same worktree/branch/RC SHA. Re-confirmed immutable: 0
non-docs diff since 17c9dd29787bbab0462ca581c546ca83a5dc2e73 (3 docs-only
commits on top, all under docs/migration/).

Closed this session:
- Places manifest FROZEN via a single bounded read-only WordPress-source
  preview (`migration:preview:wordpress-db --entity place
  --allow-remote-readonly`, zero writes, confirmed by the script's own
  docstring): 82 discovered, 78 SKIP_UNCHANGED, 4 UPDATE_CONFLICT (437,
  895, 5389 — previously known — plus 43023 "Атмосфера", newly confirmed,
  same TARGET_MODIFIED_AFTER_IMPORT pattern; `migration-manual-protected-
  places` memory updated). Hash and raw manifest in
  `docs/migration/manifests/places-preview-2026-07-30.json`.
- Offers manifest FROZEN from the already-reviewed committed local state
  (63/63 PUBLISHED Offers cross-referenced against active OFFER lineage,
  0 orphans) — the per-record WP-source tool
  (`migration:preview:offer-snapshot`) needs a pre-existing
  `offers-inventory.json` snapshot that has no generator and doesn't
  exist in this worktree; documented as an explicit blocker rather than
  silently worked around. Hash and raw manifest in
  `docs/migration/manifests/offers-local-manifest-2026-07-30.json`.
- Production-build console re-check: reused the existing `.next` build
  (unchanged since the RC SHA), ran `next start` on a separate port,
  repeated the exact StrictMode-error repro 5 times across 3 pages at
  390×844 — 0 console errors. Closed as
  `NOT_REPRODUCED_IN_PRODUCTION_BUILD`.
- Bounce handling decided: code inspection confirmed no `svix` dependency,
  no Resend webhook route, and `ActivationDeliveryAudit.status` has no
  bounced/complained/delivered states in its enum today — Option A
  (webhook) is not just "unwired," it doesn't exist. Decision: Option B,
  manual reconciliation against the Resend dashboard, gated batch-by-batch.
- All 4 deferred content items (Places 32409/60742 CITY_BLOCKED, Event
  64159 EXPIRED_SOURCE_PENDING, Route 46963 Mogilev CITY_BLOCKED) given
  explicit recommendations (3× EXCLUDE_FROM_P0, 1× MOVE_TO_P1) — none left
  in an undefined state.
- New docs: `launch-window-checklist-2026-07-30.md` (one-page day-of
  sequence); production target worksheet added to
  `production-migration-runbook-2026-07-29.md` §0 (all rows
  `FOUNDER_INPUT_REQUIRED`, none guessed).

Verdict updated: CONDITIONAL GO, narrower than 2026-07-29 — every gate
closeable from local/dev evidence or read-only source access is now
closed; only production-environment inputs remain (hosting/DB/storage
targets, canary recipients, batch-size approval, rollback threshold, and
founder sign-off on the deferred-content recommendations and the
manual-reconciliation bounce approach).

Next single action: FOUNDER FINAL APPROVAL of the exact RC SHA and launch
window, plus the 9 remaining founder inputs in
`go-no-go-readiness-2026-07-29.md`. No production actions were performed.
```

```text
Phase: PHOENIX OFFERS DOMAIN HASH TRANSITION — PLAN/TEST COMPLETE, OFFERS BLOCKED
2026-07-31, branch feat/phoenix-offers-artifact, baseline 779087b7.

A bounded read-only WordPress capture returned the exact committed 63 Offer
sourceRecordKeys (missing/extra/duplicates 0/0/0); raw source stayed mode 0600
under /private/tmp and was not committed. OfferDomainHashV2 now separates
domain identity from OfferExecutionPolicyHashV1. Frozen predecessor lineage
matched 63/63; only 16/63 fresh legacy NONE hashes matched. Full field-level
LOCAL reconciliation produced 0 lineage-only candidates, 0 safe whitespace
updates, and 63 unsupported multi-field conflicts (SEO + lifecycle on all;
additional slug/media/schedule/content subsets). Offers remains BLOCKED with
OFFERS_DOMAIN_HASH_TRANSITION_PENDING_DISPOSITIONS. No migration/database/media
writes, downloads, DEV/PROD access, deploy, or apply occurred.

Next single action: approve explicit lifecycle/SEO/slug/media/schedule update
contracts or exclusions for the 63 conflict records; do not perform a lineage
hash transition until every target-domain mismatch has a disposition.
```

```text
Phase: PHOENIX RELEASE BUNDLE — COMMON ADAPTER REGISTRY BUILT; PLACES OWNER-SCOPE GAP FOUND, HELD FOR REVIEW
2026-07-31, branch feat/phoenix-final-release-bundle (PR #102, still Draft).

Built the common production adapter registry (buildPhoenixAdapterRegistry,
src/lib/migration/release/adapters/registry.ts): one factory wiring all six
proven vertical slices (Users/Places/Offers/Routes/Events/Articles) to real
production dependencies, used identically for LOCAL/DEV/PROD, fail-closed on
missing/duplicate adapters and phase-order mismatches. Wired it into
scripts/migration-phoenix-release.ts's --apply/--rerun (previously a stub).
Bound the Articles manifest phase to READY with its already-proven
26-record scope artifact — the vertical slice was complete but the manifest
still carried its original narrative-only BLOCKED entry with 0 records.

New scripts/phoenix-full-bundle-clean-run.ts runs all six phases together
against a disposable schema — the first check exercising cross-entity
dependency resolution end-to-end rather than one entity in isolation. It
immediately found and let us fix a real bug (per-entity MigrationSource
rows broke cross-entity lineage lookups; now one shared MigrationSource for
the bundle), then surfaced a genuine scope gap, not a bug: 15 of the 78
approved Places (cascading to 20 of 63 Offers) are owned by a legacy
WordPress user outside the frozen 559-user Phoenix scope. Traced to three
distinct, already-known identities (see
docs/migration/phoenix-places-owner-scope-gap-2026-07-31.md for the full
breakdown): user:1 is the pre-existing target ADMIN, never migrated by
design; user:43 is one of the 5 founder-excluded Users records; user:129 is
one of the already-complete "manual/privileged 14" Users track (checklist
line 90) with its own resolved 9-Place ownership. Per explicit instruction,
this is a product-scope decision, not one the agent resolves unilaterally —
held for founder review, manifest untouched, no exclusion/expansion applied.

All Phoenix release/adapter tests, tsc --noEmit, and targeted ESLint pass
clean. Pushed. Full disposable clean-run and full rerun still pending on
this decision; cumulative adversarial review and PR #102 body update not
yet done.

Next single action: founder decision on the Places owner-scope gap (exclude
the 35 affected records vs. wire user:1/user:129 as resolvable dependencies
vs. other), per the three options in
docs/migration/phoenix-places-owner-scope-gap-2026-07-31.md.
```

```text
Phase: DOCS — checklist top-of-file restructured to release-mode operating
model
2026-08-03, docs-only, worktree mamago2-phoenix-checklist, branch
feat/phoenix-final-release-bundle (no commit/push performed).

The top of this file still claimed `PRODUCT REGRESSION / RC READINESS` /
`FINAL GO/NO-GO PREPARATION` (2026-07-29) as the current phase, while the
actual state had moved to the Phoenix final release bundle: exact SHA
`f466c34c0cf095d054ae79d86a12505129719739`, canonical manifest
`docs/migration/releases/phoenix-approved-2026-07-30.json`, DEV migration
image `mamago2-migrate:phoenix-f466c34c0cf0` built, transferred and loaded
on DEV with no plan/apply/rerun executed yet.

Replaced the header and added, in order: a single "Next one action"
callout, "Release mode: operating rules" (stop conditions and what does
NOT reopen closed work), "Final canonical release scope" (per-entity READY
counts + protected/adoption rules), "Phoenix release bundle — completed, do
not repeat", "Current blockers before DEV apply" (capacity gate / DEV plan
/ private frozen-content bundle — the primary open uncertainty), "DEV
rehearsal critical path", "PROD cutover critical path", and a three-track
"Launch readiness" matrix (migration / product-UAT / production
infrastructure). Moved the prior "INTEGRATED RC" block verbatim into an
"Appendix" as historical Product/UAT evidence. Added short pointer notes to
the pre-existing §8 (readiness percentages) and §9 (chronological handoff
log) so there is exactly one authoritative "current phase" and one
authoritative "next action" in the document; no historical content deleted.

`git diff --check`: clean. No code, Prisma, Dockerfile, manifest or release
artifact touched.

Next single action (docs track only): none — this file itself is now
current. The real next action is the one stated at the top: narrow DEV
capacity housekeeping, then one fixed-image DEV `--plan`, then locate/verify
the private frozen-content bundle.
```
