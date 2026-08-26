# Agent Instructions

CRITICAL: Before modifying the repository, run `scripts/git/session-start-gate.sh`. Repository work may start only when it reports that local `HEAD` exactly matches fresh `origin/dev`. If it reports stale, ahead, diverged, or tracked/staged work-in-progress, STOP and reconcile deliberately. Never use `reset --hard`, force-push, broad checkout/restore, or an automatic pull/rebase to make the gate green.

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
