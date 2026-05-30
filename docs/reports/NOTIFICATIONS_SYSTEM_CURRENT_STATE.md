# Notifications System Current State

Date: 2026-05-27
Repo: `/Users/shapovalovalexey/dev/mamago2`

## Inventory

### Prisma NotificationType

- `PLACE_APPROVED`
- `PLACE_NEEDS_CHANGES`
- `PLACE_REJECTED`
- `ACTIVITY_APPROVED`
- `ACTIVITY_NEEDS_CHANGES`
- `ACTIVITY_REJECTED`
- `SYSTEM`
- `PLACE_UPDATE_APPROVED`
- `PLACE_UPDATE_NEEDS_REVISION`
- `PLACE_UPDATE_REJECTED`
- `OFFER_APPROVED`
- `OFFER_NEEDS_CHANGES`
- `OFFER_REJECTED`
- `BUSINESS_VERIFIED`
- `BUSINESS_REJECTED`
- `BUSINESS_NEEDS_INFO`
- `WELCOME`
- `REMINDER`
- `PLAN_TOMORROW_DIGEST`
- `RECOMMENDATION`
- `BUSINESS_APPLICATION_CREATED`
- `ADMIN_MODERATION_ITEM_CREATED`
- `NEWS`
- `ANNOUNCEMENT`
- `BOOKING_CREATED`
- `BOOKING_STALE`
- `BOOKING_NEEDS_ATTENTION`
- `BOOKING_CONFIRMED`
- `BOOKING_CANCELLED`
- `BOOKING_COMPLETED`
- `BOOKING_FEEDBACK_REQUEST`

### Notification creation points

- Legacy create path: `src/server/services/notification.service.ts`
- Legacy direct creators:
  - booking stale: `src/server/services/booking/bookingStale.service.ts`
  - booking stale job: `src/server/jobs/bookingStale.job.ts`
  - dev telegram business application: `src/server/services/telegram/devTelegramBusinessApplication.service.ts`
  - commercial notifications: `src/server/services/commercial/commercialNotifications.service.ts`
- New scenario pipeline: `src/server/notifications/notification.service.ts`
- External admin side-channel, outside `Notification` rows: `src/lib/admin/notifyAdminBusinessVerification.ts`

### Delivery pipelines

- Legacy orchestration: `src/server/services/notification.service.ts`
- Legacy delivery: `src/server/services/notificationDelivery.service.ts`
- New pipeline: `src/server/notifications/*`

### Email adapters

- Compatibility adapter: `src/lib/email/emailAdapter.ts`
- Real email service: `src/features/email/server/email-service.tsx`
- New pipeline email delivery: `src/server/notifications/email-delivery.ts`

### Telegram parts

- Transport: `src/server/services/telegram/TelegramChannel.ts`
- Webhook handler: `src/server/services/telegram/TelegramWebhookService.ts`
- Template renderer: `src/server/services/telegram/TelegramTemplateRenderer.ts`
- Connection service: `src/server/services/telegram/telegramConnection.service.ts`
- Link/status routes:
  - `src/app/api/settings/telegram/link/route.ts`
  - `src/app/api/settings/telegram/status/route.ts`
  - `src/app/api/me/telegram/connected/route.ts`
  - `src/app/api/bot/webhook/route.ts`
  - `src/app/api/notifications/telegram/test/route.ts`

### Notifications UI

- Header dropdown: `src/components/site/header/NotificationsDropdown.tsx`
- Header content wrapper: `src/components/site/header/NotificationsMenuContent.tsx`
- Shared panel/feed:
  - `src/components/business/notifications/NotificationsPanel.tsx`
  - `src/components/business/notifications/NotificationFeed.tsx`
- Settings UI:
  - `src/components/business/notifications/NotificationSettingsTable.tsx`
  - `src/components/business/notifications/NotificationSettingsInModal.tsx`
  - `src/app/settings/notifications/page.tsx`
  - `src/app/business/(protected)/settings/notifications/page.tsx`
  - `src/app/admin/settings/notifications/page.tsx`

## Matrix

| NotificationType | Audience | Who gets it | Created in | entityType/entityId | In-app | Email | Telegram | Deep link | Setting row | Email template | Telegram template | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `WELCOME` | USER | USER | `notification.service.ts`, verify-email route | `- / -` | Yes | Yes | Yes | `/` | No | Generic notification email | `welcome` | OK |
| `SYSTEM` | USER | USER | `notification.service.ts` | `- / -` | Yes | Yes | Yes | `/settings/notifications` | Yes | Generic notification email | Registry renderer | OK |
| `REMINDER` | USER | USER | legacy helper + new reminder jobs | `PLAN_ITEM / planItemId` | Yes | Partial | Yes | `/me/plan` | Yes | Generic notification email | Registry renderer | PARTIAL |
| `PLAN_TOMORROW_DIGEST` | USER | USER | `src/server/notifications/jobs/run-plan-tomorrow-digests-core.ts` | `PLAN_DIGEST / digestDate` | Yes | Partial | Yes | `/me/plan` | Yes | New pipeline notification email | Registry renderer | OK |
| `RECOMMENDATION` | USER | USER | no confirmed runtime creator in current code | varies | Feed-ready | Partial | Partial | none | Yes | Generic notification email | `recommendation` fallback | MISSING |
| `NEWS` | BUSINESS surface in registry, legacy user/business broadcast in docs | USER/BUSINESS | admin broadcast fan-out path, not fully audited in this pass | broadcast CTA-based | Yes | Partial | Partial | `ctaAction` if present | Yes | Generic notification email | `news` | PARTIAL |
| `ANNOUNCEMENT` | USER | USER | legacy broadcast fan-out | broadcast CTA-based | Yes | Partial | Partial | `ctaAction` if present | No | Generic notification email | `announcement` | PARTIAL |
| `PLACE_APPROVED` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `PLACE / placeId` | Yes | Yes | Yes | `/editor/place/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `PLACE_NEEDS_CHANGES` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `PLACE / placeId` | Yes | Yes | Yes | `/editor/place/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `PLACE_REJECTED` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `PLACE / placeId` | Yes | Yes | Yes | `/editor/place/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `PLACE_UPDATE_APPROVED` | BUSINESS | BUSINESS | `notification.service.ts`, `placeRevision.service.ts` | `PLACE / placeId` | Yes | Yes | Yes | `/editor/place/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `PLACE_UPDATE_NEEDS_REVISION` | BUSINESS | BUSINESS | `notification.service.ts`, `placeRevision.service.ts` | `PLACE / placeId` | Yes | Yes | Yes | `/editor/place/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `PLACE_UPDATE_REJECTED` | BUSINESS | BUSINESS | `notification.service.ts`, `placeRevision.service.ts` | `PLACE / placeId` | Yes | Yes | Yes | `/editor/place/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `ACTIVITY_APPROVED` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `ACTIVITY / activityId` | Yes | Yes | Yes | `/editor/event/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `ACTIVITY_NEEDS_CHANGES` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `ACTIVITY / activityId` | Yes | Yes | Yes | `/editor/event/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `ACTIVITY_REJECTED` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `ACTIVITY / activityId` | Yes | Yes | Yes | `/editor/event/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `OFFER_APPROVED` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `OFFER / offerId` | Yes | Yes | Yes | `/editor/offer/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `OFFER_NEEDS_CHANGES` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `OFFER / offerId` | Yes | Yes | Yes | `/editor/offer/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `OFFER_REJECTED` | BUSINESS | BUSINESS | `notification.service.ts`, `moderation.service.ts` | `OFFER / offerId` | Yes | Yes | Yes | `/editor/offer/:id/edit` | Yes | Generic notification email | Registry renderer | OK |
| `BUSINESS_VERIFIED` | BUSINESS | BUSINESS | `notification.service.ts`, `businessVerification.service.ts` | `BUSINESS / businessId` | Yes | Yes | Yes | `/business/verification` | Yes | Generic notification email | Registry renderer | OK |
| `BUSINESS_REJECTED` | BUSINESS | BUSINESS | `notification.service.ts`, `businessVerification.service.ts` | `BUSINESS / businessId` | Yes | Yes | Yes | `/business/verification` | Yes | Generic notification email | Registry renderer | OK |
| `BUSINESS_NEEDS_INFO` | BUSINESS | BUSINESS | `notification.service.ts`, `businessVerification.service.ts` | `BUSINESS / businessId` | Yes | Yes | Yes | `/business/verification` | Yes | Generic notification email | Registry renderer | OK |
| `BUSINESS_APPLICATION_CREATED` | ADMIN in registry, BUSINESS in dev helper | ADMIN / dev BUSINESS | no canonical production `Notification` creator; dev only helper exists, real admin notify goes around `Notification` table | `BUSINESS` or `DEV_BUSINESS_APPLICATION` | Partial | Partial | Partial | `/admin/b2b/requests?status=PENDING` | Admin row only | No canonical notification template path | Legacy special-case + registry | BROKEN |
| `ADMIN_MODERATION_ITEM_CREATED` | ADMIN | ADMIN | helper exists in `notification.service.ts`, no confirmed runtime caller | `MODERATION_ITEM / itemId` | Possible | Possible | Yes | `/admin/moderation/queue` | Yes | Generic notification email | Registry renderer | PARTIAL |
| `BOOKING_CREATED` | BUSINESS | BUSINESS | `notification.service.ts`, `booking.service.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/business/bookings` | Yes | Generic notification email | Registry renderer | OK |
| `BOOKING_STALE` | BUSINESS | BUSINESS | `bookingStale.service.ts`, `bookingStale.job.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/business/bookings` | Yes | Generic notification email | Registry renderer | OK |
| `BOOKING_NEEDS_ATTENTION` | BUSINESS | BUSINESS | `bookingStale.service.ts`, `bookingStale.job.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/business/bookings` | Yes | Generic notification email | Registry renderer | OK |
| `BOOKING_CONFIRMED` | USER | USER | `notification.service.ts`, `bookingQuery.service.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/me/bookings` | Yes | Generic notification email | Registry renderer | OK |
| `BOOKING_CANCELLED` | USER | USER | `notification.service.ts`, `bookingQuery.service.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/me/bookings` | Yes | Generic notification email | Registry renderer | OK |
| `BOOKING_COMPLETED` | USER | USER | `notification.service.ts`, `bookingQuery.service.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/me/bookings` | Yes | Generic notification email | Registry renderer | OK |
| `BOOKING_FEEDBACK_REQUEST` | USER | USER | `notification.service.ts`, `bookingQuery.service.ts` | `BOOKING / bookingId` | Yes | Yes | Yes | `/me/bookings` | Yes | Generic notification email | Registry renderer | OK |

## Key current-state conclusions

- In-app is the most stable channel: all core business and booking notifications still persist through `Notification`.
- Legacy and new pipelines still coexist:
  - legacy covers most moderation, business verification and booking flows;
  - new pipeline covers plan scenarios.
- Email is now wired through the real `emailService` in both paths, but template strategy is still mostly generic rather than per-type branded.
- Telegram infra is present and environment-aware; the main remaining gap is inconsistent coverage for legacy/edge types like `BUSINESS_APPLICATION_CREATED`.
- The biggest functional inconsistencies in current code are:
  - `BUSINESS_APPLICATION_CREATED` has no single canonical production path through `Notification`;
  - `ADMIN_MODERATION_ITEM_CREATED` helper exists but has no confirmed trigger wiring;
  - `RECOMMENDATION`, `NEWS`, `ANNOUNCEMENT` remain only partially verified in real runtime flows.
