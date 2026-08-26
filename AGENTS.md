# Agent Instructions

## CRITICAL — mandatory start for EVERY repository-changing task

A "new task" means any distinct user request that may change repository files, even when it arrives in the same chat/session immediately after another task.

Before reading/modifying implementation files for a new task, the agent MUST establish a fresh, clean base from `origin/dev`:

1. In the canonical `dev` checkout, run `sh scripts/git/session-start-gate.sh`.
2. Repository work may start only when the gate reports PASS and local `HEAD` exactly matches fresh `origin/dev`.
3. Capture that exact SHA as `BASE_HEAD`.
4. Perform the task in an isolated task worktree/branch created from that exact `BASE_HEAD`; do not implement a new task directly in a shared/stale worktree.
5. Never reuse an old task worktree for a new task without re-validating it against fresh `origin/dev`.
6. Before integrating/pushing task output, fetch `origin/dev` again and verify whether it advanced since `BASE_HEAD`. If it advanced, reconcile the task deliberately on top of the new base and rerun relevant verification before integration.
7. If freshness cannot be proven, the tree is dirty with foreign work, or branches diverged: STOP repository modifications and report the state. Never make the gate green with `reset --hard`, force-push, broad checkout/restore, or automatic pull/rebase.

Environment discipline:
- Git/GitHub commit SHA is the source of truth for code.
- `local`, DEV, and PROD are working/deployment environments, not independent sources of truth.
- Never make manual code edits directly on DEV or PROD.
- After a deploy, verify the environment reports the expected `gitSha`/build identity before claiming the change is deployed.
- PROD must be promoted from a known, verified Git commit/artifact; never treat a server filesystem as authoritative code.

CRITICAL: Before using or merging any agent/worktree output, verify its base SHA against the current repository HEAD. Never copy stale worktree files over newer repository files.

The canonical repository instructions are in `CLAUDE.md`.

All agents MUST read and follow `CLAUDE.md` before modifying the repository.

All agents MUST also obey the repository freshness gate above. It supplements the `Git / Worktree Safety` section in `CLAUDE.md`; it does not replace it.

In particular, the mandatory `Git / Worktree Safety` section applies to:
- subagents;
- background agents;
- temporary worktrees;
- parallel implementation tasks;
- interrupted/failed agent sessions;
- cherry-pick/patch/rebase integration.

If `AGENTS.md` and `CLAUDE.md` ever conflict, `CLAUDE.md` is canonical.
