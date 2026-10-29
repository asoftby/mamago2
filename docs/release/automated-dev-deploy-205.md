# Issue #205 — opt-in DEV automatic deploy after Docker build

## Safety / activation state

**Disabled by default.** The existing owner-triggered Telegram deployment remains
the active release process until the owner has validated actual
`/opt/mamago/dev` Compose configuration and completed a controlled DEV rehearsal.
Merging this change does not enable auto-deploy or touch any live host.

When enabled, the `docker.yml` workflow's `deploy-dev` job runs only after
`build-and-push` succeeds for `dev`. It refuses superseded SHA, requires
a pinned `dev-N` tag and GHCR digest, and never targets `prod`.

### One-time setup (owner controlled)

1. Verify the host has `/opt/mamago/dev/.env` with **exactly one**
   `APP_VERSION=...` assignment and `docker compose -p dev config`
   resolves `app`, `worker`, `migrate` to the **same image**, with the
   database service unchanged when APP_VERSION is overridden.
   Confirm `dev-db-1` is healthy. If any check differs, do **not** enable.
2. Create a *dedicated*, restricted SSH deploy key whose access is limited
   to DEV deployment tasks on the host. Pin the host's real verified SSH key
   in known_hosts; never `ssh-keyscan` without out-of-band verification.
3. Generate an age encryption key offline. Keep the **private** age identity
   offline, securely backed up by the operator, **not** as a GitHub secret.
   Add only its public `age1...` recipient to Actions.
4. Configure GitHub secrets (prefer the `dev-auto-deploy` environment):
   `MAMAGO_DEV_SSH_HOST`, `MAMAGO_DEV_SSH_USER`,
   `MAMAGO_DEV_SSH_KEY`, `MAMAGO_DEV_SSH_KNOWN_HOSTS`,
   `MAMAGO_DEV_BACKUP_AGE_RECIPIENT`.
   Confirm that GitHub Actions GitHub-hosted runners can reach the SSH port.
5. Confirm off-host backup size and integrity, its encrypted artifact's
   retention (14 days), private-key decryption and disposable-DB restore.
   Build and migration test must be run against DEV, never PROD.
6. Rehearse the workflow on DEV when it is acceptable to deploy. Record
   before/after DB container ID/StartedAt, `prisma migrate status`,
   app+worker digest, public `/api/health.gitSha` and `buildId`.
   Confirm the previous image is still pullable for a **schema-compatible**
   rollback. Migrations might make previous images incompatible.
7. After the successful rehearsal and approval, set repository variable
   `MAMAGO_AUTO_DEPLOY_DEV=true`. Unset/false immediately disables
   further automatic deployments. During rollout, avoid simultaneously
   starting Telegram deployments of DEV; the CI lock only coordinates CI jobs.

### Execution order

1. Build and push immutable `dev-N` GHCR image (single build).
2. Verify build SHA is still HEAD of GitHub `dev`.
3. SSH over pinned known_hosts to DEV only; verify Docker access.
4. Stream PostgreSQL dump to ephemeral runner; verify gzip, completion
   marker, checksum; encrypt with age public key; remove plaintext.
5. Upload encrypted backup artifact. **If this fails, do not migrate.**
6. Recheck GitHub DEV SHA. Over SSH, compare live DB Compose configuration
   before/after `APP_VERSION` override, pin and verify image digest/SHA/build.
7. Atomically update only DEV `APP_VERSION`, run `migrate --no-deps`,
   require successful `prisma migrate status`, then `up -d --no-deps app worker`.
8. Require app+worker image-ID parity and unchanged DB container ID/StartedAt;
   poll public DEV `/api/health` until SHA/buildId match expected values.
9. Failed gates surface as failed GitHub Actions; **never claim DEV parity**.
   Any partial migration failure requires manual recovery. Do not blindly
   restore or roll back image after schema modifications.

### Known limitations / release gate

- The actual live host Compose files and SSH secret configuration are not
  stored in GitHub. Until inspected and tested on DEV, this is **code
  readiness only**, not proof of automated deployment working.
- Backups include personal data. Only **encrypted** artifacts may be uploaded;
  access to repository Actions artifacts must be restricted. Keep the offline
  decryption key available for a tested restore during the artifact retention.
  For stronger long-term retention, configure independent encrypted backup
  storage before relying on this as the sole recovery option.
- Changes that are incompatible with the still-running old app during
  migrations require an explicit staged-migration release plan.
- PROD deployment and the `promote.yml` workflow remain entirely manual;
  no `prod-*` tags are built or deployed here.
