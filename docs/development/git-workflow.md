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

## Before Push Checklist

- [ ] `pnpm build` passes with no errors
- [ ] `git status` is clean — no untracked or uncommitted files
