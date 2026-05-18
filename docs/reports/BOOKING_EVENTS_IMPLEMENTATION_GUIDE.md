# Booking Events Implementation Guide

**Phase**: 2K-1 (Post-audit implementation)  
**Priority**: 🔴 HIGH (Required for post-launch ranking tuning)  
**Estimated Effort**: 2-3 hours  
**Status**: READY FOR IMPLEMENTATION

---

## Overview

This guide provides step-by-step instructions for adding booking/feedback event tracking to the analytics system.

**Events to Implement**:
1. BOOKING_CREATED — When user creates a booking
2. BOOKING_CONFIRMED — When business confirms a booking
3. BOOKING_COMPLETED — When booking is marked as completed
4. FEEDBACK_LEFT — When user submits feedback

---

## Prerequisites

- ✅ Analytics infrastructure is working (CARD_VIEW, DETAIL_OPEN, SAVE, PLAN_ADD, CTA_CLICK)
- ✅ `trackUserEvent()` function is available in `src/server/services/analytics/AnalyticsEventService.ts`
- ✅ UserEventType enum includes all four events (verify in `prisma/schema.prisma`)

---

## Step 1: Verify UserEventType Enum

**File**: `prisma/schema.prisma`

**Check**: Ensure these events are in the enum:
```typescript
enum UserEventType {
  // ... existing events ...
  BOOKING_CREATED      // ← Should be here
  BOOKING_CONFIRMED    // ← Should be here
  BOOKING_COMPLETED    // ← Should be here
  FEEDBACK_LEFT        // ← Should be here
}
```

**If Missing**: Add them to the enum and run:
```bash
pnpm prisma migrate dev --name add_booking_events
pnpm prisma generate
```

---

## Step 2: Add BOOKING_CREATED Tracking

**File**: `src/server/services/booking/booking.service.ts` (or similar)

**Location**: In the function that creates a booking (e.g., `createBooking()`)

**Code to Add**:
```typescript
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";

// After booking is successfully created:
void trackUserEvent({
  userId: booking.userId,
  sessionId: null, // Server-side event, no session context
  eventType: "BOOKING_CREATED",
  entityType: "OFFER", // or "EVENT" depending on your model
  entityId: booking.offerId, // or booking.eventId
  vertical: offer.vertical, // Get from offer/event
  cityId: offer.cityId, // Get from offer/event
  meta: {
    targetAction: "book",
    source: "detail",
    bookingId: booking.id,
    status: booking.status,
  },
});
```

**Notes**:
- Use `void` to fire-and-forget (don't await)
- `sessionId: null` is OK for server-side events
- Include `bookingId` in meta for debugging
- Get `vertical` and `cityId` from the offer/event being booked

---

## Step 3: Add BOOKING_CONFIRMED Tracking

**File**: `src/server/services/booking/booking.service.ts` (or similar)

**Location**: In the function that confirms a booking (e.g., `confirmBooking()`)

**Code to Add**:
```typescript
// After booking is successfully confirmed:
void trackUserEvent({
  userId: booking.userId,
  sessionId: null,
  eventType: "BOOKING_CONFIRMED",
  entityType: "OFFER",
  entityId: booking.offerId,
  vertical: offer.vertical,
  cityId: offer.cityId,
  meta: {
    targetAction: "book",
    source: "detail",
    bookingId: booking.id,
    status: booking.status,
    confirmedAt: new Date().toISOString(),
  },
});
```

**Notes**:
- Triggered when business confirms the booking
- Same structure as BOOKING_CREATED
- Include `confirmedAt` timestamp in meta

---

## Step 4: Add BOOKING_COMPLETED Tracking

**File**: `src/server/services/booking/booking.service.ts` (or similar)

**Location**: In the function that marks booking as completed (e.g., `completeBooking()`)

**Code to Add**:
```typescript
// After booking is successfully completed:
void trackUserEvent({
  userId: booking.userId,
  sessionId: null,
  eventType: "BOOKING_COMPLETED",
  entityType: "OFFER",
  entityId: booking.offerId,
  vertical: offer.vertical,
  cityId: offer.cityId,
  meta: {
    targetAction: "book",
    source: "detail",
    bookingId: booking.id,
    status: booking.status,
    completedAt: new Date().toISOString(),
  },
});
```

**Notes**:
- Triggered when booking date passes and is marked as completed
- Include `completedAt` timestamp in meta

---

## Step 5: Add FEEDBACK_LEFT Tracking

**File**: `src/server/services/feedback/feedback.service.ts` (or similar)

**Location**: In the function that submits feedback (e.g., `submitFeedback()`)

**Code to Add**:
```typescript
// After feedback is successfully created:
void trackUserEvent({
  userId: feedback.userId,
  sessionId: null,
  eventType: "FEEDBACK_LEFT",
  entityType: "OFFER",
  entityId: feedback.offerId,
  vertical: offer.vertical,
  cityId: offer.cityId,
  meta: {
    targetAction: "feedback",
    source: "detail",
    bookingId: feedback.bookingId,
    rating: feedback.rating, // 1-5
    hasText: !!feedback.text,
    textLength: feedback.text?.length ?? 0,
  },
});
```

**Notes**:
- Triggered when user submits feedback/review
- Include `rating` and `hasText` in meta for analysis
- Include `bookingId` to link back to booking

---

## Step 6: Verification

### 6.1 Type Check
```bash
pnpm tsc --noEmit
```

**Expected**: No new errors (only pre-existing bookingActivity.service.ts error is OK)

### 6.2 Manual Testing

**Test Scenario**: Create a booking and verify events are tracked

1. **Create Booking**:
   - Open offer detail page
   - Click "Book" button
   - Fill booking form
   - Submit
   - Check UserEvent table for BOOKING_CREATED entry

2. **Confirm Booking** (as business):
   - Go to business bookings page
   - Click "Confirm" on a booking
   - Check UserEvent table for BOOKING_CONFIRMED entry

3. **Complete Booking**:
   - Wait for booking date to pass (or manually trigger completion)
   - Check UserEvent table for BOOKING_COMPLETED entry

4. **Submit Feedback**:
   - User sees feedback request
   - User submits feedback
   - Check UserEvent table for FEEDBACK_LEFT entry

### 6.3 Database Verification

```sql
-- Check all booking events
SELECT 
  eventType,
  COUNT(*) as count,
  COUNT(DISTINCT userId) as unique_users
FROM UserEvent
WHERE eventType IN ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'FEEDBACK_LEFT')
GROUP BY eventType;

-- Check funnel for a specific user
SELECT 
  eventType,
  entityId,
  meta,
  createdAt
FROM UserEvent
WHERE userId = 'USER_ID'
  AND eventType IN ('CARD_VIEW', 'DETAIL_OPEN', 'CTA_CLICK', 'BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'FEEDBACK_LEFT')
ORDER BY createdAt ASC;
```

---

## Step 7: Update Report

After implementation, update `docs/reports/DISCOVERY_ANALYTICS_READINESS_PHASE2K.md`:

1. Change status of BOOKING_CREATED from ❌ to ✅
2. Change status of BOOKING_CONFIRMED from ❌ to ✅
3. Change status of BOOKING_COMPLETED from ❌ to ✅
4. Change status of FEEDBACK_LEFT from ❌ to ✅
5. Add implementation details and locations
6. Update "Summary Table" section

---

## Implementation Checklist

- [ ] Verify UserEventType enum has all four events
- [ ] Add BOOKING_CREATED tracking in booking creation flow
- [ ] Add BOOKING_CONFIRMED tracking in business confirmation flow
- [ ] Add BOOKING_COMPLETED tracking in completion flow
- [ ] Add FEEDBACK_LEFT tracking in feedback submission flow
- [ ] Run `pnpm tsc --noEmit` (should pass)
- [ ] Manual test: Create booking → Confirm → Complete → Feedback
- [ ] Verify events in UserEvent table
- [ ] Update DISCOVERY_ANALYTICS_READINESS_PHASE2K.md report
- [ ] Commit changes

---

## Common Issues & Solutions

### Issue: "BOOKING_CREATED is not a valid UserEventType"
**Solution**: Add event to `prisma/schema.prisma` enum and run migration

### Issue: "Cannot find trackUserEvent"
**Solution**: Import from `@/server/services/analytics/AnalyticsEventService`

### Issue: "sessionId is required"
**Solution**: Use `sessionId: null` for server-side events (no session context)

### Issue: "entityType must be EVENT, PLACE, OFFER, or ROUTE"
**Solution**: Use `entityType: "OFFER"` (or "EVENT" if booking is for an event)

### Issue: "vertical is required"
**Solution**: Get vertical from the offer/event being booked

### Issue: "cityId is required"
**Solution**: Get cityId from the offer/event being booked

---

## Performance Considerations

- ✅ `trackUserEvent()` is fire-and-forget (uses `void`)
- ✅ No await needed (async operation in background)
- ✅ Errors are caught and logged, don't break main flow
- ✅ Database insert is lightweight (single row)

**Impact**: Negligible (< 1ms per event)

---

## Post-Implementation Monitoring

### Week 1: Verify Data Collection
- Check UserEvent table for all four event types
- Verify event counts are reasonable
- Check for any NULL values in required fields

### Week 2: Analyze Funnel
- Calculate BOOKING_CREATED rate (CTA_CLICK → BOOKING_CREATED)
- Calculate BOOKING_CONFIRMED rate (BOOKING_CREATED → BOOKING_CONFIRMED)
- Calculate BOOKING_COMPLETED rate (BOOKING_CONFIRMED → BOOKING_COMPLETED)
- Calculate FEEDBACK_LEFT rate (BOOKING_COMPLETED → FEEDBACK_LEFT)

### Week 3: Identify Issues
- Find offers with low booking conversion
- Find offers with low completion rate
- Find offers with low feedback submission rate

### Week 4: Implement Ranking Tuning
- Boost offers with high booking conversion
- Penalize offers with low completion rate
- Boost offers with positive feedback

---

## Related Files

- `src/server/services/analytics/AnalyticsEventService.ts` — Event tracking function
- `src/lib/analytics/types.ts` — Type definitions
- `prisma/schema.prisma` — UserEventType enum
- `docs/reports/DISCOVERY_ANALYTICS_READINESS_PHASE2K.md` — Full audit report

---

## Questions?

Refer to:
1. `docs/reports/DISCOVERY_ANALYTICS_READINESS_PHASE2K.md` — Full audit report
2. `src/app/api/save/plan/route.ts` — Example of trackUserEvent usage
3. `src/app/api/save/idea/route.ts` — Another example of trackUserEvent usage

---

**Status**: Ready for implementation  
**Estimated Time**: 2-3 hours  
**Impact**: Enables post-launch ranking optimization
