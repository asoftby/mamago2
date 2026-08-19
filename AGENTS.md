# Agent Instructions

CRITICAL: Before using or merging any agent/worktree output, verify its base SHA against the current repository HEAD. Never copy stale worktree files over newer repository files.

The canonical repository instructions are in `CLAUDE.md`.

All agents MUST read and follow `CLAUDE.md` before modifying the repository.

In particular, the mandatory `Git / Worktree Safety` section applies to:
- subagents;
- background agents;
- temporary worktrees;
- parallel implementation tasks;
- interrupted/failed agent sessions;
- cherry-pick/patch/rebase integration.

If `AGENTS.md` and `CLAUDE.md` ever conflict, `CLAUDE.md` is canonical.
