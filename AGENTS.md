# Agent Instructions

The canonical instructions for every coding agent (Claude Code, Codex, Cursor, ChatGPT) are in [`CLAUDE.md`](CLAUDE.md). Read it before modifying the repository and follow it; this file intentionally does not repeat it.

Non-negotiables, in short (details in `CLAUDE.md`):

- One task = one branch from fresh `origin/dev` = one PR into `dev`. `dev` is merge-only. Never commit or push directly to `dev`/`main`.
- Never `reset --hard`, force-push, `--no-verify`, or copy stale worktree files over newer code.
- Never run `prisma migrate dev` / `prisma db push`; migrations are hand-written SQL applied with `prisma migrate deploy`.
- Audit for an existing implementation before building; reuse/extend instead of duplicating.
- Recommendations: one shared engine for all surfaces — see `docs/architecture/recommendation-data-foundation.md`.

If this file and `CLAUDE.md` ever conflict, `CLAUDE.md` wins.
