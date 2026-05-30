# Notifications System Fix Report

Date: 2026-05-27
Repo: `/Users/shapovalovalexey/dev/mamago2`

## What Was Broken

- Email delivery behavior was inconsistent between pipelines:
  - legacy path already called the real adapter, but missing Resend env could still surface as failure semantics instead of graceful skip;
  - new `emailService.sendNotificationEmail()` did not explicitly degrade to `SKIPPED` when email was enabled logically but provider env was incomplete.
- Deep links were inconsistent for important moderation and reminder types:
  - registry links for moderation often pointed to business list/detail pages instead of shared editors;
  - reminder/system routes were not normalized.
- Telegram rendering still fell back to a generic message for many important registry types, which meant inconsistent titles/body/button behavior.
- Header notification store ignored the requested stream when fetching list pages and `mark-open`, so business/user panel state could drift.
- There was no minimal admin diagnostics surface for recent notifications and `NotificationDelivery`, and no manual resend button for failed external deliveries.
- There was no user-facing email test notification route.

## What Was Fixed

### Delivery pipeline

- `src/features/email/server/email-service.tsx`
  - Added explicit health inspection via `emailService.getHealth()`.
  - Changed missing Resend env behavior to `SKIPPED` with `EMAIL_NOT_CONFIGURED` for:
    - `sendRawEmail`
    - `sendNotificationEmail`
  - Preserved `FAILED` only for real send-time provider/runtime failures.
- `src/lib/email/notificationEmailTemplates.ts`
  - Switched CTA resolution to the canonical notification registry routing.
  - Added support for `ctaAction` from `Notification`.
- `src/server/services/notificationDelivery.service.ts`
  - Passed `ctaAction` into email template building.
  - Added `resendNotificationDelivery()` for manual resend of failed email/telegram deliveries.

### Telegram

- `src/server/services/telegram/TelegramTemplateRenderer.ts`
  - Registry-backed types now render a structured Telegram message by default.
  - Important types no longer depend on the generic fallback to get title/body/button behavior.
- Existing DEV/PROD env split remains in:
  - `src/server/config/telegram.config.ts`
  - `src/server/services/telegram/telegramConnection.service.ts`
  - `src/server/services/telegramLink.service.ts`

### Settings, routing, panel consistency

- `src/lib/notifications/notificationRegistry.ts`
  - Normalized deep links for:
    - `REMINDER`
    - `PLACE_*`
    - `PLACE_UPDATE_*`
    - `ACTIVITY_*`
    - `OFFER_*`
    - `BUSINESS_VERIFIED`
    - `BUSINESS_APPLICATION_CREATED`
- `src/lib/notifications/routing.ts`
  - Added/normalized fallbacks for:
    - `SYSTEM`
    - `BUSINESS_APPLICATION_CREATED`
    - `ADMIN_MODERATION_ITEM_CREATED`
- `src/features/notifications/store/notification-types.ts`
- `src/features/notifications/store/notification-actions.ts`
- `src/features/notifications/store/notification-store.ts`
- `src/components/business/notifications/NotificationFeed.tsx`
  - Added active stream tracking so list fetches and `mark-open` respect `user` vs `business`.
  - This reduces incorrect reuse of cached list state across different panels.

### Test and diagnostics

- Added `POST /api/notifications/email/test`
  - File: `src/app/api/notifications/email/test/route.ts`
- Added admin resend route:
  - `src/app/api/admin/notifications/deliveries/[id]/resend/route.ts`
- Added minimal admin diagnostics page:
  - `src/app/admin/system/notifications/page.tsx`
  - `src/app/admin/system/notifications/AdminNotificationsDiagnosticsClient.tsx`
  - Includes:
    - recent `Notification`
    - filtered `NotificationDelivery`
    - failed delivery error visibility
    - manual resend for failed email/telegram
    - test email button
    - test Telegram button
    - env health-check without secrets
- Added docs audit snapshot:
  - `docs/reports/NOTIFICATIONS_SYSTEM_CURRENT_STATE.md`

## Files Changed

- `src/features/email/server/email-service.tsx`
- `src/lib/email/notificationEmailTemplates.ts`
- `src/server/services/notificationDelivery.service.ts`
- `src/lib/notifications/notificationRegistry.ts`
- `src/lib/notifications/routing.ts`
- `src/server/services/telegram/TelegramTemplateRenderer.ts`
- `src/components/business/notifications/NotificationSettingsTable.tsx`
- `src/features/notifications/store/notification-types.ts`
- `src/features/notifications/store/notification-actions.ts`
- `src/features/notifications/store/notification-store.ts`
- `src/components/business/notifications/NotificationFeed.tsx`
- `src/app/api/notifications/email/test/route.ts`
- `src/app/api/admin/notifications/deliveries/[id]/resend/route.ts`
- `src/app/admin/system/notifications/page.tsx`
- `src/app/admin/system/notifications/AdminNotificationsDiagnosticsClient.tsx`
- `docs/reports/NOTIFICATIONS_SYSTEM_CURRENT_STATE.md`

## Notification Types Covered

- Moderation and business verification:
  - `PLACE_*`
  - `PLACE_UPDATE_*`
  - `ACTIVITY_*`
  - `OFFER_*`
  - `BUSINESS_VERIFIED`
  - `BUSINESS_REJECTED`
  - `BUSINESS_NEEDS_INFO`
- Booking business side:
  - `BOOKING_CREATED`
  - `BOOKING_STALE`
  - `BOOKING_NEEDS_ATTENTION`
- Booking user lifecycle:
  - `BOOKING_CONFIRMED`
  - `BOOKING_CANCELLED`
  - `BOOKING_COMPLETED`
  - `BOOKING_FEEDBACK_REQUEST`
- User/system:
  - `WELCOME`
  - `SYSTEM`
  - `REMINDER`
  - `PLAN_TOMORROW_DIGEST`

## Verification Results

- Targeted `eslint` for changed files: passed after fixes.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm prisma validate`: blocked by missing `DATABASE_URL` in current shell environment.
- `pnpm lint`: blocked by pre-existing repo-wide errors and warnings outside notifications scope.
  - Example blocking error family: `src/app/(public)/me/plan/PlanGuestFlow.tsx` (`react-hooks/static-components`)
- `pnpm build`: could not be cleanly confirmed in this session because another `next build` process was already running or left stale state.

## Manual Scenario Status

- Could not fully execute authenticated manual scenarios from this CLI session:
  - new booking → business gets site + telegram + email
  - business confirms booking → user gets site + telegram/email
  - place approved
  - offer needs changes
  - admin moderation item created
- Infrastructure hooks added for manual verification:
  - Telegram test route
  - Email test route
  - Admin diagnostics page with resend

## Left For Later

- Canonical production implementation for `BUSINESS_APPLICATION_CREATED`.
  - Current production admin business verification notice still bypasses `Notification` rows via `src/lib/admin/notifyAdminBusinessVerification.ts`.
- Confirm and wire real trigger coverage for `ADMIN_MODERATION_ITEM_CREATED`.
- Full per-type email copy system if you want branded templates rather than the current generic notification email shell.
- Repo-wide lint cleanup and resolution of unrelated build blockers.
- Optional richer admin diagnostics:
  - pagination
  - per-notification delivery drill-down page
  - channel health history
  - resend for non-failed/skipped cases with explicit override rules
