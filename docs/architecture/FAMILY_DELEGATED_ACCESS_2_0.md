# Family Access 2.0 — audit and incremental implementation contract (2026-10-21)

## Confirmed baseline on dev
- `src/server/family/familyInvite.service.ts`: `createFamilyInvite` issues SHA-256-hashed, 32-byte random invitation tokens; current `expiresAt: null` intentionally means no expiry; maximum three active links per family. `acceptFamilyInvite` requires shared-data consent and joins via `FamilyMembership(role: ADULT)`, possibly merging personal data.
- `src/server/family/familyInvitePure.ts`: active and usable checks understand nullable expiration.
- `src/server/family/familyMembers.service.ts`: OWNER/ADULT members, leave and ownership transfer; leaving moves own PRIVATE plan items into a solo family, but preserves shared family items.
- `src/server/family/familyAccess.ts`, `familyScope.ts`: plan/child read scopes are based on active `FamilyMembership`. A family member can see FAMILY plan entries (subject to FROM_JOIN history boundary); there is no individual-entry grant check in these scopes.
- `src/server/family/planVisibility.service.ts`: PRIVATE/FAMILY visibility is author-driven and does not imply delegated write authorization.

## Important conclusion
DO NOT implement nanny/grandparent guest access as `FamilyMembership(role: ADULT)` or silently extend `planItemScopeWhere` to include all guest family items. That would expose non-delegated events and potentially children. Preserve existing adult invitations, join/consent/merge semantics and three-link quota unchanged.

## New flow
1. Owner or authorized adult opens **Мой план → Доверить расписание** or **Участники и доступ → Пригласить помощника**.
2. Choose named entries (and optionally selected occurrences of a recurring entry), invite recipient, access start/end, invitation acceptance deadline (default 48 hours), and one of three access levels: VIEW, ASSIST, MANAGE.
3. Recipient signs in to an own account, accepts a one-time token. Acceptance must NOT merge the recipient's family or create an ADULT membership; helpers may work for multiple families.
4. Restricted guest plan lists only current, explicitly granted PlanItem IDs; entry details return only allowed fields. No child profile, personal history, sibling items, family roster, private notes, or family-wide feed.
5. Helper may confirm assignment completion with ASSIST/MANAGE, propose reschedule with ASSIST/MANAGE, and directly reschedule an entrusted plan entry only with MANAGE.
6. A proposed reschedule retains existing schedule until owner approves. A direct reschedule updates only the PlanItem after optimistic conflict check; an actual reservation or external provider booking is NEVER changed implicitly.
7. Owners see the event actor, action and timestamps and get notifications on reschedule/cancellation/completion. Any authorized owner can revoke access immediately; revocation also affects list, detail, mutation, calendar, Telegram, and link access.
8. Existing adult family membership remains a separate flow. Guest access is scoped to a family, guest user, individual plan entry, allowed action, and date window. Revocation/expiration are not cron-dependent.

## Proposed schema, to be reconciled with current Prisma models
- `FamilyGuestInvitation`: id, familyId, createdById, tokenHash (unique), intendedEmail? (optional account binding), roleLabel, status, expiresAt, acceptedById?, acceptedAt?, revokedAt?, createdAt.
- `FamilyGuestAccess`: id, familyId, userId, invitationId?, startsAt, endsAt?, permissionLevel VIEW|ASSIST|MANAGE, revokedAt?, createdById, createdAt, updatedAt.
- `FamilyGuestPlanGrant`: accessId, planItemId, optionally occurrence identity for recurring entries. Unique(accessId, planItemId, occurrence).
- `PlanDelegationAction`: id, familyId, planItemId, actorUserId, actionType, before/after JSON metadata, status PENDING|APPLIED|REJECTED, createdAt, resolvedAt?, resolvedById?.
- Plan completion must be tracked as delegation/assignment completion, not falsely as attendance at an event.

## Server authorization contract
- Keep existing `planScopeFor` semantics for adults.
- Introduce a **separate** `resolveDelegatedPlanAccess(userId, planItemId, action, now)` with DB verification of active guest, family, period, grant, and permission. Call from EVERY guest list/detail/mutation endpoint, not merely UI.
- For mutation, authorize and update in a transaction, lock/check item state or optimistic `updatedAt`, enforce actual permission at write time, and write audit event atomically.
- Do not attach guest accounts to `activeFamilyUserIds`, `childScopeFor`, `FamilyScope`, shared analytics or recommendation context.
- Invite tokens: secure random generated once, hash stored, single-use, fixed expiry, revoked/accepted checks in transaction, no tokens in logs. Existing adult invites stay unchanged.
- A user may be a guest of multiple families. Family owner cannot revoke membership of a guest's *own* family.
- Never send private details in notifications or Telegram beyond authorized fields; reauthorize callback on each action.

## Incremental rollout gates
P0: schema + migration; isolated guest invite acceptance; owner revocation; unit/integration ACL tests for unrelated events, private items, multiple families, expired grant, revoked grant and concurrency.
P1: grant selection UX, restricted plan list/details, ASSIST completion and proposed changes, notifications and audit.
P2: MANAGE direct rescheduling (not provider bookings), per-occurrence recurring permission and Telegram synchronization.
Feature flag `FAMILY_DELEGATED_ACCESS` defaults OFF and must not enable automatically in PROD.

## Acceptance criteria
- Guest can see **only** explicitly granted entries while active.
- Guest cannot enumerate ungranted PlanItem IDs through direct API, analytics, export, calendar, notification, or Telegram.
- Expiration and revoke take effect at the next request without waiting for cron.
- OWNER can revoke; existing adults' joining, sharing and leaving still work.
- ASSIST cannot directly mutate the schedule; MANAGE can alter authorized PlanItem scheduling only; changes are attributed and observable.
- No changes to booking provider schedules or purchased tickets solely due to a PlanItem edit.
- Full Prisma generation, typecheck, lint, unit, integration, auth/privacy regression and CI checks are required before merging.

## Status
Audit complete against inspected dev code; this document is an implementation contract, NOT a claim that feature functionality or migrations are already delivered.
