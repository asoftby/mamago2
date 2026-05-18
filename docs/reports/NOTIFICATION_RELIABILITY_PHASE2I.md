# Phase 2I — Notification Reliability, Dedupe, Retry, Stale Jobs

**Status**: ✅ Complete  
**Date**: May 12, 2026  
**Scope**: Implement retry logic, deduplication, stale booking scheduled job, and delivery diagnostics

---

## Overview

Phase 2I adds reliability features to the notification system:
- **Retry Policy**: Transient errors retry with exponential backoff
- **Deduplication**: Prevent duplicate notifications within time windows
- **Stale Booking Job**: Scheduled job for detecting stale bookings
- **Delivery Diagnostics**: Track and analyze notification delivery

---

## Task 1: Deduplication Audit & Implementation

### Deduplication Rules

**One-time events** (no time window):
- `BOOKING_CREATED` — One per booking
- `BOOKING_CONFIRMED` — One per status change (NEW → CONFIRMED)
- `BOOKING_CANCELLED` — One per status change (NEW|CONFIRMED → REJECTED)
- `BOOKING_COMPLETED` — One per status change (CONFIRMED → COMPLETED)
- `BOOKING_FEEDBACK_REQUEST` — One per booking completion

**Reminder notifications** (24h window):
- `BOOKING_STALE` — Max 1 per 24h per booking
- `BOOKING_NEEDS_ATTENTION` — Max 1 per 24h per booking

**Other types** (no dedup):
- All moderation, place, activity, offer, business verification types
- System, welcome, news, announcements

### Implementation

**File**: `src/server/services/notificationDedup.service.ts`

Created comprehensive deduplication service with:
- `checkNotificationDedup()` — Check if notification should be deduplicated
- `auditNotificationDedup()` — Audit deduplication for a specific type
- `auditAllNotificationDedup()` — Audit all types
- `getUserDedupStats()` — Get dedup statistics for a user

**Dedup Keys**:
```
booking:{bookingId}:created
booking:{bookingId}:confirmed
booking:{bookingId}:cancelled
booking:{bookingId}:completed
booking:{bookingId}:feedback_request
booking:{bookingId}:stale (24h window)
booking:{bookingId}:needs_attention (24h window)
```

### Integration

Updated booking notification functions in `notification.service.ts`:
- `notifyUserBookingConfirmed()` — Checks dedup before creating
- `notifyUserBookingCancelled()` — Checks dedup before creating
- `notifyUserBookingCompleted()` — Checks dedup before creating
- `notifyUserBookingFeedbackRequest()` — Checks dedup before creating

All functions return `null` if duplicate detected, preventing duplicate notifications.

---

## Task 2: Retry Policy

### Retry Configuration

**File**: `src/server/services/notificationDelivery.service.ts`

Implemented safe retry helper with:
- **Max attempts**: 3
- **Backoff**: Exponential (1s, 2s, 4s)
- **Transient errors**: Network timeouts, connection refused, not found, temporarily unavailable
- **Permanent errors**: Channel disabled, Telegram not connected, bot not configured

### Transient vs Permanent Errors

**Transient** (retry):
- `ECONNREFUSED` — Connection refused
- `ENOTFOUND` — DNS not found
- `ETIMEDOUT` — Connection timeout
- `timeout` — Request timeout
- `temporarily unavailable` — Service temporarily down

**Permanent** (don't retry):
- `CHANNEL_DISABLED` — User disabled channel
- `TELEGRAM_NOT_CONNECTED` — Telegram not connected
- `EMAIL_NOT_CONFIGURED` — Email not configured
- `EMAIL_PROVIDER_NOT_IMPLEMENTED` — Email provider not set up
- `TELEGRAM_BOT_NOT_CONFIGURED` — Bot token not configured

### Retry Function

```typescript
export async function retryFailedDelivery(
  deliveryId: string,
  maxAttempts = 3,
): Promise<boolean>
```

Usage:
```typescript
// Retry a failed delivery
const success = await retryFailedDelivery(deliveryId);
if (success) {
  console.log("Delivery succeeded on retry");
}
```

### Attempt Tracking

Added `attemptCount` field to `NotificationDelivery` model:
```prisma
model NotificationDelivery {
  ...
  attemptCount   Int                        @default(0)
  ...
}
```

Each retry increments `attemptCount` and updates `errorMessage` and `status`.

---

## Task 3: Stale Booking Scheduled Job

### Job Service

**File**: `src/server/jobs/bookingStale.job.ts`

Created scheduled job service with:
- `runBookingStaleNotificationJob()` — Main job function
- `runBookingStaleNotificationJobSilent()` — Silent wrapper for cron

### Stale Conditions

**BOOKING_STALE**:
- Status: NEW
- Age: > 24 hours
- Notification: "Заявка ждёт ответа"

**BOOKING_NEEDS_ATTENTION**:
- Status: CONFIRMED
- Inactivity: > 72 hours
- Notification: "Требует внимания"

### Deduplication

Job respects deduplication:
- Max 1 reminder per 24h per booking
- Checks existing notifications before creating new ones
- Skips if already notified within window

### Job Result

```typescript
export interface BookingStaleJobResult {
  checked: number;        // Total stale bookings found
  notified: number;       // Notifications created
  skippedDedup: number;   // Skipped due to dedup
  errors: number;         // Processing errors
  duration: number;       // Execution time (ms)
}
```

### Integration

**Recommended schedule**: Every 1 hour

```typescript
// In your cron/scheduler:
import { runBookingStaleNotificationJobSilent } from "@/server/jobs/bookingStale.job";

// Run every hour
schedule("0 * * * *", () => runBookingStaleNotificationJobSilent());
```

### Batch Processing

- **Batch size**: 100 bookings per run (safety cap)
- **Timeout**: 30 seconds recommended
- **Fire-and-forget**: Doesn't throw exceptions

---

## Task 4: Delivery Diagnostics

### Diagnostics Functions

**File**: `src/server/services/notificationDelivery.service.ts`

#### Delivery Statistics

```typescript
export async function getDeliveryStats(userId: string): Promise<DeliveryStatsByChannel>
```

Returns stats by channel:
```typescript
{
  inApp: { total, sent, failed, skipped, pending },
  email: { total, sent, failed, skipped, pending },
  telegram: { total, sent, failed, skipped, pending }
}
```

#### Latest Failures

```typescript
export async function getLatestFailedDeliveries(userId: string, limit = 10)
export async function getLatestTelegramFailures(limit = 10)
export async function getLatestEmailFailures(limit = 10)
```

Returns array of failed deliveries with notification details.

### Usage Examples

```typescript
// Get stats for a user
const stats = await getDeliveryStats(userId);
console.log(`Email: ${stats.email.sent}/${stats.email.total} sent`);

// Get latest failures
const failures = await getLatestTelegramFailures(5);
failures.forEach(f => {
  console.log(`${f.notification?.type}: ${f.errorMessage}`);
});
```

---

## Deduplication Audit Results

### Current State

All booking notification types are protected from duplication:

✅ **BOOKING_CREATED** — One per booking (unique constraint)  
✅ **BOOKING_CONFIRMED** — One per status change (dedup check)  
✅ **BOOKING_CANCELLED** — One per status change (dedup check)  
✅ **BOOKING_COMPLETED** — One per status change (dedup check)  
✅ **BOOKING_FEEDBACK_REQUEST** — One per booking (dedup check)  
✅ **BOOKING_STALE** — Max 1 per 24h (dedup check + 24h window)  
✅ **BOOKING_NEEDS_ATTENTION** — Max 1 per 24h (dedup check + 24h window)  

### Audit Service

Use `auditNotificationDedup()` to check for duplicates:

```typescript
import { auditNotificationDedup } from "@/server/services/notificationDedup.service";

// Audit BOOKING_STALE
const result = await auditNotificationDedup("BOOKING_STALE");
console.log(`${result.duplicateCount} duplicates found (${result.duplicatePercentage}%)`);

// Audit all types
const allResults = await auditAllNotificationDedup();
```

---

## Retry Policy Testing

### Manual Testing

```typescript
import { retryFailedDelivery } from "@/server/services/notificationDelivery.service";

// Retry a specific delivery
const success = await retryFailedDelivery(deliveryId);
console.log(success ? "Retry succeeded" : "Retry failed");
```

### Automatic Retry

For production, implement a background job:

```typescript
// Find all FAILED deliveries and retry
const failed = await prisma.notificationDelivery.findMany({
  where: { status: "FAILED", attemptCount: { lt: 3 } },
  take: 100,
});

for (const delivery of failed) {
  await retryFailedDelivery(delivery.id);
}
```

---

## Stale Booking Job Testing

### Manual Testing

```typescript
import { runBookingStaleNotificationJob } from "@/server/jobs/bookingStale.job";

// Run job manually
const result = await runBookingStaleNotificationJob();
console.log(`Checked: ${result.checked}, Notified: ${result.notified}`);
```

### Verification

1. Create a booking in NEW status
2. Wait 24+ hours (or manually set `createdAt` in DB)
3. Run job: `await runBookingStaleNotificationJob()`
4. Verify notification created for business owner
5. Run job again: Should skip due to dedup

---

## Files Modified/Created

### Created

1. `src/server/jobs/bookingStale.job.ts` — Scheduled job service
2. `src/server/services/notificationDedup.service.ts` — Deduplication service

### Modified

1. `prisma/schema.prisma` — Added `attemptCount` field to `NotificationDelivery`
2. `src/server/services/notificationDelivery.service.ts` — Added retry logic and diagnostics
3. `src/server/services/notification.service.ts` — Added dedup checks to booking notifications

---

## Database Schema Changes

### NotificationDelivery Model

Added field:
```prisma
attemptCount   Int                        @default(0)
```

This tracks the number of retry attempts for failed deliveries.

---

## Verification Checklist

✅ **Deduplication**:
- BOOKING_CREATED protected (one per booking)
- BOOKING_CONFIRMED protected (one per status change)
- BOOKING_CANCELLED protected (one per status change)
- BOOKING_COMPLETED protected (one per status change)
- BOOKING_FEEDBACK_REQUEST protected (one per booking)
- BOOKING_STALE protected (max 1 per 24h)
- BOOKING_NEEDS_ATTENTION protected (max 1 per 24h)

✅ **Retry Policy**:
- Transient errors retry with exponential backoff
- Permanent errors don't retry
- Max 3 attempts per delivery
- Attempt count tracked in DB

✅ **Stale Booking Job**:
- Finds NEW bookings > 24h old
- Finds CONFIRMED bookings > 72h inactive
- Creates BOOKING_STALE/BOOKING_NEEDS_ATTENTION notifications
- Respects deduplication (max 1 per 24h)
- Batch processing (100 per run)
- Fire-and-forget pattern

✅ **Delivery Diagnostics**:
- `getDeliveryStats()` returns stats by channel
- `getLatestFailedDeliveries()` returns failed deliveries
- `getLatestTelegramFailures()` returns Telegram failures
- `getLatestEmailFailures()` returns email failures

✅ **TypeScript**:
- `pnpm tsc --noEmit` passes (only pre-existing error in bookingActivity.service.ts)

✅ **No Breaking Changes**:
- Backward compatible
- Registry unchanged
- Prisma enum unchanged
- Existing triggers still work

---

## Next Steps

### Phase 2J: Production Readiness Checklist

- [ ] Set up scheduled job in production cron
- [ ] Configure retry job (every 5 minutes)
- [ ] Set up monitoring/alerting for failures
- [ ] Create admin dashboard for delivery diagnostics
- [ ] Document retry policy for team
- [ ] Test failover scenarios

### Phase 2K: Discovery Tuning on Real Data

- [ ] Analyze notification delivery patterns
- [ ] Optimize batch sizes based on load
- [ ] Tune retry backoff based on failure patterns
- [ ] Monitor stale booking detection accuracy

---

## Summary

Phase 2I successfully implements notification reliability features:

**Deduplication**: All booking notifications protected from duplicates with configurable time windows

**Retry Logic**: Transient errors retry with exponential backoff (1s, 2s, 4s), permanent errors fail immediately

**Stale Booking Job**: Scheduled job detects and notifies about stale bookings (NEW > 24h, CONFIRMED > 72h inactive)

**Delivery Diagnostics**: Track delivery stats, failures, and retry attempts per channel

**Status**: ✅ Ready for Phase 2J (Production Readiness Checklist)

---

## Implementation Details

### Deduplication Flow

```
createNotification(params)
  ↓
checkNotificationDedup(userId, type, entityType, entityId)
  ↓
isDuplicate? → YES → return null (skip creation)
  ↓ NO
createNotification() → save to DB → dispatchDelivery()
```

### Retry Flow

```
dispatchDelivery() → handleEmail/handleTelegram()
  ↓
Error? → YES → save as FAILED
  ↓ NO
save as SENT
  ↓
Later: retryFailedDelivery(deliveryId)
  ↓
isTransientError? → NO → return false (don't retry)
  ↓ YES
attemptCount < 3? → NO → return false (max attempts)
  ↓ YES
sleep(exponentialBackoff) → retry send
  ↓
Success? → YES → update status to SENT
  ↓ NO
update status to FAILED, increment attemptCount
```

### Stale Booking Job Flow

```
runBookingStaleNotificationJob()
  ↓
Find stale bookings (NEW > 24h, CONFIRMED > 72h)
  ↓
For each booking:
  ↓
  wasRecentlyNotified? → YES → skip (dedup)
  ↓ NO
  createNotification(BOOKING_STALE/BOOKING_NEEDS_ATTENTION)
  ↓
Return result { checked, notified, skipped, errors }
```

---

## Configuration

### Stale Thresholds

```typescript
const STALE_NEW_HOURS = 24;           // NEW > 24h
const STALE_CONFIRMED_HOURS = 72;     // CONFIRMED > 72h
const DEDUP_WINDOW_HOURS = 24;        // Max 1 reminder per 24h
const BATCH_SIZE = 100;               // Max bookings per run
```

### Retry Configuration

```typescript
const maxAttempts = 3;
const backoff = [1000, 2000, 4000];   // ms: 1s, 2s, 4s
```

---

## Monitoring

### Key Metrics

- Delivery success rate by channel
- Retry success rate
- Deduplication hit rate
- Stale booking detection accuracy
- Job execution time

### Alerts

- High failure rate (>5% for critical types)
- Retry exhaustion (max attempts exceeded)
- Job timeout (>30s)
- Deduplication anomalies

---

## Documentation

For developers:
- Use `checkNotificationDedup()` before creating reminders
- Use `retryFailedDelivery()` in background jobs
- Use `runBookingStaleNotificationJob()` in cron scheduler
- Use diagnostics functions for monitoring

For operations:
- Schedule stale booking job every 1 hour
- Schedule retry job every 5 minutes
- Monitor delivery stats dashboard
- Alert on high failure rates
