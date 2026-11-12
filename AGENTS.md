# Agent Instructions

## Product Challenge — mandatory before substantive work

For **every new task or material change**, assess product value, user/business UX, smallest viable solution, existing-code reuse, architecture/ACL/security, and **runtime efficiency** (DB/API query count and cost, N+1, payload, caching, latency, hosting load). Challenge the request when a simpler or safer approach gives the same result. Avoid feature expansion, duplicate engines, and unmeasured performance claims.

Before substantive coding, briefly recommend **DO / SIMPLIFY / DEFER (STOP)** with the expected UX/efficiency impact and a testable acceptance outcome. Ask for one focused decision **only when** a real trade-off changes approved scope, UX, cost, security or release priorities. Routine bug fixes and already-approved, unambiguous implementation **must proceed without repetitive questions**. Reassess if new evidence changes the plan; do not silently expand scope.

**Current RC1 focus:** families find truthful, bookable/accessible activities through «Куда пойти», and businesses self-register and publish Place/Event/Offer. Release scope / GO-NO-GO: GitHub issue **#1103**, acceptance **#1101/#1102**. Suggest deferring unrelated CRM, Family OS, design polish and new features; never use this rule to bypass required freshness, review, CI, security, migration or deployment gates.

The full canonical Product Challenge policy and precedence are in `CLAUDE.md`. All agents MUST follow it.


## ChatGPT-first development — two first-class modes

ChatGPT is the default task coordinator. Select **GitHub Direct** for work that can be correctly implemented/reviewed through repository APIs and verified by the applicable GitHub CI; select **Local Assisted** when local execution, browser/UI verification, a database, integration tests, debugging or build diagnosis are needed. Agents choose the mode based on task risk and available tools; do not ask the owner to operate Git, Codex, or Claude Code as a routine prerequisite. Both modes use a fresh `dev` SHA, isolated task branch, task-only PR, architecture checks, and required final-SHA CI/review. GitHub Direct does not run a local hook and must never claim it did; if GitHub CI cannot prove the required behavior, switch to Local Assisted or add an appropriate CI check. A local worktree is mandatory only in Local Assisted; GitHub Direct instead uses a dedicated remote branch.

## Preferred Local Assisted automation — use it instead of making the user operate Git

When Local Assisted mode is selected, agents with repository shell access MUST use the repository workflow scripts themselves instead of asking the user to manually create branches/worktrees or repeat routine Git commands:

```bash
# from canonical dev
sh scripts/git/task-start.sh <slug> [prefix]

# from the task worktree: targeted checks, commit, then finish
sh scripts/git/task-finish.sh
# task-sync.sh and task-check.sh are optional; avoid redundant full gate runs
```

Human shell shortcuts are available after `sh scripts/git/install-shell-shortcuts.sh`:

```bash
mgtask <slug> [prefix]
mgcheck
mgfinish
```

These commands automate the rules below; they do not relax them. If a script stops on dirty/diverged state, overlapping files, failed verification, or missing freshness proof, do not bypass the stop with reset, force push, broad restore, automatic rebase, or `--no-verify`. Read `docs/engineering/one-command-task-workflow.md` for the exact behavior.

## CRITICAL — fast delivery without weakening verification

Speed means eliminating duplicated work, not bypassing safety. For every task:

1. Define a minimal task-only scope, acceptance criteria, and risk level. Reuse already verified repository context; avoid unrelated refactors and repeated exploratory scans.
2. During implementation, use focused tests and lint for changed areas, plus relevant type checks. Do not run production builds after each edit.
3. **Run the full local push gate once by default at `task-finish.sh`.** Its pre-push hook already runs `pnpm check:push`; do not routinely run `task-check.sh` just before finishing. Use `task-check.sh` only if an earlier full preflight is actually needed. The current scripts do **not** cache the result: if both commands run, the gate runs twice.
4. `task-check.sh` and the pre-push hook share a worktree-local PASS proof only for the exact unchanged HEAD, clean tree, current `origin/dev`, installed dependencies, Prisma Client, Node/pnpm and gate environment. Changes or missing proof run the full gate. Never skip the pre-push hook, use `--no-verify`, or claim an unrun check passed.
5. Serialize memory-heavy builds per host; parallelize only independent, lightweight tasks. Preserve per-worktree dependencies and the isolated Next.js build directory.
6. Keep targeted security/regression checks proportional to risk (especially authentication, family ACL, personal data, payments, booking, concurrency, and migrations). Required CI/review on the **current PR HEAD** and fresh-base/overlap checks remain blocking for merge.
7. Avoid busy-polling CI or repeating already answered status checks. Report the actual SHA, verified checks, blockers, and next action, without implying a PR was merged or deployed before proof exists.

See the canonical **Fast and safe execution** section in `CLAUDE.md` for the risk-based verification table, architecture ownership checks, GitHub-only workflow, secret/data rules, and distinction between follow-up fixes on one open PR and a genuinely new task. **Never use `package.json` Prisma migrate-dev/reset scripts, even when named `safe`.** All existing freshness, branch/worktree, hook, CI, and deployment safety rules remain mandatory.

## CRITICAL — server efficiency and fast responses are acceptance criteria

For **every code-changing task**, protect user-perceived latency **and** server cost, especially Afisha/Discovery, family recommendations, business onboarding and Place/Event/Offer editors. Before adding reads/writes/fetches, identify request frequency, number of database/API round trips, payload size, cache scope and invalidation, and any external/AI charges. Never introduce avoidable N+1 queries, unbounded fetches, duplicate client/server requests, unnecessary polling, heavy work on page load, or broad revalidation on every draft save. Prefer bounded indexed queries, minimal selected fields, reuse of existing domain services, deduped requests, appropriately scoped caching and lazy loading. Private/family/business data must **never** enter a cross-user cache.

For affected **hot paths**, include before/after or representative evidence (queries per action, latency/p95 where measurable, response bytes, cache behavior, external call count); when measurement is unavailable, state the limitation and do not claim a speedup. Do not optimize by breaking freshness, authorization, data integrity or the product contract. Follow **Server cost, latency and resource discipline** in `CLAUDE.md`; the older `docs/audits/performance-architecture-audit.md` is historical context only, not current code truth.

## CRITICAL — mandatory start for EVERY repository-changing task

A "new task" means any distinct user request that may change repository files, even when it arrives in the same chat/session immediately after another task.

Before modifying implementation files for a new task, the agent MUST establish the exact fresh base SHA from `origin/dev`. In **Local Assisted**, use the canonical `dev` checkout and `sh scripts/git/session-start-gate.sh` (normally through `task-start.sh`). In **GitHub Direct**, read the current remote `dev` SHA through GitHub and create a dedicated branch at that exact SHA; there is no local checkout, so do not invent a local gate result. The detailed Local Assisted steps are:
2. Repository work may start only when the gate reports PASS and local `HEAD` exactly matches fresh `origin/dev`.
3. Capture that exact SHA as `BASE_HEAD`.
4. Perform the task in an isolated task worktree/branch created from that exact `BASE_HEAD`; do not implement a new task directly in a shared/stale worktree.
5. Never reuse an old task worktree for a new task without re-validating it against fresh `origin/dev`.
6. Before integrating/pushing task output, fetch `origin/dev` again and verify whether it advanced since `BASE_HEAD`. If it advanced, reconcile the task deliberately on top of the new base and rerun relevant verification before integration.
7. If freshness cannot be proven, the tree is dirty with foreign work, or branches diverged: STOP repository modifications and report the state. Never make the gate green with `reset --hard`, force-push, broad checkout/restore, or automatic pull/rebase.

In **GitHub Direct**, perform the equivalent remote-SHA/branch/reconciliation checks through GitHub rather than these local shell commands; `session-start-gate.sh` cannot be run through the GitHub API.

## CRITICAL — one task = one branch = one PR (+ isolated worktree in Local Assisted); `dev` is merge-only

This is the mandatory integration model for every repository-changing task:

1. `dev` is an integration branch only. Do not implement features, fixes, refactors, chores, or documentation changes directly on `dev`.
2. Do not create normal task commits directly on `dev`, and do not push task commits directly to `dev`. `dev` advances through a reviewed/verified PR merge from a task branch.
3. Every distinct task gets its own branch created from exact fresh `BASE_HEAD` captured from `origin/dev`; **Local Assisted** additionally requires an isolated worktree. **GitHub Direct** makes commits only through its dedicated remote branch.
4. A genuinely separate user request is a new task even inside the same chat/session. Corrections and review feedback within an open PR that preserve the same acceptance contract stay in that PR; do not append unrelated task B to task A's branch/worktree/PR.
5. One task branch may contain multiple commits only when all commits belong to that same task and are intended to be reviewed/merged together.
6. If unrelated work is discovered while implementing a task, do not fix it "while here". Record/report it and handle it as a separate task on a separate fresh branch.
7. Before opening/updating/merging a PR, fetch `origin/dev` again. If `dev` advanced, deliberately reconcile the task branch with the fresh base, inspect overlaps, and rerun relevant verification.
8. Before merge, verify that the PR diff contains only the intended task, relevant checks pass, and no foreign/stale changes are included.
9. After merge, treat the task branch/worktree as finished. The next task starts again from fresh `origin/dev`; never continue new work on the merged branch.
10. The canonical `dev` checkout should remain clean and be used for freshness/integration checks, not as an implementation workspace.

Recommended branch prefixes: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, `test/`.

**Core integration rule:** fresh `origin/dev` → exact `BASE_HEAD` → isolated task branch (plus isolated worktree for Local Assisted) → task-only commits → PR → required final-SHA CI/review → verified merge into `dev`. No direct task development on `dev`.

Environment discipline:
- Git/GitHub commit SHA is the source of truth for code.
- `local`, DEV, and PROD are working/deployment environments, not independent sources of truth.
- Never make manual code edits directly on DEV or PROD.
- After a deploy, verify the environment reports the expected `gitSha`/build identity before claiming the change is deployed.
- PROD must be promoted from a known, verified Git commit/artifact; never treat a server filesystem as authoritative code.

CRITICAL: Before using or merging any agent/worktree output, verify its base SHA against the current repository HEAD. Never copy stale worktree files over newer repository files.

The canonical repository instructions are in `CLAUDE.md`.

All agents MUST read and follow `CLAUDE.md` before modifying the repository.

All agents MUST also obey the repository freshness rules (local gate in Local Assisted; equivalent remote-SHA check in GitHub Direct) and branch/PR integration model above. They supplement the `Task Start / Environment Consistency` and `Git / Worktree Safety` sections in `CLAUDE.md`; they do not replace them.

In particular, the mandatory `Git / Worktree Safety` section applies to:
- subagents;
- background agents;
- temporary worktrees;
- parallel implementation tasks;
- interrupted/failed agent sessions;
- cherry-pick/patch/rebase integration.

If `AGENTS.md` and `CLAUDE.md` ever conflict, `CLAUDE.md` is canonical.

## Recommendation architecture — do not fork by surface

Before changing recommendations, personalization, ranking feedback, Telegram подборки, My Plan recommendations, Home recommendations, or Discovery recommendation behavior, read `docs/architecture/recommendation-data-foundation.md`.

Mandatory rule: Telegram, My Plan, Home, Discovery and future delivery surfaces consume one shared recommendation/learning foundation. Surface-specific code may define composition/delivery policy, but must not create a duplicate recommendation engine, duplicate behavior weights, or separate feedback truth. `UserEvent` remains raw behavior truth; `RecommendationRun` / `RecommendationExposure` record what the shared pipeline returned; outcomes link back to those exposures.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
