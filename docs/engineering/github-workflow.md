# GitHub workflow — mamaGo.by 2.0

## Branches and environments
- `dev`: development integration branch. Feature and bug-fix PRs target `dev`.
- `main`: release branch. Production releases must be reviewed and tested independently.
- Feature branches: `feat/<scope>-<short-description>`, `fix/<scope>-<short-description>`, `chore/<scope>-<short-description>`, `docs/<scope>-<short-description>`.
- Do not push directly to protected branches, force-push shared branches, or delete unmerged branches without examining outstanding changes.

## PR lifecycle
1. Open PR into `dev`, reference the relevant Issue, document scope and acceptance criteria.
2. Validate checks, schema/migrations, UI on affected breakpoints, and permissions where applicable.
3. Resolve discussions and check that similar PRs do not already exist.
4. Merge only when checks pass and changes are compatible with current `dev`.
5. Record deployment tag/SHA and verify the deployed runtime SHA separately from GitHub merge.
6. Promote tested state of `dev` to `main` via an explicit release PR; never treat a green `dev` build as proof that production is already updated.
7. Have a rollback and DB migration strategy before production deployment.

## Suggested triage dimensions
- Type: bug / feature / chore / docs / security.
- Area: family, plan, birthday, events, places, offers, b2b, seo, infra, auth, design-system.
- Priority: P0 (critical), P1 (high), P2 (normal), P3 (low).
- State: needs-triage, ready, blocked, in-progress.
Only use labels already configured in repository; labels must be created in GitHub settings before applying new names.

## Existing safeguards and outstanding audits
- `dev` has an active ruleset. Do not weaken it without a documented justification.
- As of 2026-10-21, `main` and `dev` are divergent; examine the four `main`-only commits before release integration.
- PR #617 and #635 may overlap (DEV authentication cookies).
- PR #380 and #381 reflect older birthday-constructor work; #381 has merge conflicts.
- Review Issue #653 for the complete cleanup backlog.

## Change policy
Organizational cleanup alone must not close PRs, delete unmerged branches, rewrite history, modify secrets, merge releases or deploy code.
