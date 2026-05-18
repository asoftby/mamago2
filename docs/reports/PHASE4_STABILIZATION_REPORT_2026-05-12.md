# Phase 4 Stabilization Report

## Scope

Soft-launch stabilization only.

- No new product systems added
- No architecture refactor performed
- Only launch-blocking and high-confidence UX resilience fixes applied

## Fixed Issues

### 1. Notification Deduplication Coverage

- Added explicit one-time notification classification helper in `notificationDedup.service.ts`
- Added delivery-level duplicate suppression for one-time notifications in `notificationDelivery.service.ts`
- Protection now covers duplicate channel delivery for:
  - `PLACE_APPROVED`
  - `PLACE_REJECTED`
  - `ACTIVITY_APPROVED`
  - `ACTIVITY_REJECTED`
  - `OFFER_APPROVED`
  - `OFFER_REJECTED`
  - `BUSINESS_VERIFIED`
- Suppressed duplicate deliveries are written as `SKIPPED` with `DUPLICATE_DELIVERY_SUPPRESSED`

### 2. Notification Store Auth Race Condition

- Notification store now resets module-level in-flight state not only on `guest/authenticated` switch, but also on authenticated user identity change
- Added epoch-based stale request protection so old unread/list requests do not overwrite:
  - unread counters
  - hydration state
  - loading flags
  - mark-open state
- `NotificationStoreAuthSync` now syncs by `user.id`, not only by auth boolean

### 3. Discovery Filters URL Priority

- Listing restoration from storage now yields to any URL query params
- Shared links with query params are no longer overwritten by stored discovery filters
- Effective priority is now:
  1. URL params
  2. local/session storage
  3. defaults

### 4. Guest -> Auth -> Continue Action

- Extended pending-action flow for offer save intent and add-to-plan intent
- Guest user actions on offer pages now persist through auth modal flow
- After successful auth / phone verification, the pending action is replayed automatically via the existing gate-flow event bridge
- Offer page now reflects the resumed action with immediate UI feedback

### 5. Booking Success Confidence Loop

- Offer booking now uses the real `CampShiftBookingOverlay` flow instead of the old mock modal
- Success state now includes:
  - expected response timeline
  - link to `Мои записи`
  - explicit next steps
  - expectation about follow-up notification

### 6. Basic Sentry Coverage

- Added Sentry capture in client booking request failures
- Added Sentry capture in public camp-shift booking API route failures
- Added Sentry capture in notification delivery failures for:
  - delivery record creation
  - delivery record update
  - Telegram send failures
  - retry failures
- Existing global Sentry Next.js integration remains in place

## Quick Wins Status

### 7. Plan Empty State CTA

- Already present in `PlanPageClient.tsx`
- No additional stabilization change required

### 8. Telegram Connection Status

- Already present in settings flows (`TelegramStatusRow.tsx` and related settings UI)
- No additional stabilization change required

### 9. Ideas Loading Skeleton

- Already present in `PlanIdeasBlock.tsx`
- No additional stabilization change required

## Verification Performed

- Ran diagnostics on all edited files
- Ran `pnpm exec tsc --noEmit`
- Confirmed no TypeScript diagnostics remain in edited files

## Remaining Known Issues

TypeScript check still fails on pre-existing unrelated files outside this stabilization pass:

- `next.config.ts`
  - outdated Sentry config option: `hideSourceMaps`
- `src/features/discovery/signals/utils.ts`
  - readonly array cast issue
- `src/lib/settings/resolveSettingsContext.ts`
  - misplaced import
  - invalid import path
  - stale `telegramLinked` field typing

These were not modified here because they are outside the requested stabilization scope and not directly tied to the launch-blocking flows fixed in this pass.

## Launch Readiness Assessment

### Ready / Improved

- Notification duplicate delivery risk is materially reduced
- Notification auth-store account leakage risk is materially reduced
- Shared discovery links are safer against stale local filter override
- Offer booking submission UX is more trustworthy for launch
- Offer guest-intent continuation no longer drops on auth
- Critical booking and notification failures now surface into Sentry

### Residual Risk

- General repository typecheck is still not green because of unrelated pre-existing issues
- Offer save/add-to-plan remains UI-local behavior; no new persistence backend was introduced in this stabilization pass
- Mobile Safari still requires manual device validation
- Notification scenarios should still be smoke-tested with real user sessions before soft launch

### Assessment

Project readiness for soft launch is improved and the targeted launch-blocking flows above are stabilized.

Recommended next step before launch:

- run focused manual smoke test for guest flow, booking flow, notifications, shared URLs, and mobile Safari
