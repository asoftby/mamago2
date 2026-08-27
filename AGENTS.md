# Agent Instructions

## Preferred automation — use it instead of making the user operate Git

For every repository-changing task, agents with repository shell access MUST use the repository workflow scripts themselves instead of asking the user to manually create branches/worktrees or repeat routine Git commands:

```bash
# from canonical dev
sh scripts/git/task-start.sh <slug> [prefix]

# from the task worktree
sh scripts/git/task-sync.sh
sh scripts/git/task-check.sh
sh scripts/git/task-finish.sh
```

Human shell shortcuts are available after `sh scripts/git/install-shell-shortcuts.sh`:

```bash
mgtask <slug> [prefix]
mgcheck
mgfinish
```

These commands automate the rules below; they do not relax them. If a script stops on dirty/diverged state, overlapping files, failed verification, or missing freshness proof, do not bypass the stop with reset, force push, broad restore, automatic rebase, or `--no-verify`. Read `docs/engineering/one-command-task-workflow.md` for the exact behavior.

## CRITICAL — mandatory start for EVERY repository-changing task

A "new task" means any distinct user request that may change repository files, even when it arrives in the same chat/session immediately after another task.

Before reading/modifying implementation files for a new task, the agent MUST establish a fresh, clean base from `origin/dev`:

1. In the canonical `dev` checkout, run `sh scripts/git/session-start-gate.sh` (normally through `task-start.sh`).
2. Repository work may start only when the gate reports PASS and local `HEAD` exactly matches fresh `origin/dev`.
3. Capture that exact SHA as `BASE_HEAD`.
4. Perform the task in an isolated task worktree/branch created from that exact `BASE_HEAD`; do not implement a new task directly in a shared/stale worktree.
5. Never reuse an old task worktree for a new task without re-validating it against fresh `origin/dev`.
6. Before integrating/pushing task output, fetch `origin/dev` again and verify whether it advanced since `BASE_HEAD`. If it advanced, reconcile the task deliberately on top of the new base and rerun relevant verification before integration.
7. If freshness cannot be proven, the tree is dirty with foreign work, or branches diverged: STOP repository modifications and report the state. Never make the gate green with `reset --hard`, force-push, broad checkout/restore, or automatic pull/rebase.

## CRITICAL — one task = one branch = one worktree = one PR; `dev` is merge-only

This is the mandatory integration model for every repository-changing task:

1. `dev` is an integration branch only. Do not implement features, fixes, refactors, chores, or documentation changes directly on `dev`.
2. Do not create normal task commits directly on `dev`, and do not push task commits directly to `dev`. `dev` advances through a reviewed/verified PR merge from a task branch.
3. Every distinct task gets its own task branch and its own isolated worktree, both created from the exact fresh `BASE_HEAD` captured from `origin/dev`.
4. A new distinct user request is a new task even inside the same chat/session. Do not append task B to task A's branch/worktree/PR.
5. One task branch may contain multiple commits only when all commits belong to that same task and are intended to be reviewed/merged together.
6. If unrelated work is discovered while implementing a task, do not fix it "while here". Record/report it and handle it as a separate task on a separate fresh branch.
7. Before opening/updating/merging a PR, fetch `origin/dev` again. If `dev` advanced, deliberately reconcile the task branch with the fresh base, inspect overlaps, and rerun relevant verification.
8. Before merge, verify that the PR diff contains only the intended task, relevant checks pass, and no foreign/stale changes are included.
9. After merge, treat the task branch/worktree as finished. The next task starts again from fresh `origin/dev`; never continue new work on the merged branch.
10. The canonical `dev` checkout should remain clean and be used for freshness/integration checks, not as an implementation workspace.

Recommended branch prefixes: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`.

**Core integration rule:** fresh `origin/dev` → exact `BASE_HEAD` → one isolated task branch/worktree → task-only commits → PR → verified merge into `dev`. No direct task development on `dev`.

Environment discipline:
- Git/GitHub commit SHA is the source of truth for code.
- `local`, DEV, and PROD are working/deployment environments, not independent sources of truth.
- Never make manual code edits directly on DEV or PROD.
- After a deploy, verify the environment reports the expected `gitSha`/build identity before claiming the change is deployed.
- PROD must be promoted from a known, verified Git commit/artifact; never treat a server filesystem as authoritative code.

CRITICAL: Before using or merging any agent/worktree output, verify its base SHA against the current repository HEAD. Never copy stale worktree files over newer repository files.

The canonical repository instructions are in `CLAUDE.md`.

All agents MUST read and follow `CLAUDE.md` before modifying the repository.

All agents MUST also obey the repository freshness gate and branch/PR integration model above. They supplement the `Task Start / Environment Consistency` and `Git / Worktree Safety` sections in `CLAUDE.md`; they do not replace them.

In particular, the mandatory `Git / Worktree Safety` section applies to:
- subagents;
- background agents;
- temporary worktrees;
- parallel implementation tasks;
- interrupted/failed agent sessions;
- cherry-pick/patch/rebase integration.

If `AGENTS.md` and `CLAUDE.md` ever conflict, `CLAUDE.md` is canonical.
