# One-command task workflow

This is the preferred local workflow for every repository-changing mamaGo task.
It automates the existing safety model; it does not weaken it.

## Who should run it

When an agent has repository shell access (for example Claude Code), the agent should run these commands itself. The user should not be asked to create worktrees, sync `dev`, inspect routine diffs, or repeat Git commands unless a safety stop needs human judgment.

For ChatGPT sessions that can manage GitHub directly, ChatGPT should manage branch/PR mechanics directly and follow the same invariants.

The human shortcuts below exist as an emergency/manual interface, not as routine work for the product owner.

## One-time shell setup

Run this once from the canonical `dev` checkout after the workflow is present in `dev`:

```bash
sh scripts/git/install-shell-shortcuts.sh
source ~/.zshrc
```

The installer is idempotent and updates one marked block in `~/.zshrc` (or `~/.bashrc`).
It stores the canonical repository path in `MAMAGO_REPO` and provides three commands:

```bash
mgtask <slug> [prefix]
mgcheck [--allow-overlap]
mgfinish [--allow-overlap]
```

`prefix` defaults to `feat`; supported values are `feat`, `fix`, `refactor`, `chore`, `docs`, and `test`.
The shortcuts also switch to Node 22 automatically when `nvm` or `fnm` is available.
The repository additionally carries `.nvmrc` with Node 22.

## Normal task flow

For a human/manual session, the normal path is only:

```bash
mgtask stories-display-rules fix
# implement + commit + run task-specific targeted tests
mgfinish
```

`mgcheck` is an optional preflight when you want the full common gate before finishing. It is not required immediately before `mgfinish`, because the repository pre-push hook already runs `pnpm check:push` during `mgfinish`.

For an agent session, the agent should execute the equivalent repository scripts itself without asking the user to copy these commands.

## Start a task

Example:

```bash
mgtask stories-display-rules fix
```

`mgtask` does all of the mechanical setup:

1. always starts from the canonical `dev` checkout stored in `MAMAGO_REPO`;
2. runs `scripts/git/session-start-gate.sh` against fresh `origin/dev`;
3. if local `dev` is only behind and otherwise clean, applies only the gate-approved `git merge --ff-only origin/dev` and reruns the gate;
4. captures the exact `BASE_HEAD`;
5. creates a unique dated task branch from that exact SHA;
6. creates a separate worktree under `../mamago2-worktrees/` (or `MAMAGO_WORKTREES_DIR`);
7. verifies the worktree HEAD exactly equals `BASE_HEAD`;
8. records task metadata in the linked worktree Git metadata, not in tracked files;
9. changes the interactive shell into the new worktree.

If the canonical checkout is dirty, ahead, diverged, cannot fetch, or otherwise unsafe, the command stops instead of repairing history.

## Optional preflight

From the task worktree:

```bash
mgcheck
```

`mgcheck`:

1. fetches current `origin/dev`;
2. safely reconciles non-overlapping new `dev` commits into the task branch;
3. stops when both `dev` and the task changed the same file;
4. stops on any visible tracked, staged, or untracked WIP;
5. verifies the task branch contains current `origin/dev`;
6. shows the task-only diff file list;
7. runs `git diff --check`;
8. requires Node 22 and `pnpm`;
9. installs dependencies from the lockfile if the worktree has no `node_modules`;
10. runs `pnpm check:push`.

Targeted tests required by the task are still the agent/developer's responsibility. `mgcheck` is the common repository gate, not a replacement for task-specific verification.

### Overlapping `dev` changes

If `origin/dev` advanced and changed files also modified by the task, automatic reconciliation stops and prints those files.
After deliberately reviewing the overlaps, rerun:

```bash
mgcheck --allow-overlap
```

or, when finishing directly:

```bash
mgfinish --allow-overlap
```

This only authorizes the explicit merge attempt. Normal Git conflict handling still applies; the script never resets, force-pushes, or replaces files wholesale.

## Finish a task

After task changes are committed and task-specific tests are complete:

```bash
mgfinish
```

`mgfinish`:

1. re-fetches and reconciles current `origin/dev` using the same overlap guard;
2. requires the task worktree to be fully clean, including no untracked task files;
3. verifies the task-only diff;
4. pushes the task branch normally;
5. lets the existing pre-push hook run `pnpm check:push` — no `--no-verify` bypass;
6. opens a PR to `dev` automatically when GitHub CLI (`gh`) is available;
7. otherwise prints that PR creation is the only remaining step.

It never merges the PR automatically. The responsible agent still has to verify current base, relevant CI/checks, and the task-only diff before merging.

## Direct script equivalents

Agents or environments that do not use the interactive shortcuts can call the repository scripts directly:

```bash
# canonical dev checkout
sh scripts/git/task-start.sh <slug> [prefix]

# task worktree
sh scripts/git/task-sync.sh
sh scripts/git/task-check.sh      # optional common preflight
sh scripts/git/task-finish.sh
```

Agents with repository shell access should execute these themselves. They should not ask the user to manually create branches/worktrees or repeat routine Git commands unless a safety stop requires human judgment.

## Safety invariants

The workflow preserves these existing rules:

- fresh `origin/dev` is the only task base;
- exact `BASE_HEAD` is recorded before implementation;
- one task = one branch = one worktree = one PR;
- `dev` is merge-only;
- no reset-hard, force push, automatic rebase, broad checkout/restore, or `--no-verify`;
- foreign/unrelated work is never silently absorbed;
- visible untracked WIP blocks task reconciliation/finish instead of being silently ignored;
- if `dev` advances, overlapping files require deliberate review;
- task-specific tests remain required;
- deployment environments never become a source of truth.

## Regression test

The repository CI runs:

```bash
sh scripts/git/task-workflow.test.sh
```

The test uses temporary local Git repositories and verifies exact-base task creation, safe fast-forward of stale canonical `dev`, non-overlapping task sync, untracked-WIP blocking, overlap blocking, and idempotent shell shortcut installation.
