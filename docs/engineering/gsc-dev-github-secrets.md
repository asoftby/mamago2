# Manual GSC DEV configuration through GitHub Secrets

This is a **staging workflow**, not a deployment workflow. Nothing in this PR
runs on the server merely by merging it. No workflow was dispatched, secret
retrieved, server configuration changed, migration run or container restarted
while preparing this change. Related implementation: #705 / #708; tracking: #702.

## Why the JSON secret alone is insufficient

`GSC_SERVICE_ACCOUNT_JSON_DEV` is stored in GitHub; Docker Build & Push does not
forward it to runtime. Do not add it as an image build argument or layer.
The existing repository deployment remains owner-only through Telegram.
The new `gsc-dev-config.yml` accepts only manual dispatch on `dev`, by `asoftby`,
with exact confirmation `STAGE_GSC_DEV`. It stages files only. `enabled` defaults
to false; selecting true requires the owner to have verified that the GSC code
and cache migration are already deployed to DEV. No automatic migration or
activation check against a real DB is performed.

The client validates the JSON identity and RSA private key in memory, streams
JSON over pinned SSH, and never uploads artifacts or prints extracted fields.
The receiver allows only the fixed DEV directory and fixed mamaGo GSC identity:
`mamago-gsc-reader@mamago-2-0.iam.gserviceaccount.com`, `sc-domain:mamago.by`.
It cannot stage arbitrary projects, paths, shell commands or PROD configuration.

## Prerequisites — owner operations, not executed by this PR

1. **Workflow registration.** The current default branch is `main`. GitHub
   requires a manually dispatched workflow to be available on the default
   branch. A PR targeting `dev` alone does not register a new workflow there.
   The owner must separately arrange a reviewed, narrow registration of this
   workflow in the default branch. Do not merge all of dev into main or change
   the default branch merely to make a button appear. The job still refuses
   any selected execution ref other than `dev`.
2. **Restricted SSH receiver.** On the shared DEV/PROD host, install the reviewed
   `scripts/deploy/stage-gsc-dev.py` from a known Git SHA as a root-owned,
   non-writable-by-ubuntu file at `/usr/local/libexec/mamago-stage-gsc-dev.py`.
   Python 3 and OpenSSL are prerequisites. Provision
   `/opt/mamago/dev/gsc-config` owned by `ubuntu`, mode `0700`, with no symlinked
   parent directories. Do not use the PROD directory.
3. Create a **dedicated** SSH key for this one operation. Install only its public
   key for `ubuntu`, with the following forced-command restrictions in the
   authorized key entry (replace the public-key placeholder):

   ```text
   restrict,command="/usr/bin/python3 -I /usr/local/libexec/mamago-stage-gsc-dev.py --receive" ssh-ed25519 PUBLIC_KEY gsc-dev-staging
   ```

   The receiver additionally requires `SSH_ORIGINAL_COMMAND=stage-gsc-dev`.
   Other commands, interactive shells, scp/sftp, port/agent forwarding and PTYs
   must remain unavailable to this key. Never reuse an unrestricted operator
   SSH private key. Receiver installation/update and authorized-key provisioning
   are separate owner-approved infrastructure actions.
4. Add the repository secrets:

   | Name | Content |
   | --- | --- |
   | `GSC_SERVICE_ACCOUNT_JSON_DEV` | Existing complete service-account JSON, already added by owner |
   | `GSC_DEV_SSH_PRIVATE_KEY` | Dedicated restricted SSH private key, not the Google key |
   | `GSC_DEV_SSH_KNOWN_HOSTS` | Verified known_hosts entry for `134.17.17.134` |

   Verify the SSH host key using the owner's already trusted access. The
   workflow deliberately does not run ssh-keyscan and trust its live answer.
   A host-key change fails closed and requires owner verification. Do not paste
   secret values into chat, issues, workflow inputs, logs or PR comments.

## Manual staging and later runtime adoption

After the prerequisites and code review, select **Stage GSC DEV configuration**
in Actions, choose branch **dev**, enter `STAGE_GSC_DEV`, and leave enabled
false for initial staging. This document does not authorize executing it.

The receiver validates the complete payload before writing anything. It writes
a mode-0700 generation directory containing:

- `web.env`: enabled flag and exact property only;
- `worker.env`: enabled flag, exact property, service-account email and key.

Both files are mode `0600`. A lock serializes writes, and one atomic
`gsc-config/current` symlink swap publishes the pair. A malformed payload or
write failure keeps the previous pair. No existing `.env` file is read or
rewritten. Old generation directories remain protected and retained for owner
rollback; remove obsolete generations through the owner's secret-retention
process after successful rotation. No old Google key is revoked automatically.

`ops/compose.gsc-dev.yml` is an additive **DEV-only** override pointing app and
worker at the separate current files. Deliver this reviewed override through
the existing release process and include it in the owner's normal DEV Compose
invocation, alongside the existing compose files. The workflow does **not**
install/modify Compose configuration or execute it. Without this adoption,
staged files do not affect running containers or future deployments. Serialize
staging with the owner's DEV deployment: Compose opens the two files separately
and must not race a concurrent pointer rotation.

Before enabling collection, verify the deployed code/build identity and
`20261022120000_gsc_query_cache` migration using the existing deployment
procedure. Re-stage with enabled=true only when ready; then the owner separately
runs the normal DEV deployment/recreation. A plain `docker restart` does not
load new container environment values. Verify app/worker Git SHA and the SEO
property/period/KPIs as described in `google-search-console.md`. No PROD action
is part of this workflow.

Rollback: the owner may repoint `current` to a previously validated generation
(or stage enabled=false), then use the normal DEV recreation procedure. Staging
or repointing alone does not alter an already-running process environment.
Never print the env files or unfiltered `docker inspect` output to verify them;
check only required variable names/presence and non-secret build identity.

## Verification performed without real secrets

`python3 scripts/deploy/stage-gsc-dev.test.py` generates a synthetic RSA key
in memory and checks identity validation, invalid PEM and interpolation refusal,
private key newline encoding, atomic publication/failed-write rollback,
permissions, path/command restrictions, client redaction, and workflow guards.
The test is part of CI and the shared push gate. It does not contact GitHub,
Google, SSH, DEV, PROD, or any database. Live SSH transfer, workflow registration,
receiver installation and DEV runtime adoption remain owner prerequisites.

References:
- [GitHub manual workflow dispatch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [OpenSSH authorized key restrictions](https://man.openbsd.org/sshd.8)
