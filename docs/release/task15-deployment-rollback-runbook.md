# Task 15 — First-PROD Deployment & Rollback Runbook

**Status:** planning document. Read-only audit, no deployment performed.
**Scope:** first PROD deploy = `prod.mamago.by` **preview** (noindex, isolated
cookies/OTP/Telegram, no `mamago.by` DNS/WordPress change). Not the real
production cutover. See `docs/release/dev-to-prod-checklist.md` Task 15 for
the audit trail and Task 14 for environment-parity evidence this runbook
depends on.

**Deploy execution is owner-only, triggered manually via Telegram.** This
runbook is what the owner (or an agent doing owner-approved, read-only
verification) follows before and after that action. No step here is
self-executing.

---

## 0. Host / architecture facts (confirmed this session)

- DEV and PROD run on the **same physical host** (`134.17.17.134`, SSH alias
  `mamago-prod`, hostname `ubuntu`), as separate Docker Compose projects:
  `dev` at `/opt/mamago/dev`, `prod` at `/opt/mamago/prod`, plus a shared
  `traefik` project. They do **not** have independent disks — a DEV backup,
  DEV image pulls, or DEV disk pressure directly affects PROD's headroom and
  vice versa.
- Root filesystem: `/dev/mapper/ubuntu--vg-ubuntu--lv`, ext4-on-LVM,
  **28G total, 18G used, 8.8G free (67%)** as of this audit. Docker itself
  lives on this same filesystem (`docker system df`: 12.65GB images, 1.69GB
  build cache).
- Containers confirmed running: `prod-app-1` / `prod-db-1` (image
  `ghcr.io/asoftby/mamago2:prod-152`, digest
  `sha256:cbf8b61e17e266b88e6a3ce6648b78b778bea261c65b526314d9260b4f366172`,
  label `org.opencontainers.image.revision=ec157f86cfda270442ea3d2b33e4c4372016ab1f`),
  `prod-prisma-studio-1`, `traefik`. `prod-migrate-1` exists as a **separate
  one-shot migration container** (already `Exited (0)`) — confirms the
  compose stack already separates "run migrations" from "run the app",
  the app's own `docker-entrypoint.sh` does **not** run migrations (only an
  opt-in system seed gated by `MAMAGO_RUN_SYSTEM_SEED_ON_START=true`).
  `dev-app-1`/`dev-db-1`/`dev-migrate-1` mirror the same pattern for DEV.
  No container is restarting or unhealthy; `prod-db-1`/`dev-db-1` report
  Docker `healthy`. Neither app container has a Docker `HEALTHCHECK`
  defined (no `Health` status) — `/api/health` (checks DB connectivity)
  exists in-app and is the smoke-test endpoint to poll instead.
- Image provenance is **already solved, no code change needed**: every
  image built by `.github/workflows/docker.yml` carries standard OCI labels
  including `org.opencontainers.image.revision` = the exact source commit
  SHA. `docker inspect <image> --format '{{index .Config.Labels
  "org.opencontainers.image.revision"}}'` always proves what commit is
  running.
- **Disk capacity finding (revises prior assumption):** the underlying
  virtual disk is **already 100GB** (`lsblk`: `vda` 100G), but only
  `vda3` (28.2G) is partitioned/in the LVM volume group — roughly **70GB is
  unpartitioned, already present on the disk, doing nothing.** This is a
  **local partition/LVM extension**, not a cloud-provider disk resize. See
  §7 (Disk headroom) for the exact commands. This lowers the cost/risk of
  the previously-planned 30→80GB capacity fix considerably — no provider
  ticket, no downtime expected, no data migration — but it is still a
  write operation on shared DEV+PROD infrastructure and is **not executed
  by this runbook**; it needs the owner's own `sudo` session.

## 1. Deploy source (owner decision, resolved this session)

**Decision:** deploy from `dev`, not `main`.

Why this was a real decision, not an assumption: `.github/workflows/docker.yml`
only tags an image `prod-<run_number>` when the push ref is `refs/heads/main`;
a `dev` push only ever produces `dev-<run_number>` (and rolling `dev`/`latest`
is main-only too). `main` is currently **539 commits / 1430 files** behind
`dev` (last `main` update: PR #32, 2026-06-20 — before any of Tasks 1–14).
Producing a `prod-*` tag the "normal" way would require merging that entire
gap into `main` first — a single, essentially unreviewable PR, purely to
satisfy a branch-name convention for a **noindex preview**, not the real
cutover.

**Resolved rule — no CI/workflow code change required:**

1. First-PROD source SHA = the exact `dev` commit that is already green in
   CI (`ci.yml`) **and** already owner-smoked on deployed DEV (same bar
   Tasks 1–14 already used).
2. Image identity = the `ghcr.io/asoftby/mamago2:dev-<run_number>` image
   `docker.yml` already builds automatically on every `dev` push — same
   build-args (`REDIRECT_MANIFEST_MIN_ROWS`, Google Maps key/Map ID) for
   `dev` and `main`, so a `dev-*` image is byte-for-byte what a `prod-*`
   build of the same commit would produce. Runtime behavior (cookie domain,
   `APP_ENV`, indexing) comes entirely from `/opt/mamago/prod`'s own
   persistent `.env` + compose file, not from the image tag.
3. Before deploying, **re-tag the same already-built image as `prod-<N>`
   in GHCR with no rebuild**, so it:
   - matches the operator-facing naming convention already used on the
     PROD host (`prod-152` etc.),
   - falls into the separate `prod-*` retention pool that
     `cleanup-ghcr.yml` prunes conservatively (`keep-at-most: 3`), instead
     of the `dev-*` pool — which churns fast (multiple builds/day) and
     would otherwise prune the exact image PROD is running within days,
     leaving no re-pullable copy if the host's local Docker cache is ever
     cleared.

   **Canonical mechanism: `.github/workflows/promote.yml`** (manual
   `workflow_dispatch`, inputs `dev_tag` / `prod_tag`). It runs the exact
   same `docker buildx imagetools create` registry-side copy previously
   done by hand, but additionally: inspects and records the source digest
   before promoting, inspects the destination digest after, and **fails
   the run** if they don't match byte-for-byte — a promotion can never
   silently produce a different image than the one that was reviewed and
   smoked on DEV. It never SSHes or touches the deploy host; it only
   writes a new tag to the registry. Run it from the Actions tab (or `gh
   workflow run promote.yml -f dev_tag=dev-<N> -f prod_tag=prod-<N>`)
   instead of running the command locally.

4. Do **not** rebuild on `main` to produce a `prod-*` tag. `docker.yml`'s
   build trigger is `dev`-only by design (no `main` branch trigger exists
   in that workflow at all) — this is what makes "one immutable image,
   promoted, never rebuilt" hold structurally rather than by convention.
   `main` may still run its own CI/security checks; it must never gain an
   independent Docker build step for the application image again. If a
   future change to `docker.yml` re-adds a `main` trigger, treat that as
   a regression of this decision, not a routine CI tweak.

5. The real `dev` → `main` merge (git history, not image builds) is
   **deferred** to the actual future `mamago.by` cutover decision, where
   it can go through normal review instead of being forced by a CI tag
   rule.

## 2. Database migrations

- Repo currently has **231** migrations under `prisma/migrations/`
  (`prisma migrate dev`/`db push` are forbidden in this repo — see
  `CLAUDE.md`; all migrations are hand-written, applied via
  `prisma migrate deploy` only).
- `pnpm db:migrate:deploy` runs `pnpm db:preflight` first
  (`scripts/db-preflight.mjs`), which **refuses to run against any
  non-local `DATABASE_URL` host** (only `localhost`/`127.0.0.1`/`::1`/`db`
  are allowed) — this is exactly why migrations run from a one-shot
  `*-migrate-1` container on the Docker network (hostname `db`), never
  from a laptop pointed at the host's public IP. Existing, correct,
  **do not change**.
- **PROD's last-applied migration is unknown as of this audit** — SSH to
  the host was intermittent this session and the DB query never completed
  (see §8). `prod-app-1` is still running the pre-Task-1 image
  (`ec157f86`, 2026-06-19), so PROD's schema is almost certainly dozens of
  migrations behind the current 231. **Confirmed destructive migrations
  exist in that gap**, e.g. `20260622204217_phase4a_drop_offer_birthday_details`
  (`DROP TABLE "OfferBirthdayDetails"`) and
  `20260701140000_direct_module_polish`
  (`ALTER TABLE "DirectMessage" DROP COLUMN "hiddenReason"`) — found by
  scanning the 30 most recent migrations for `DROP`/`TRUNCATE`; there may
  be more further back. **Do not assume the pending set is purely
  additive — verify with `prisma migrate diff`/`migrate status` at
  pre-flight time, per §3 step 3.**
- Per `docs/data-policy.md`: **"Production data never resets."** PROD DB is
  migrated forward (`db:migrate:deploy`), never `migrate reset`/`db push`.
  This is already-decided project policy, not a new decision for Task 15.
- This is exactly why the DROP-COLUMN/DROP-TABLE finding above matters for
  rollback (§6): once applied, those two migrations are **not
  reversible** by redeploying the old app image — see §6.

## 3. Pre-flight checklist (run immediately before any real deploy — this
session's audit data is not a substitute for a fresh check)

1. `git -C <clean checkout> rev-parse dev` and confirm CI is green for that
   SHA (`gh run list --workflow=ci.yml --branch=dev --limit=1`) and it has
   already been owner-smoked on deployed DEV.
2. Confirm the matching image exists and carries the right label:
   ```bash
   ssh mamago-prod "docker inspect ghcr.io/asoftby/mamago2:dev-<N> \
     --format '{{index .Config.Labels \"org.opencontainers.image.revision\"}}'"
   # must equal the dev SHA from step 1
   ```
   (pull it on the host first if not already cached:
   `ssh mamago-prod "docker pull ghcr.io/asoftby/mamago2:dev-<N>"`)
3. Migration diagnostics (read-only, run from inside the `prod` compose
   network so `db:preflight`'s localhost-only guard is satisfied — e.g. via
   the existing `prod-migrate-1` service/image, not from a laptop):
   ```bash
   pnpm prisma migrate status
   pnpm prisma migrate diff --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma --script
   ```
   If the diff contains `DROP`/destructive `ALTER` beyond what step 4's
   backup already covers for — stop and review manually before proceeding
   (see `docs/audits/migration-baseline-deploy-runbook.md` for the full
   decision matrix this project already uses for migration diagnosis).
4. **Backup** (§4) — must complete and be verified before step 5.
5. Disk headroom check:
   ```bash
   ssh mamago-prod "df -h / && docker system df"
   ```
   If free space is under ~5GB after accounting for the new image pull
   (~2.2GB) plus working room, prune known-safe reclaimable candidates
   first (see §7) — do **not** pull the new image into a full disk.
6. Confirm target is still `prod.mamago.by` only: no `mamago.by` DNS
   change, `APP_ENV` on `/opt/mamago/prod/.env` still not `production`,
   `SITE_INDEXING_ENABLED` still unset/false — per Task 14's explicit
   guardrail.

## 4. Backup

No existing backup script in this repo can safely back up a **remote**
container's DB without landing the dump on that same disk-constrained host
(`scripts/db/backup.sh`, `backup-sql.sh`, `scripts/backup-local-db.sh` are
all hardcoded to the local `mamago2-db` compose container and a local
`backups/` directory). Added `scripts/deploy/backup-remote-db.sh`, which
streams `pg_dump` over SSH directly into a file on the **operator's own
machine** — nothing is written to the host's 8.8GB-free root disk:

```bash
scripts/deploy/backup-remote-db.sh mamago-prod prod-db-1
# -> ~/mamago-backups/prod-db-1/prod-db-1-<timestamp>.sql.gz (+ .sha256)
```

It reads `POSTGRES_USER`/`POSTGRES_DB` from the target container's own
environment (no credentials needed on the operator's machine, nothing
hardcoded/guessed), verifies the container is running first, and refuses to
leave a partial file on failure. Restore command (destructive — printed by
the script, never auto-run):

```bash
gunzip -c ~/mamago-backups/prod-db-1/prod-db-1-<ts>.sql.gz | \
  ssh mamago-prod "docker exec -i prod-db-1 sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'"
```

Restore is a manual, deliberate action — intentionally not scripted further
(single wrong target argument on a one-click restore script is a bigger risk
than one documented command run by a human who reads it first).

## 5. Deploy order

1. Backup (§4), verified non-empty + checksum recorded.
2. Migration diagnostics (§3 step 3) reviewed, no unexplained destructive
   diff.
3. `pnpm prisma migrate deploy` via the existing `prod-migrate-1`-style
   one-shot service (owner-triggered).
4. `pnpm prisma migrate status` → confirm "up to date".
5. Pull + start the new image for **both `app` and `worker` together**
   (`dev-<N>` re-tagged `prod-<N>`, §1) via the existing `prod` compose
   project (owner-triggered via Telegram) — e.g.
   `docker compose pull app worker && docker compose up -d app worker`.
   **Never update only `app`.** `app` and `worker` are the same image with
   a different command (see the root `docker-compose.yml` comment on the
   `worker` service) and must move together on every deploy — a prior
   audit found them five `dev-*` builds apart after a deploy that only
   updated `app`, which is exactly the failure mode this step exists to
   prevent. If the host's compose files don't yet pin both services to one
   shared image reference, treat that as a prerequisite fix, not something
   to work around by remembering to run two commands correctly by hand.
6. Post-deploy digest verification (mandatory, see §6d) — confirm the
   deployed pair actually matches before calling the deploy done.
7. Smoke (§6b below / Task 17's own smoke list once reached).

Media/content import is explicitly **out of scope for this first PROD
preview** — Task 15's exit criteria is about the deploy/rollback mechanism,
not about populating `prod.mamago.by` with Phoenix-migrated content. What
content the first preview should show (whatever's already in `prod-db-1`
today, forward-migrated; vs. a deliberate content-population pass) is a
separate, later product decision — noted, not decided or blocked on here.

## 6. Rollback

### 6a. Known irreversible limitation (read this first)

**"Redeploy the previous Docker image" is not a full rollback once
`migrate deploy` has run**, because:

- Prisma migrations in this repo are hand-written and one-directional —
  applied migrations are never edited; a schema change is undone only by a
  new forward migration or a full DB restore (`CLAUDE.md` Prisma rules).
- At least one destructive migration (`DROP TABLE "OfferBirthdayDetails"`,
  `DROP COLUMN "DirectMessage"."hiddenReason"`) is confirmed pending
  somewhere between PROD's current (unknown, likely ~June-era) migration
  state and today's 231. The **old** app image (`prod-152`,
  `ec157f86`) was built against the schema **before** those drops. If the
  new schema is applied and something then goes wrong for reasons
  unrelated to the schema, redeploying `prod-152` on top of the
  post-migration schema risks the old code touching a table/column that no
  longer exists.

### 6b. Decision tree

| Failure point | Safe rollback |
|---|---|
| New image fails to become healthy, **before** `migrate deploy` ran | Trivial — old `prod-app-1`/`prod-152` container was never stopped; no action, or explicitly re-`docker compose up -d` the old tag if it was stopped. |
| `migrate deploy` itself fails partway | Do **not** redeploy the old app image. Follow `docs/audits/migration-baseline-deploy-runbook.md`'s failed-migration recovery (fix + `migrate resolve`, or restore from the §4 backup) before touching the app. |
| Migrations applied cleanly, **new app** is broken for non-schema reasons (bug, bad config) | Fix forward and redeploy a new image against the **new** schema. Do **not** roll back to `prod-152` — it is schema-incompatible now. |
| Migrations applied, new app broken in a way that requires reverting the schema itself | Full DB restore from the §4 backup (real data loss for anything written in PROD between backup and incident — acceptable here only because PROD is a noindex preview with no real users yet; would need a different plan at real cutover), then redeploy `prod-152` (or whichever old image matches the restored schema) against the restored DB. |
| `app` and `worker` are found running different digests in the same environment | Not a code bug to fix forward — it's a process failure. Re-run `docker compose pull app worker && docker compose up -d app worker` together immediately so both land on the same digest. Then find out why the shared-image-reference config didn't prevent it (e.g. someone ran a bare `docker restart`/`docker run` on one container instead of going through compose) — that's the thing to actually fix. |

### 6c. Configuration rollback

`/opt/mamago/prod/.env` and the compose file are host-local, not
version-controlled in this repo (confirmed: no compose/env files for the
deploy host exist in git — `docker-compose.yml` at repo root is the local
dev-only file). Any config change on the host should be preceded by the
operator saving a copy of the current file before editing — no script
needed for this, it's a single `cp`.

### 6d. Mandatory post-deploy digest verification

Run after every deploy to either environment, not just PROD — this is
what makes the app/worker drift row above something you catch immediately
rather than discover in a later audit:

```bash
ssh mamago-prod "docker inspect prod-app-1 prod-worker-1 dev-app-1 dev-worker-1 \
  --format '{{.Name}}: {{.Image}}'"
```

Required invariants, checked in this order:

1. **DEV app digest == DEV worker digest** — `dev-app-1` and `dev-worker-1`
   must always agree; `dev` deploys automatically per push, so any gap
   here means the DEV deploy step itself didn't update both containers.
2. **PROD app digest == PROD worker digest** — same requirement, checked
   after every PROD deploy (§5 step 6). This is the exact invariant that
   was found violated (`prod-app-1` on `dev-373`, `prod-worker-1` still on
   `dev-368`, five builds behind) before this section existed.
3. **Immediately after a PROD promotion, PROD digest == the promoted DEV
   digest** (i.e. `prod-app-1`/`prod-worker-1` == the `dev-<N>` image named
   in that promotion's `promote.yml` run, per the digest recorded in its
   job summary). Confirms the promotion actually reached the host, not
   just the registry.

**What is *not* required**: DEV and PROD staying equal at all other
times. PROD intentionally lags DEV between releases — `dev` gets a new
image on every push, PROD only moves forward on a deliberate, owner
promotion. Do not treat `DEV digest != PROD digest` on its own as a
finding; it is the normal, expected state between releases. Only
invariants 1–3 above are mandatory.

## 7. Disk headroom (pre-flight prune candidates + resize plan)

**Prune candidates found this session (not removed — listed for the
operator to act on at pre-flight time, not blindly automated):**

- `phoenix-dev-rerun-c53d380cc4a2` / `phoenix-dev-rerun-0e35d863ebdf` /
  `phoenix-dev-continue-apply-0e35d863ebdf` — exited 9 days ago, plus their
  images `mamago2-migrate:phoenix-*` (~2.14GB each). Old Phoenix migration
  one-off runs, not part of the `dev`/`prod` compose projects.
- `prod-migrate-1` — exited migration container from the last PROD
  migration run 5 weeks ago; safe to remove once superseded by the next
  migration run.
- Old `dev-*`/`prod-*` app images beyond the last 2–3 (each ~2.16GB) —
  `cleanup-ghcr.yml` already prunes the **registry**, this is about the
  **local Docker cache** on the host, which is separate.
- `docker system df` reports 1.386GB already reclaimable as dangling.

**Disk resize (owner action, not run this session):**

Read-only topology confirmation (no `sudo` required for these three):

```bash
ssh mamago-prod 'lsblk; findmnt -no FSTYPE /; docker system df'
```

`sudo` is required for the rest and this session had no non-interactive
sudo — the owner needs to run these themselves (or grant passwordless sudo
for read-only diagnostics specifically, never for the write steps):

```bash
# Confirm exact free space / VG / LV names before extending anything:
sudo parted -s /dev/vda print free
sudo pvs; sudo vgs; sudo lvs

# Proposed extension (matches the already-approved 80GB target; leaves
# ~18GB of the disk's ~98GB available headroom unused as margin — this is
# NOT the full +100%FREE, intentionally):
sudo growpart /dev/vda 3
sudo pvresize /dev/vda3
sudo lvextend -L 80G /dev/ubuntu-vg/ubuntu-lv
sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv   # if ext4 (confirm via findmnt above)
# or: sudo xfs_growfs /                             # if xfs

# Verify:
df -h /; lsblk; sudo vgs; sudo lvs
```

This is a **local LVM operation on the disk that's already there** — not a
cloud-provider ticket, no expected downtime (`growpart`/`pvresize`/
`lvextend`/`resize2fs` are all online-safe on a mounted ext4 root in
standard practice), but it still touches shared DEV+PROD infrastructure
live. Recommended: run it during low-traffic hours, after a fresh §4-style
backup exists, and confirm the read-only topology output first — the VG/LV
names above (`ubuntu-vg`/`ubuntu-lv`) are inferred from the device-mapper
name `ubuntu--vg-ubuntu--lv` (double-dash-escaped single dashes is standard
LVM naming) with high confidence but were not `sudo`-confirmed this
session.

## 8. What this session could not verify live

SSH to `mamago-prod` was intermittent throughout this audit (worked
briefly, then repeatedly timed out — consistent with prior sessions'
notes on this host). Confirmed live: disk usage, `docker ps`/`images`,
container health/restart counts, image labels/digests. **Not confirmed
live** (commands given above for the next session that has stable access):
PROD's exact `_prisma_migrations` count/pending list, `/opt/mamago/prod`
compose file structure, exact free-disk headroom after pruning, and `sudo`
partition/LVM topology. None of these change the plan above — they are
exactly the kind of thing §3's pre-flight checklist re-checks fresh
regardless of when the last audit ran.
