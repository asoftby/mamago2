# NOTIFICATIONS_EMAIL_PIPELINE_AUDIT

Date: 2026-05-13
Repo: `/Users/shapovalovalexey/dev/mamago2`
Branch: `feature/offers-discovery-signals`

## Executive Summary

The notifications system is partially working in production shape, but it is split across two parallel pipelines:

1. Legacy pipeline:
- `src/server/services/notification.service.ts`
- `src/server/services/notificationDelivery.service.ts`

2. New pipeline:
- `src/server/notifications/*`

Current reality:
- Most real product/business/moderation/booking notifications use the legacy pipeline.
- Plan reminder notifications use the new pipeline.
- Telegram delivery is implemented in both pipelines.
- Email delivery is effectively inconsistent:
  - legacy pipeline uses stub adapter
  - new pipeline uses `emailService` + Resend-aware flow

This split is the main architectural risk.

## What Actually Works

### In-app notifications

Working:
- Notifications are persisted to DB via `Notification`.
- Feed API exists:
  - `src/app/api/notifications/route.ts`
  - `src/app/api/notifications/unread-count/route.ts`
- Read/open endpoints exist:
  - `src/app/api/notifications/mark-open/route.ts`
  - `src/app/api/notifications/mark-all-read/route.ts`
  - `src/app/api/notifications/[id]/read/route.ts`
  - `src/app/api/notifications/mark-booking-read/route.ts`
- UI dropdown/sheet exists:
  - `src/components/site/header/NotificationsDropdown.tsx`
  - `src/components/business/notifications/NotificationsPanel.tsx`

Observed behavior:
- User stream and business stream are both supported.
- Feed uses audience/surface filtering.
- Unread badge and store synchronization are implemented.

### Telegram delivery

Working paths:
- Legacy pipeline:
  - `src/server/services/notificationDelivery.service.ts`
- New pipeline:
  - `src/server/notifications/telegram-delivery.ts`
- Telegram bot transport:
  - `src/server/services/telegram/TelegramChannel.ts`
- Telegram connection/linking:
  - `src/server/services/telegramLink.service.ts`
  - `src/app/api/settings/telegram/status/route.ts`
  - `src/app/api/me/telegram/connected/route.ts`
  - `src/app/api/bot/webhook/route.ts`

Observed behavior:
- Telegram can send real messages if environment variables and connection rows are present.
- Per-user Telegram preferences are respected in the new pipeline and in channel resolution for the legacy pipeline.
- There is also a user-accessible test route:
  - `src/app/api/notifications/telegram/test/route.ts`

### Email delivery

Working only in part:
- Auth/transactional email:
  - registration verification
  - resend verification
  - password reset
  - welcome/business invite helpers
- These use:
  - `src/features/email/server/email-service.tsx`

Observed behavior:
- If `EMAIL_ENABLED=true` and Resend env is configured, verification/password-reset/notification email through `emailService` can send.
- If disabled, these flows mostly log and skip gracefully.

## What Is Only Written To DB

The following notification families are created as `Notification` rows and shown in UI, but their external email behavior depends on which pipeline they hit:

Via legacy pipeline:
- place moderation notifications
- activity moderation notifications
- offer moderation notifications
- business verification notifications
- booking lifecycle notifications
- booking stale reminders
- admin moderation item notifications
- welcome/email-verified notifications

These do create DB rows and in-app entries reliably.

## What Goes To Telegram

### Confirmed Telegram-capable flows

Legacy pipeline sends Telegram for:
- moderation notifications
- business verification notifications
- booking notifications
- welcome/system notifications

Reason:
- `dispatchDelivery()` in `src/server/services/notificationDelivery.service.ts`
- real send via `TelegramChannel`

New pipeline sends Telegram for:
- plan reminder scenario `PLAN_EVENT_2H_BEFORE`

Reason:
- `src/server/notifications/notification.service.ts`
- `src/server/notifications/telegram-delivery.ts`

### Telegram-specific caveats

- Delivery depends on `TelegramConnection` table presence and active environment-specific link.
- Environment split is hard-coded by `NODE_ENV`:
  - `TELEGRAM_BOT_TOKEN_DEV`
  - `TELEGRAM_BOT_USERNAME_DEV`
  - `TELEGRAM_WEBHOOK_SECRET_DEV`
  - `TELEGRAM_BOT_TOKEN_PROD`
  - `TELEGRAM_BOT_USERNAME_PROD`
  - `TELEGRAM_WEBHOOK_SECRET_PROD`
- Some legacy compatibility logic exists for missing columns/tables, which suggests migration drift is still tolerated rather than eliminated.

## What Should Send Email But Is Not Reliable

### Legacy notification pipeline email is effectively stubbed

Legacy path:
- `src/server/services/notificationDelivery.service.ts`
- imports `src/lib/email/emailAdapter.ts`

Problem:
- `emailAdapter.ts` is a stub.
- It returns:
  - `EMAIL_NOT_CONFIGURED`, or
  - `EMAIL_PROVIDER_NOT_IMPLEMENTED`

Result:
- Most legacy notifications may create `NotificationDelivery` records for EMAIL,
  but production delivery will be skipped or fail unless someone replaces the adapter.

Impacted notification families:
- moderation notifications
- business verification notifications
- booking notifications
- booking stale reminders
- welcome/system notifications created through legacy `createNotification()`

### New notification pipeline email is more real

New path:
- `src/server/notifications/email-delivery.ts`
- uses `emailService.sendNotificationEmail()`

This is better because:
- it can use `EMAIL_ENABLED=true`
- it validates Resend-related config via `emailService`
- it records SENT/SKIPPED/FAILED in `NotificationDelivery`

But:
- today it is used only by the new scenario-based pipeline, mainly plan reminders

## Booking Notification Audit

### Booking created

Trigger:
- `src/server/services/booking/booking.service.ts`
- calls `notifyBookingCreated()`

Delivery:
- legacy pipeline

Status:
- in-app: yes
- Telegram: yes if connected/enabled
- email: no reliable real provider in legacy path

### Booking status changed

Trigger:
- `src/server/services/booking/bookingQuery.service.ts`
- calls:
  - `notifyUserBookingConfirmed`
  - `notifyUserBookingCancelled`
  - `notifyUserBookingCompleted`
  - `notifyUserBookingFeedbackRequest`

Status:
- in-app: yes
- Telegram: yes for confirmed/cancelled/feedback-request, not default for completed
- email: not reliably delivered in legacy path

### Booking stale / needs attention

Triggers:
- `src/server/services/booking/bookingStale.service.ts`
- `src/server/jobs/bookingStale.job.ts`

Status:
- notifications are created through legacy `createNotification()`
- dedupe is based on recent `Notification` rows
- email still depends on stub adapter

Important note:
- comments in `bookingStale.service.ts` say lazy-only, not cron
- but there is also a job implementation in `src/server/jobs/bookingStale.job.ts`
- this is a documentation/implementation split worth cleaning up

## Business Verification / Moderation Audit

### Business verification approved/rejected/needs-info

Trigger source:
- `src/server/services/businessVerification.service.ts`

Notification helper:
- legacy `src/server/services/notification.service.ts`

Status:
- in-app: yes
- Telegram: yes
- email: not reliably real in legacy path

### Moderation approved/rejected

Trigger source:
- `src/server/services/moderation.service.ts`

Covered:
- place
- activity
- offer

Status:
- in-app: yes
- Telegram: yes
- email: not reliably real in legacy path

## Password Reset / Email Verification Audit

### Password reset

File:
- `src/server/auth/password-reset.ts`

Status:
- uses `emailService.sendPasswordResetEmail`
- if email sending fails, failure is only logged
- there is no notification row in DB for this flow

Conclusion:
- email flow exists
- audit trail is only console logging, not DB-backed delivery tracking

### Email verification

Files:
- `src/server/auth/email-verification.ts`
- `src/app/api/auth/verify-email/[token]/route.ts`

Status:
- verification email sending uses `emailService.sendVerifyEmail`
- successful verify triggers:
  - `notifyWelcomeNewUser`
  - `notifyEmailVerified`
- those post-verify notifications then go through legacy notification delivery

Conclusion:
- verification email itself is separate and real-capable
- follow-up notifications are DB/in-app + Telegram-capable
- follow-up email again falls back to legacy stub behavior

## Telegram Connect / Disconnect Audit

Working pieces:
- link token creation and consume logic exist
- status route exists
- webhook route exists with secret validation support
- welcome notifications can be marked read after Telegram connection

Gaps:
- `unlinkTelegramAccount()` exists in service, but disconnect UX/route coverage should be verified separately
- there is compatibility code for missing DB pieces, indicating migrations may not be uniformly applied

## Unread Count / Dropdown Audit

Working:
- unread count endpoint exists
- dropdown and mobile modal exist
- business and user streams are supported

Potential issues:
- architecture mixes stream filtering with audience filtering
- business badge is store-driven, user badge is separate hook-driven
- `mark-booking-read` only marks `BOOKING_CREATED`, not the full booking-related family

Impact:
- badge behavior may diverge from user expectations once more booking types accumulate

## Notification Settings Audit

Files:
- `src/app/api/notifications/settings/route.ts`
- `src/server/services/notificationSettings.service.ts`
- `src/lib/notifications/settingsDomain.ts`
- `src/lib/notifications/notificationRegistry.ts`

Working:
- per-surface settings exist for USER/BUSINESS/ADMIN
- Telegram toggle is blocked if Telegram is not linked
- “last system channel must remain enabled” guard exists

Gaps:
- settings registry and runtime delivery are still split between old/new systems
- default channel definitions exist in registry and settings domain, increasing drift risk
- legacy user notification types are still being normalized/mapped for compatibility

## Delivery Logging / Auditability

Good:
- both pipelines write `NotificationDelivery` records
- statuses include sent/skipped/failed
- error messages are recorded

Weak points:
- auth email flows do not use `NotificationDelivery`
- admin business verification external alerts use ad-hoc transport and console logs:
  - `src/lib/admin/notifyAdminBusinessVerification.ts`
- not all failures are elevated beyond console/Sentry

## Idempotency / Duplicates

### Present

Legacy pipeline:
- `src/server/services/notificationDedup.service.ts`
- used for booking lifecycle and moderation/business events

New pipeline:
- `src/server/notifications/notification-dedupe.ts`

### Risks

- Two different dedupe systems exist.
- Same conceptual notification family is not centralized.
- A future migration from old pipeline to new pipeline can easily reintroduce duplicates unless old/new keys are reconciled.

## Stub / Missing / Broken Areas

### Clearly stubbed

- `src/lib/email/emailAdapter.ts`
  - not production-ready
  - legacy notification email depends on it

### Missing unified pipeline

- Product notifications are not all on the same delivery implementation.
- Registry-driven system is only partially authoritative.

### Possibly broken or fragile

- `src/app/api/notifications/telegram/test/route.ts` is useful, but should be reviewed for production exposure policy.
- Notification comments/docs around stale booking trigger do not fully match actual code shape.
- `NotificationRegistry` and `settingsDomain` duplicate channel/default knowledge.

## Production Environment Requirements

### For public links in email/Telegram

- `APP_PUBLIC_URL` or `NEXT_PUBLIC_APP_URL`

### For auth/transactional email and new notification email pipeline

- `EMAIL_ENABLED=true`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- optional:
  - `EMAIL_DEBUG_REDIRECT_TO`

### For legacy admin verification email helper

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`

### For Telegram user notifications

- `TELEGRAM_BOT_TOKEN_DEV`
- `TELEGRAM_BOT_USERNAME_DEV`
- `TELEGRAM_WEBHOOK_SECRET_DEV`
- `TELEGRAM_BOT_TOKEN_PROD`
- `TELEGRAM_BOT_USERNAME_PROD`
- `TELEGRAM_WEBHOOK_SECRET_PROD`

### For admin-side external verification alerts

Optional one or more:
- `TELEGRAM_ADMIN_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `ADMIN_NOTIFY_WEBHOOK_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`

## Recommended Fix Order

1. Unify notification delivery onto one pipeline.
Reason:
- biggest source of bugs, inconsistent email behavior, and duplicate logic.

2. Replace legacy email adapter or reroute legacy notifications to `emailService`.
Reason:
- today most non-reminder notification emails are effectively non-delivering.

3. Consolidate dedupe into one mechanism.
Reason:
- old/new pipeline parallel dedupe is a future regression trap.

4. Consolidate notification defaults/registry/settings definitions.
Reason:
- current duplication risks channel drift.

5. Add structured audit for auth emails.
Reason:
- password reset and verification sends are important but not delivery-tracked in DB.

6. Revisit booking unread semantics.
Reason:
- `mark-booking-read` currently covers only `BOOKING_CREATED`.

7. Review production exposure of Telegram test route.
Reason:
- not a blocker, but should be a deliberate decision.

## Bottom Line

Today the notification system is usable for in-app and Telegram, but email is only partially real.
The biggest production gap is not “notifications do nothing”; it is that different flows use different delivery stacks, and most legacy notification emails still rely on a stub adapter.
