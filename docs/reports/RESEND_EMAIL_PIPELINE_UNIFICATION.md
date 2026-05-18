# RESEND_EMAIL_PIPELINE_UNIFICATION

Date: 2026-05-13
Repo: `/Users/shapovalovalexey/dev/mamago2`
Branch: `feature/offers-discovery-signals`

## Summary

Email delivery is now unified around the existing Resend integration.

The canonical service is:
- `src/features/email/server/email-service.tsx`

Legacy callers that still use:
- `src/lib/email/emailAdapter.ts`

now delegate into that canonical service instead of returning the previous stub error path.

## What Changed

### Canonical service

`emailService` remains the single place that knows how to send via Resend:
- it uses `getResendClient()`
- it uses `EMAIL_FROM`
- it uses `EMAIL_REPLY_TO`
- it respects `EMAIL_ENABLED`

### Legacy adapter no longer stubs

File:
- `src/lib/email/emailAdapter.ts`

Before:
- `sendEmail()` returned `EMAIL_PROVIDER_NOT_IMPLEMENTED`

After:
- `sendEmail()` calls `emailService.sendRawEmail(...)`
- if Resend succeeds: returns `{ ok: true, messageId }`
- if disabled/misconfigured/failing: returns `{ ok: false, error }`

### Safe failure behavior

Implemented in canonical path:
- if `EMAIL_ENABLED` is not true:
  - email is skipped safely
- if Resend env is missing:
  - clear server log is emitted
  - send returns failure object
- no raw reset/verify/invite links are logged anymore

### Legacy notification delivery compatibility

File:
- `src/server/services/notificationDelivery.service.ts`

Updated to treat:
- `EMAIL_DISABLED`
- `EMAIL_NOT_CONFIGURED`
- `EMAIL_PROVIDER_NOT_IMPLEMENTED`

as skipped/non-transient states instead of retry-worthy hard failures.

## Files Changed

- `src/features/email/server/email-service.tsx`
- `src/lib/email/emailAdapter.ts`
- `src/server/services/notificationDelivery.service.ts`

## Flows Now Using Resend

Already using Resend before, still canonical:
- password reset
- email verification
- welcome email
- business invite email
- new notification pipeline email delivery via `src/server/notifications/email-delivery.ts`

Now also using Resend through legacy adapter delegation:
- legacy notification emails sent from `src/server/services/notificationDelivery.service.ts`
- this includes booking/moderation/business verification notification email attempts when channel resolution enables EMAIL

## Required Environment Variables

For real sending through Resend:
- `EMAIL_ENABLED=true`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`

Optional but useful:
- `EMAIL_DEBUG_REDIRECT_TO`
- `APP_PUBLIC_URL` or `NEXT_PUBLIC_APP_URL`

## Local Testing

### 1. Happy path

Set:
- `EMAIL_ENABLED=true`
- valid `RESEND_API_KEY`
- valid `EMAIL_FROM`
- valid `EMAIL_REPLY_TO`
- optionally `EMAIL_DEBUG_REDIRECT_TO=your@email`

Then test:
- password reset request
- resend verification email
- business invite resend/create
- any notification flow that can resolve EMAIL channel

### 2. Misconfigured path

Unset one of:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`

Expected:
- adapter path returns `ok:false`
- server logs a clear configuration error
- auth endpoints still do not reveal whether an email exists

## What Remains In Legacy `notification.service.ts`

Still legacy:
- notification creation
- notification feed helpers
- channel dispatch entrypoint through `notificationDelivery.service.ts`
- booking/business/moderation notification orchestration

Not refactored in this pass:
- migration of legacy notification creation to `src/server/notifications/*`
- dedupe unification between old/new notification stacks
- registry/settings consolidation

## Net Result

There is still more than one notification orchestration layer in the repo, but there is now one practical email delivery path:

- Resend via `emailService`

That removes the main production gap where legacy notifications could create DB records and go to Telegram, while email stayed on `EMAIL_PROVIDER_NOT_IMPLEMENTED`.
