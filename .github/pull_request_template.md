## Summary
<!-- What changed and why? Link the related issue: Closes #... / Relates to #... -->

## Scope & impact
- Area:
- User-facing change:
- API / data / permissions impact:

## Verification
- Session-start gate result and exact `BASE_HEAD`:
- Latest observed `origin/dev` SHA and reconciliation/overlap review:
- Isolated task branch/worktree:
- Exact tested commit SHA and check links:
- [ ] TypeScript / typecheck passed
- [ ] ESLint passed
- [ ] Relevant automated tests passed
- [ ] `pnpm check:push` passed (mandatory task verification; provide run result)
- [ ] If build-only validation was performed instead, document why and mark the mandatory check above incomplete
- [ ] Manual validation (mobile and desktop where applicable)

## Database & compatibility
- [ ] No Prisma schema or migration change
- [ ] Migration is included and checked for deploy compatibility (if applicable)
- [ ] Backward compatibility with current PROD and DEV was reviewed (if applicable)

## Release & rollback
- Deployment considerations:
- Rollback approach:
- Feature flags / environment variables:

## UI evidence (if relevant)
<!-- Before/after screenshots or a short recording. -->

## Risk / known limitations
<!-- Include incomplete work, unresolved checks and follow-up issues. -->

## Merge readiness
- [ ] Fresh `origin/dev` is contained in the task branch; diff remains task-only
- [ ] CI checks passed
- [ ] No unresolved review threads
- [ ] Target branch is correct
- [ ] No unrelated changes
