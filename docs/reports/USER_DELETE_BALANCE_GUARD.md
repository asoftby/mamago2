# USER_DELETE_BALANCE_GUARD

## Problem

Users could delete their account even if they are the `ownerUserId` of a Business that has a `BillingAccount` with `depositBalance > 0`. This caused:

- Loss of financial trail (orphaned billing state)
- Inability to recover or refund the balance
- Cascade delete of the Business via `onDelete: Cascade` on the `owner` relation

## Solution

Added a pre-deletion balance guard that checks **before** any transaction or cascade cleanup begins.

### Guard Logic

1. Query `Business` where `ownerUserId = user.id`
2. Include `billingAccount.depositBalance` and `billingAccount.status`
3. If `billingAccount` exists **and** `depositBalance > 0` → return `409 Conflict`

The guard does **not** check `billingAccount.status` — even `SUSPENDED` accounts with a positive balance are blocked. The balance must be zero before deletion is allowed.

### Files Changed

| File | Change |
|------|--------|
| [`src/app/api/user/delete/route.ts`](../../src/app/api/user/delete/route.ts) | Added balance guard before `$transaction` (hard delete) |
| [`src/app/api/me/delete/route.ts`](../../src/app/api/me/delete/route.ts) | Added balance guard before `$transaction` (soft delete) |

### HTTP Response

```
POST /api/user/delete
→ 409 Conflict
{
  "error": "Нельзя удалить аккаунт с активным балансом бизнеса. Обратитесь в поддержку."
}
```

### Edge Cases Covered

| Scenario | Behaviour |
|----------|-----------|
| User has no business | Pass — deletion proceeds |
| User owns business, no billing account | Pass — deletion proceeds |
| User owns business, billing account, balance = 0 | Pass — deletion proceeds |
| User owns business, billing account, balance > 0 | **Blocked** — 409 Conflict |
| User owns business, billing account SUSPENDED, balance > 0 | **Blocked** — 409 Conflict |
| User owns business, billing account CLOSED, balance > 0 | **Blocked** — 409 Conflict |
| User is BusinessMember (not owner) | Pass — guard only checks `ownerUserId` |

### Non-goals

- No Prisma schema changes
- No UI changes
- No changes to business deletion flows
- No changes to admin user deletion

### Future Considerations

- If admin force-delete is needed, add an admin-only bypass endpoint
- Consider adding a withdrawal/refund flow so users can zero out their balance before deletion