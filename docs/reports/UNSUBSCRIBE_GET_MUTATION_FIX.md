# Unsubscribe GET Mutation Fix

## Problem

The `/u/[token]` page was calling `processUnsubscribe(token)` directly during server-side rendering (GET request). This meant that any prefetch — by email clients, antivirus scanners, link preview bots, or proxy caches — would immediately unsubscribe the user without their explicit consent.

## Root Cause

In [`src/app/u/[token]/page.tsx`](../../src/app/u/[token]/page.tsx), the `processUnsubscribe` function was invoked at the top level of the server component:

```ts
const { token } = await params;
const result = await processUnsubscribe(token); // ← mutation on GET
```

This function performed a database write (`prisma.user.update`) to set `marketingEmailsEnabled = false`.

## Solution

### Architecture Change

| Before | After |
|--------|-------|
| GET `/u/[token]` → immediately unsubscribes | GET `/u/[token]` → shows confirmation page |
| No user confirmation | User must click "Да, отписаться" |
| Mutation in server component | Mutation in server action (POST) |

### Files Changed

1. **`src/app/u/[token]/page.tsx`** — Removed all mutation logic. Now renders a static confirmation page with `UnsubscribeForm` client component. No database calls on GET.

2. **`src/app/u/[token]/actions.ts`** (new) — Server action `unsubscribeAction` that:
   - Verifies the unsubscribe token via `verifyUnsubscribeToken`
   - Finds the user
   - Sets `marketingEmailsEnabled = false` (idempotent)
   - Returns success/error state

3. **`src/app/u/[token]/UnsubscribeForm.tsx`** (new) — Client component with three states:
   - **Confirm**: Shows "Отписаться от рассылки?" with a "Да, отписаться" button
   - **Success**: Shows "Вы отписались от рассылки" with link to home
   - **Error**: Shows "Ссылка недействительна" with guidance

### States

#### Confirmation (initial GET)
- Title: "Отписаться от рассылки?"
- Description: "Вы больше не будете получать маркетинговые письма mamaGo."
- Button: "Да, отписаться"
- Link: "Нет, остаться" → home

#### Success (after POST)
- Title: "Вы отписались от рассылки" (or "Вы уже отписаны" if already unsubscribed)
- Description with what changed
- Link to home page

#### Error (invalid/expired token)
- Title: "Ссылка недействительна"
- Error message with guidance
- Link to home page

## Backward Compatibility

- All existing unsubscribe links (`/u/[token]`) continue to work — they now show a confirmation page instead of immediately unsubscribing
- Token format unchanged
- Email templates unchanged
- Database schema unchanged
- `verifyUnsubscribeToken` still marks tokens as used (idempotent) — this is fine since it's a read-only verification step

## Security

- Prefetch attacks (email clients, antivirus, proxies) no longer cause accidental unsubscribes
- User must explicitly submit the form to trigger the mutation
- Server action validates the token server-side before mutating
