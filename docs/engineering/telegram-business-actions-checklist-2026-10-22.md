# mamaGo Business Telegram Bot — actions checklist (2026-10-22)

Dependencies: PR #692 (independent Business Bot and opt-in routing), PR #696 (signed confirmation action foundation). Both merged into `dev` on 2026-10-22.

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
- [x] GitHub CI passed on PR #696, including the final run after PR #692 was merged (45/45 steps)
- [ ] Full local repository task-check on the final GitHub changes (not verifiable without terminal access)
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
- [x] GitHub CI re-run succeeded (45/45), and PR #696 merged into `dev` as `27dc4d7040a96b640edd1ce8c0acbc57cf0a366b`
- [ ] Wire webhook actions, run database integration tests and deploy DEV in later PRs

## Run 2 — GitHub integration and acceptance gate (2026-10-22)

- [x] Review PR #692 diff, change overlap, existing tests and CI, and merge with expected SHA (`b7515150`)
- [x] Review PR #696 diff and reviews; refresh CI after #692 merged; 45 steps PASS
- [x] Merge PR #696 into `dev` with expected SHA (`27dc4d70`)
- [x] Keep Business Bot delivery disabled by default; no bot credentials, DEV/PROD deployments or callbacks enabled
- [ ] Create separate integration PR for verified Business Bot webhook callbacks, with runtime tests and actor lookup
- [ ] Confirm/decline/change-price/room choice through existing booking state machine and PartyOutbox
- [ ] Set up BotFather DEV credentials and run DEV E2E checks; do not enable PROD without acceptance

**Status:** Foundations integrated in `dev`, not deployed or operational. Checklist checkboxes reflect code and CI evidence only; no Telegram live smoke test has been performed.
