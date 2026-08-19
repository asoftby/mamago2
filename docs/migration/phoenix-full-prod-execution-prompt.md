# Phoenix FULL PROD migration — owner-controlled execution prompt

**Do not run this until:**

1. The readiness report is GREEN, and
2. live WordPress SSH from the operator Mac succeeds (`ssh user@134.17.16.78`), and
3. the owner explicitly starts a new session.

This file is a prompt, not an executed run.

A 2026-08-14 readiness session saw `https://mamago.by` HTTP 200 while
`134.17.16.78:22` timed out after a burst of inventory SSH. Reconfirm
SSH before any import.

## Absolute prohibitions (unchanged)

- Do not cut over `mamago.by` / DNS / indexing.
- Do not set `SITE_INDEXING_ENABLED=true`.
- Do not freeze or write WordPress.
- Do not run Prisma migrate on PROD.
- Do not deploy DEV/PROD as part of the importer.
- Do not move the runner onto the PROD host.

## Topology

```text
Owner Mac (VPN OFF)
  → ssh mamago-prod is 134.17.17.134:22 (health/disk only)
  → live WordPress 134.17.16.78 / mamago.by (SSH/HTTP read-only)
  → Phoenix process on the Mac
  → PROD DB `prodmamago` + PROD media storage
```

## Canonical flags

```text
--profile FULL_IMPORT --media-policy FULL
```

or `--profile PROD_IMPORT`. Never `--profile PRODUCTION` before cutover.

## Suggested order (stop on first error)

1. Fresh inventory (read-only):

   `pnpm migration:scope:wordpress-db --allow-remote-readonly --out ./phoenix-scope-live.json`

2. Users preview, then commit only with all three flags:

   `pnpm migration:user:live --preview --confirm-production --allow-remote-readonly`

   Writes: add `--confirm-writes --acknowledge-prod-user-import` (not `--preview`).

3. Places → Offers → Routes → Events → Articles → Reviews via

   `pnpm migration:commit:wordpress-db --entity <entity> --profile FULL_IMPORT --media-policy FULL --confirm-production --confirm-writes --allow-remote-readonly --context-config <prod-context.json>`

   `--confirm-production` is required because the target DB is `prodmamago`.
   Do not use `--profile PRODUCTION` (that profile requires indexing).

4. Re-run the same commands. Expect SKIP_UNCHANGED / reused media lineage.
   Do not add delete-sync.

5. Reconcile counts against the live scope JSON. One broken image must not
   abort the entity; failed media must appear in the report.

## After import (not this prompt)

- Search reindex is BACKLOG-105 (P2).
- Indexing and DNS remain owner-controlled cutover work.
