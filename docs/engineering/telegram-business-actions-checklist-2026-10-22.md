# mamaGo Business Telegram Bot — actions checklist (2026-10-22)

Dependencies: PR #692 (independent Business Bot and opt-in routing). This PR is a distinct action-safety phase.

## Run 1 — signed confirmation command

- [x] Audit existing `confirmPartyRequest` and PartyOutbox transaction/version/idempotency logic
- [x] HMAC-signed callback token under Telegram's 64-byte limit, bound to recipient private chat
- [x] Verify command expiry, chat binding and constant-time signature comparison
- [x] Unit tests for valid/altered/expired/wrong-chat callbacks
- [x] Service adapter with active OWNER/MANAGER + ACTIVE business recheck
- [x] Reuse existing transactional confirmPartyRequest rather than updating booking directly
- [x] Stable idempotency key derived from signed callback and chat
- [x] Targeted TypeScript, ESLint and contract tests on prepared local worktree
- [x] Prisma migrations applied to a disposable, isolated local PostgreSQL 16
- [ ] Full repository task-check and GitHub CI on this remote PR (local full run started but final result could not be retrieved due to remote terminal quota)
- [ ] Hook up trusted Business Bot actor resolver and webhook after #692 is integrated
- [ ] Add DB integration tests for duplicate presses, quote-version races and access revocation
- [ ] Implement decline, changed offer terms, multiple booking units and safe interactive responses
- [ ] Create/configure DEV Business Bot; verify E2E flow before PROD

## Release guard

No webhook callback is enabled by this PR. The action service is inert until a separately reviewed integration wires a verified Business Bot webhook and actor lookup. Existing Info Bot behavior stays unchanged. Do not deploy as a complete working Business Bot.

## Integration checkpoint — 2026-10-22

- [x] PR #692 merged to `dev` as `b75151504a8f4e6a1d417c373eab0a7a5956b9f7`; default Business Bot delivery remains disabled
- [x] PR #696 has no overlapping changed files with PR #692 or intervening `dev` commits
- [x] PR #696 original GitHub CI passed
- [ ] Verify GitHub CI again against the latest `dev` before merging PR #696
- [ ] Wire webhook actions, run database integration tests and deploy DEV in later PRs
