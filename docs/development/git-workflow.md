# Git Workflow

## Commit Format

```
<prefix>: <short description>
```

Keep the description lowercase, imperative, and under 72 characters.

### Prefixes

| Prefix     | When to use                                      |
|------------|--------------------------------------------------|
| `feat`     | New feature or user-facing functionality         |
| `fix`      | Bug fix                                          |
| `refactor` | Internal code change with no behavior change     |
| `ui`       | UI/UX improvements                               |
| `perf`     | Performance improvements                         |
| `chore`    | Config, dependencies, tooling, maintenance       |
| `docs`     | Documentation only                               |
| `ci`       | CI/CD pipeline changes                           |

### Examples

```
feat: add available plan dates endpoint
fix: resolve session overlap in event wizard
refactor: improve event wizard flow
ui: polish event page and admin components
perf: optimize import publishing flow
chore: update routing and config
docs: add git workflow guidelines
ci: add build check on pull request
```

---

## Automated Checks

These checks run automatically via [Husky](https://typicode.github.io/husky/) git hooks.

### commit-msg

Every commit message is validated by [commitlint](https://commitlint.js.org/) against the rules in `commitlint.config.cjs`.
A commit with an invalid message (wrong prefix, subject too long, etc.) will be rejected immediately.

### pre-push

The actual `.husky/pre-push` calls `scripts/git/run-push-gate.sh`, which checks this worktree's Prisma/dependency state and runs **`pnpm check:push`**, including TypeScript, selected regressions and the production build. A bare `pnpm build` is **not** equivalent proof.

For normal tasks use `scripts/git/task-start.sh` → focused task tests → commit → `scripts/git/task-finish.sh` (sync, task diff and normal push with full pre-push gate). `task-check.sh` is optional and repeats the gate `task-finish.sh` will run; avoid calling both routinely. See `docs/engineering/one-command-task-workflow.md` and binding safety rules in `CLAUDE.md`.

- [ ] Exact task-only diff reviewed and worktree clean before final push
- [ ] Targeted tests for changed behavior pass
- [ ] Normal push hook passes; no `--no-verify` or skipped failed checks
- [ ] Required GitHub CI and review pass on the **latest PR HEAD** before merge
