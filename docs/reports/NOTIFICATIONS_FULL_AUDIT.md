# Full Audit: mamaGo.by 2.0 Notification System

## 1. Inventory & Status Report

### 1.1 Notification Types (Prisma Enum)

| NotificationType | Audience | Created in | Feed (Stream) | Settings Row | Routing | Telegram | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WELCOME** | USER | Service | USER | NO | None | No | Active (Onboarding) |
| **SYSTEM** | USER | Service | USER/BUSINESS | YES | None | No | Active (Security) |
| **REMINDER** | USER | Service | USER | YES | None | No | Active (Plan) |
| **RECOMMENDATION** | USER | NO (Mock?) | USER | YES | None | No | Inactive? |
| **NEWS** | USER/ADMIN | NO (Mock?) | USER/BUSINESS | YES | ctaAction | No | Inactive? |
| **ANNOUNCEMENT** | USER | NO | USER/BUSINESS | NO | ctaAction | No | Legacy |
| **PLACE_APPROVED** | BUSINESS | Service | BUSINESS | YES | `/editor/place/:id/edit` | No | Active |
| **PLACE_NEEDS_CHANGES** | BUSINESS | Service | BUSINESS | YES | `/editor/place/:id/edit` | No | Active |
| **PLACE_REJECTED** | BUSINESS | Service | BUSINESS | YES | `/editor/place/:id/edit` | No | Active |
| **PLACE_UPDATE_...** | BUSINESS | Service | BUSINESS | YES | `/editor/place/:id/edit` | No | Active |
| **ACTIVITY_...** | BUSINESS | Service | BUSINESS | YES | `/editor/event/:id/edit` | No | Active |
| **OFFER_...** | BUSINESS | Service | BUSINESS | YES | `/editor/offer/:id/edit` | No | Active |
| **BUSINESS_VERIFIED** | BUSINESS | Service | BUSINESS | YES | `/business/verification` | No | Active |
| **BUSINESS_REJECTED** | BUSINESS | Service | BUSINESS | YES | `/business/verification` | No | Active |
| **BUSINESS_NEEDS_INFO** | BUSINESS | Service | BUSINESS | YES | `/business/verification` | No | Active |
| **BUSINESS_APPLICATION_CREATED** | BUSINESS | NO | BUSINESS | YES | `/business/bookings` | **YES** | Active (Partially) |
| **BOOKING_CREATED** | BUSINESS | Service | BUSINESS | **NO** | `/business/bookings` | No | **Active (Missing Settings)** |
| **BOOKING_STALE** | BUSINESS | NO | BUSINESS | **NO** | `/business/bookings` | No | New |
| **BOOKING_NEEDS_ATTENTION** | BUSINESS | NO | BUSINESS | **NO** | `/business/bookings` | No | New |
| **ADMIN_MODERATION_ITEM_CREATED** | ADMIN | Service | ADMIN | YES | None | No | Active |

### 1.2 Channel Availability (Infrastructure)
- **IN_APP**: Always active (upsert in `NotificationDelivery`).
- **EMAIL**: Active via `sendEmail` (resend). Templates exist in `notificationEmailTemplates.ts`.
- **TELEGRAM**: **Partially Active**. Wires are connected, but templates are missing for almost all types except `BUSINESS_APPLICATION_CREATED`.

---

## 2. Architectural Issues & Gaps

### 2.1 Logic Duplication
- **Audience/Surface**: `resolveNotificationAudience` (lib) vs hardcoded logic in `notification.service.ts`.
- **Stream Filters vs Settings**: `streamFilters.ts` defines what's visible in the feed, while `settingsDomain.ts` defines what the user can toggle. They are mostly in sync, but `BOOKING_*` types are in filters but missing from Settings UI.

### 2.2 Missing Templates & Routing
- **Routing Gap**: `REMINDER` and `RECOMMENDATION` have no deep links, making them less actionable.
- **Telegram Templates**: `TelegramTemplateRenderer.ts` uses a generic fallback for 95% of notifications. It lacks specific formatting, buttons, and environment-aware URLs for most business events.
- **Email Templates**: Need verification for `BOOKING_CREATED`.

### 2.3 Delivery Weaknesses
- **Defaults vs Telegram**: `settingsDomain.ts` has `telegram: false` by default for almost all types (except USER_REMINDERS). Users won't receive anything in Telegram until they manually toggle it in settings, even if linked.
- **Silent Failures**: `dispatchDelivery` is "fire and forget". While it logs errors to `NotificationDelivery`, there's no retry mechanism or admin alert for systemic failures.

---

## 3. Telegram Flow Audit

### 3.1 Connection Flow
1. `createTelegramLink()`: Generates `link_token` and `t.me` URL. (OK)
2. `TelegramWebhookService`: Handles `/start link_token`. (OK)
3. `consumeTelegramLinkToken()`: Upserts `TelegramConnection` with `environment` (DEV/PROD). (OK)
4. **Environment Isolation**: The system correctly handles DEV/PROD bot separation using different env vars.

### 3.2 Delivery Flow
1. `resolveNotificationChannels()`: 
   - Checks `getActiveTelegramConnectionForCurrentEnvironment`. (OK)
   - **CRITICAL**: Hard-guard fails if `telegram` is not enabled in `settingsDomain` defaults or user prefs.
2. `handleTelegram()`: Calls `renderNotificationTelegramMessage`. (OK)
3. `TelegramChannel.sendMessage()`: Sends to API. (OK)

### 3.3 Why Telegram might not connect or send:
- **Webhook Configuration**: Webhook must be set via `/api/telegram/webhook`. If not set or blocked by middleware, bot won't respond.
- **Middleware**: `middleware.ts` allows `/api`, but local network host detection might interfere with webhook delivery if not using a tunnel (ngrok).
- **Hard Guards**: `resolveNotificationChannels` returns `telegram: false` if the default for the type is `false`. **Currently, most defaults are `false`.**
- **Env Vars**: Confusing names (`TELEGRAM_BOT_TOKEN_DEV` vs `PROD`). If one is missing, `requireTelegramConfig` throws.

---

## 4. Identified Files to Change (Phase 2)

- `src/lib/notifications/settingsDomain.ts`: Add `BOOKING_*` types to Settings UI. Update defaults.
- `src/server/services/telegram/TelegramTemplateRenderer.ts`: Add specific templates for `BOOKING_CREATED` and moderation events.
- `src/lib/notifications/routing.ts`: Add deep links for `REMINDER` (to plan) and `SYSTEM` (to settings).
- `src/server/services/notificationDelivery.service.ts`: Improve error logging and diagnostics.

---

## 5. Safe Migration Plan (No Breaking Changes)

1. **Phase 1 (Done)**: Full audit and gap analysis.
2. **Phase 2 (Immediate Fixes)**: 
   - Add `BOOKING_CREATED` to Settings UI so businesses can actually turn it on.
   - Set `telegram: true` as default for `BOOKING_CREATED` (if connected).
   - Add basic Telegram formatting for `PLACE_*` and `OFFER_*` events.
3. **Phase 3 (Expansion)**: 
   - Wire `BOOKING_CREATED` creation logic in the booking flow (it's in the service but might not be called everywhere).
   - Add "Test Notification" button in Telegram settings.
4. **Phase 4 (Refactor)**: 
   - Consolidate audience resolution.
   - Implement delivery retry queue.
