# Phoenix release runner

`migration:phoenix-release` is the thin operational coordinator around the
existing Phoenix entity runners. It does not redefine migration transformations
or product scope.

## Commands

```bash
pnpm migration:phoenix-release \
  --environment DEV \
  --manifest docs/migration/releases/phoenix-approved-2026-07-30.json \
  --plan
```

`--plan` verifies the release manifest and every referenced artifact hash,
queries `current_database()` read-only, verifies the deployment, storage, email
and indexing gates, and prints the exact executable, protected, excluded and
blocked scope. It performs no migration or storage writes.

`--apply` and `--rerun` fail closed while the manifest contains any `BLOCKED`
phase. PROD additionally requires `--confirm-production`.

Reports use append-only JSON Lines and contain safe database/storage
fingerprints only. Credentials and the full `DATABASE_URL` are never serialized.

## Required deployment environment

- `APP_ENV=LOCAL|DEV|PROD`
- `PHOENIX_DATABASE_ENV=LOCAL|DEV|PROD`
- `PHOENIX_STORAGE_ENV=LOCAL|DEV|PROD`
- `DATABASE_URL` from the environment secret store
- `PHOENIX_STORAGE_PROVIDER`
- `PHOENIX_STORAGE_LOCATION`

The three environment markers must exactly match `--environment`. A marker is
an explicit deployment identity assertion, not a hostname heuristic. The runner
also verifies the URL database name against `current_database()`.

Activation delivery must remain disabled during content migration.
Non-production indexing must remain disabled.

## Container builds

The runner calls `git rev-parse HEAD` to stamp every plan/apply/rerun report
with the exact code SHA that produced it. Git and `.git` are intentionally
absent from the migration image, so that call would fail there.

Migration/Phoenix images must be built from the dedicated `phoenix-migrate`
Dockerfile stage, not `builder`:

```bash
docker buildx build \
  --target phoenix-migrate \
  --build-arg PHOENIX_CODE_SHA=<exact commit sha> \
  --tag mamago2-migrate:phoenix-<short-sha> \
  .
```

`PHOENIX_CODE_SHA` must be the exact 40-character lowercase hexadecimal commit
SHA the image was built from; the build fails otherwise. That value is baked
into `/app/.phoenix-code-sha` (read-only) inside the image and also set as the
`org.opencontainers.image.revision` OCI label — it is not exposed through a
mutable runtime environment variable.

At runtime, `resolveCodeSha()` (`scripts/migration-phoenix-release.ts`) prefers
`/app/.phoenix-code-sha` when present, and only falls back to
`git rev-parse HEAD` when that file is absent — which is what happens during
ordinary local execution from a real checkout. If the baked file exists but is
empty, malformed, or unreadable for a reason other than "file does not exist",
resolution fails closed and does not fall back to Git.

## Current approved release

The committed manifest is generated from already-approved artifacts:

```bash
pnpm migration:phoenix-release:generate-manifest
```

The generator does not query a database or WordPress and does not invent missing
scope. Places are executable from the frozen preview; redirects are validation
only. Users, Businesses, Offers, Routes, Events and Articles remain explicitly
blocked until the prerequisites recorded in the manifest exist as executable
frozen artifacts.

Place `wordpress-db:places:5457` remains in the exact Place scope with expected
action `SKIP_UNCHANGED`.
