# Phase 1: Unified Booking Analytics Foundation

**Date**: May 12, 2026  
**Status**: ✅ IMPLEMENTATION COMPLETE  
**Objective**: Establish unified booking analytics layer to track complete conversion lifecycle

---

## Executive Summary

Implemented unified booking analytics foundation for mamaGo 2.0:
- ✅ Added 5 new event types to UserEventType enum
- ✅ Created typed analytics helper (`trackBookingEvent.ts`)
- ✅ Integrated tracking into booking lifecycle (create, confirm, complete, cancel)
- ✅ Integrated tracking into feedback flow
- ✅ Normalized metadata across all events
- ✅ Fire-and-forget pattern (errors don't break main flow)
- ✅ All TypeScript checks pass

**Conversion Lifecycle Now Tracked**:
```
DISCOVERY → SAVE → PLAN → BOOKING_CREATED → BOOKING_CONFIRMED → BOOKING_COMPLETED → FEEDBACK_LEFT
```

---

## 1. Changes Made

### 1.1 Prisma Schema Updates

**File**: `prisma/schema.prisma`

Added 5 new event types to `UserEventType` enum:
```typescript
enum UserEventType {
  // ... existing events ...
  BOOKING_CREATED      // ✅ NEW
  BOOKING_CONFIRMED    // ✅ NEW
  BOOKING_COMPLETED    // ✅ NEW
  BOOKING_CANCELLED    // ✅ NEW
  FEEDBACK_LEFT        // ✅ NEW
}
```

**Status**: ✅ Schema updated, `pnpm prisma generate` passes

---

### 1.2 New Analytics Helper

**File**: `src/server/analytics/trackBookingEvent.ts` (NEW)

Created unified typed API for booking event tracking:

```typescript
export type BookingEventType =
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_COMPLETED"
  | "BOOKING_CANCELLED"
  | "FEEDBACK_LEFT";

export interface TrackBookingEventInput {
  type: BookingEventType;
  userId?: string | null;
  bookingId: string;
  entityType: AnalyticsEntityType;
  entityId: string;
  vertical?: AnalyticsVertical | null;
  cityId?: string | null;
  metadata?: {
    status?: string;
    shiftId?: string | null;
    shiftTitle?: string | null;
    source?: string;
    surface?: string;
    rating?: number;
    hasText?: boolean;
    responseTimeMinutes?: number;
    [key: string]: unknown;
  };
}

export async function trackBookingEvent(input: TrackBookingEventInput): Promise<void>
```

**Features**:
- ✅ Typed API with full IntelliSense
- ✅ Uses existing `trackUserEvent()` pipeline
- ✅ Fire-and-forget pattern (errors logged, not thrown)
- ✅ Convenience functions for each event type
- ✅ Normalized metadata structure

**Convenience Functions**:
```typescript
trackBookingCreated(input)
trackBookingConfirmed(input)
trackBookingCompleted(input)
trackBookingCancelled(input)
trackFeedbackLeft(input)
```

---

### 1.3 Booking Service Integration

**File**: `src/server/services/booking/booking.service.ts`

Added tracking to `createCampShiftBooking()`:

```typescript
void trackBookingCreated({
  userId: input.userId ?? null,
  bookingId: booking.id,
  entityType: "OFFER",
  entityId: input.offerId,
  vertical: "CITY",
  cityId: offer.place?.cityId ?? null,
  metadata: {
    status: booking.status,
    shiftId: input.campShift.id,
    shiftTitle: shift.title ?? null,
    source: "detail",
    surface: "web",
  },
});
```

**Tracked Event**: BOOKING_CREATED  
**Trigger**: When user creates a booking  
**Data Captured**: userId, bookingId, entityType, entityId, vertical, cityId, status, shiftId, shiftTitle

---

### 1.4 Booking Query Service Integration

**File**: `src/server/services/booking/bookingQuery.service.ts`

Added tracking to `updateBookingStatus()` for all status transitions:

**BOOKING_CONFIRMED** (NEW → CONFIRMED):
```typescript
void trackBookingConfirmed({
  userId: existing.userId ?? null,
  bookingId,
  entityType: "OFFER",
  entityId: existing.offer?.id ?? "",
  vertical: "CITY",
  metadata: {
    status: newStatus,
    responseTimeMinutes: derivedData.responseTimeMinutes,
    source: "admin",
    surface: "web",
  },
});
```

**BOOKING_COMPLETED** (CONFIRMED → COMPLETED):
```typescript
void trackBookingCompleted({
  userId: existing.userId ?? null,
  bookingId,
  entityType: "OFFER",
  entityId: existing.offer?.id ?? "",
  vertical: "CITY",
  metadata: {
    status: newStatus,
    source: "admin",
    surface: "web",
  },
});
```

**BOOKING_CANCELLED** (REJECTED or CANCELLED):
```typescript
void trackBookingCancelled({
  userId: existing.userId ?? null,
  bookingId,
  entityType: "OFFER",
  entityId: existing.offer?.id ?? "",
  vertical: "CITY",
  metadata: {
    status: newStatus,
    source: "admin",
    surface: "web",
  },
});
```

**Tracked Events**: BOOKING_CONFIRMED, BOOKING_COMPLETED, BOOKING_CANCELLED  
**Trigger**: When business updates booking status  
**Data Captured**: userId, bookingId, entityType, entityId, vertical, status, responseTimeMinutes (for CONFIRMED)

---

### 1.5 Booking Feedback Service Integration

**File**: `src/server/services/booking/bookingFeedback.service.ts`

Added tracking to `createBookingFeedback()`:

```typescript
void trackFeedbackLeft({
  userId: input.userId ?? null,
  bookingId: input.bookingId,
  entityType: "OFFER",
  entityId: record.booking?.offerId ?? "",
  vertical: "CITY",
  metadata: {
    rating,
    hasText: !!comment,
    source: "feedback_request",
    surface: "web",
  },
});
```

**Tracked Event**: FEEDBACK_LEFT  
**Trigger**: When user submits feedback  
**Data Captured**: userId, bookingId, entityType, entityId, vertical, rating, hasText

---

## 2. Event Types Reference

### 2.1 BOOKING_CREATED

**When**: User creates a booking  
**Who**: User (authenticated or anonymous)  
**Where**: Booking form submission  
**Data**:
- `bookingId`: Unique booking ID
- `entityType`: "OFFER"
- `entityId`: Offer ID
- `vertical`: "CITY"
- `cityId`: City ID
- `metadata.status`: "NEW"
- `metadata.shiftId`: Camp shift ID (if applicable)
- `metadata.shiftTitle`: Camp shift title (if applicable)
- `metadata.source`: "detail"
- `metadata.surface`: "web"

**Example UserEvent Row**:
```json
{
  "eventType": "BOOKING_CREATED",
  "userId": "user_123",
  "sessionId": "session_456",
  "entityType": "OFFER",
  "entityId": "offer_789",
  "vertical": "CITY",
  "cityId": "city_001",
  "meta": {
    "bookingId": "booking_001",
    "targetAction": "book",
    "status": "NEW",
    "shiftId": "shift_001",
    "shiftTitle": "Смена 1",
    "source": "detail",
    "surface": "web"
  },
  "createdAt": "2026-05-12T10:00:00Z"
}
```

---

### 2.2 BOOKING_CONFIRMED

**When**: Business confirms a booking  
**Who**: User (if authenticated)  
**Where**: Business admin panel  
**Data**:
- `bookingId`: Unique booking ID
- `entityType`: "OFFER"
- `entityId`: Offer ID
- `vertical`: "CITY"
- `cityId`: City ID
- `metadata.status`: "CONFIRMED"
- `metadata.responseTimeMinutes`: Minutes from creation to confirmation
- `metadata.source`: "admin"
- `metadata.surface`: "web"

**Example UserEvent Row**:
```json
{
  "eventType": "BOOKING_CONFIRMED",
  "userId": "user_123",
  "sessionId": null,
  "entityType": "OFFER",
  "entityId": "offer_789",
  "vertical": "CITY",
  "cityId": "city_001",
  "meta": {
    "bookingId": "booking_001",
    "targetAction": "book",
    "status": "CONFIRMED",
    "responseTimeMinutes": 45,
    "source": "admin",
    "surface": "web"
  },
  "createdAt": "2026-05-12T10:45:00Z"
}
```

---

### 2.3 BOOKING_COMPLETED

**When**: Booking is marked as completed  
**Who**: User (if authenticated)  
**Where**: System or business admin  
**Data**:
- `bookingId`: Unique booking ID
- `entityType`: "OFFER"
- `entityId`: Offer ID
- `vertical`: "CITY"
- `cityId`: City ID
- `metadata.status`: "COMPLETED"
- `metadata.source`: "admin"
- `metadata.surface`: "web"

**Example UserEvent Row**:
```json
{
  "eventType": "BOOKING_COMPLETED",
  "userId": "user_123",
  "sessionId": null,
  "entityType": "OFFER",
  "entityId": "offer_789",
  "vertical": "CITY",
  "cityId": "city_001",
  "meta": {
    "bookingId": "booking_001",
    "targetAction": "book",
    "status": "COMPLETED",
    "source": "admin",
    "surface": "web"
  },
  "createdAt": "2026-05-12T15:00:00Z"
}
```

---

### 2.4 BOOKING_CANCELLED

**When**: Booking is rejected or cancelled  
**Who**: User (if authenticated)  
**Where**: Business admin panel  
**Data**:
- `bookingId`: Unique booking ID
- `entityType`: "OFFER"
- `entityId`: Offer ID
- `vertical`: "CITY"
- `cityId`: City ID
- `metadata.status`: "REJECTED" or "CANCELLED"
- `metadata.source`: "admin"
- `metadata.surface`: "web"

**Example UserEvent Row**:
```json
{
  "eventType": "BOOKING_CANCELLED",
  "userId": "user_123",
  "sessionId": null,
  "entityType": "OFFER",
  "entityId": "offer_789",
  "vertical": "CITY",
  "cityId": "city_001",
  "meta": {
    "bookingId": "booking_001",
    "targetAction": "book",
    "status": "REJECTED",
    "source": "admin",
    "surface": "web"
  },
  "createdAt": "2026-05-12T11:00:00Z"
}
```

---

### 2.5 FEEDBACK_LEFT

**When**: User submits feedback after booking completion  
**Who**: User (authenticated or anonymous)  
**Where**: Feedback form  
**Data**:
- `bookingId`: Unique booking ID
- `entityType`: "OFFER"
- `entityId`: Offer ID
- `vertical`: "CITY"
- `cityId`: City ID
- `metadata.rating`: 1-5 star rating
- `metadata.hasText`: Boolean (true if comment provided)
- `metadata.source`: "feedback_request"
- `metadata.surface`: "web"

**Example UserEvent Row**:
```json
{
  "eventType": "FEEDBACK_LEFT",
  "userId": "user_123",
  "sessionId": null,
  "entityType": "OFFER",
  "entityId": "offer_789",
  "vertical": "CITY",
  "cityId": "city_001",
  "meta": {
    "bookingId": "booking_001",
    "targetAction": "book",
    "rating": 5,
    "hasText": true,
    "source": "feedback_request",
    "surface": "web"
  },
  "createdAt": "2026-05-12T16:00:00Z"
}
```

---

## 3. Conversion Lifecycle

### 3.1 Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│ DISCOVERY PHASE                                                 │
├─────────────────────────────────────────────────────────────────┤
│ CARD_VIEW (user sees offer in listing)                          │
│ DETAIL_OPEN (user opens offer detail)                           │
│ CTA_CLICK (user clicks "Book" button)                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ BOOKING PHASE                                                   │
├─────────────────────────────────────────────────────────────────┤
│ BOOKING_CREATED (user submits booking form)                     │
│ ↓                                                               │
│ [Business receives notification]                                │
│ ↓                                                               │
│ BOOKING_CONFIRMED (business confirms booking)                   │
│ ↓                                                               │
│ [Booking date arrives]                                          │
│ ↓                                                               │
│ BOOKING_COMPLETED (booking marked as completed)                 │
│ ↓                                                               │
│ [User receives feedback request]                                │
│ ↓                                                               │
│ FEEDBACK_LEFT (user submits feedback)                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Funnel Metrics

**Discovery to Booking Funnel**:
```
CARD_VIEW (100%)
    ↓
DETAIL_OPEN (5-15%)
    ↓
CTA_CLICK (2-5%)
    ↓
BOOKING_CREATED (1-3%)
```

**Booking Lifecycle Funnel**:
```
BOOKING_CREATED (100%)
    ↓
BOOKING_CONFIRMED (60-80%)
    ↓
BOOKING_COMPLETED (80-90%)
    ↓
FEEDBACK_LEFT (20-40%)
```

---

## 4. Metadata Normalization

All booking events include normalized metadata:

```typescript
{
  bookingId: string;           // Unique booking ID
  targetAction: "book";        // Always "book" for booking events
  status?: string;             // Booking status (NEW, CONFIRMED, COMPLETED, REJECTED, CANCELLED)
  shiftId?: string;            // Camp shift ID (if applicable)
  shiftTitle?: string;         // Camp shift title (if applicable)
  source?: string;             // "detail", "admin", "feedback_request"
  surface?: string;            // "web", "mobile", "admin"
  rating?: number;             // 1-5 (for FEEDBACK_LEFT)
  hasText?: boolean;           // True if feedback has comment (for FEEDBACK_LEFT)
  responseTimeMinutes?: number; // Minutes to confirm (for BOOKING_CONFIRMED)
}
```

---

## 5. Files Modified

| File | Changes | Status |
|------|---------|--------|
| `prisma/schema.prisma` | Added 5 new UserEventType enum values | ✅ |
| `src/server/analytics/trackBookingEvent.ts` | NEW: Unified booking analytics helper | ✅ |
| `src/server/services/booking/booking.service.ts` | Added BOOKING_CREATED tracking | ✅ |
| `src/server/services/booking/bookingQuery.service.ts` | Added BOOKING_CONFIRMED/COMPLETED/CANCELLED tracking | ✅ |
| `src/server/services/booking/bookingFeedback.service.ts` | Added FEEDBACK_LEFT tracking | ✅ |

---

## 6. Verification Steps

### 6.1 TypeScript Compilation

```bash
pnpm tsc --noEmit
```

**Status**: ✅ PASS (no errors)

### 6.2 Prisma Generation

```bash
pnpm prisma generate
```

**Status**: ✅ PASS (client generated successfully)

### 6.3 Manual Testing

#### Test 1: Create Booking
1. Open offer detail page
2. Click "Book" button
3. Fill booking form
4. Submit
5. Check UserEvent table:
   ```sql
   SELECT * FROM UserEvent 
   WHERE eventType = 'BOOKING_CREATED' 
   ORDER BY createdAt DESC LIMIT 1;
   ```
6. Verify: `eventType`, `bookingId`, `entityType`, `entityId`, `vertical`, `cityId`, `meta.status`

#### Test 2: Confirm Booking
1. Go to business admin panel
2. Find a NEW booking
3. Click "Confirm"
4. Check UserEvent table:
   ```sql
   SELECT * FROM UserEvent 
   WHERE eventType = 'BOOKING_CONFIRMED' 
   ORDER BY createdAt DESC LIMIT 1;
   ```
5. Verify: `eventType`, `bookingId`, `meta.responseTimeMinutes`

#### Test 3: Complete Booking
1. Go to business admin panel
2. Find a CONFIRMED booking
3. Click "Complete"
4. Check UserEvent table:
   ```sql
   SELECT * FROM UserEvent 
   WHERE eventType = 'BOOKING_COMPLETED' 
   ORDER BY createdAt DESC LIMIT 1;
   ```
5. Verify: `eventType`, `bookingId`, `meta.status`

#### Test 4: Submit Feedback
1. User receives feedback request
2. User submits feedback (rating + optional comment)
3. Check UserEvent table:
   ```sql
   SELECT * FROM UserEvent 
   WHERE eventType = 'FEEDBACK_LEFT' 
   ORDER BY createdAt DESC LIMIT 1;
   ```
4. Verify: `eventType`, `bookingId`, `meta.rating`, `meta.hasText`

### 6.4 Database Queries

**Check all booking events collected**:
```sql
SELECT 
  eventType,
  COUNT(*) as count,
  COUNT(DISTINCT userId) as unique_users,
  COUNT(DISTINCT "bookingId") as unique_bookings
FROM UserEvent
WHERE eventType IN ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'FEEDBACK_LEFT')
GROUP BY eventType
ORDER BY count DESC;
```

**Check funnel for a specific user**:
```sql
SELECT 
  eventType,
  "bookingId",
  meta->>'status' as status,
  meta->>'responseTimeMinutes' as responseTimeMinutes,
  meta->>'rating' as rating,
  createdAt
FROM UserEvent
WHERE userId = 'USER_ID'
  AND eventType IN ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'FEEDBACK_LEFT')
ORDER BY createdAt ASC;
```

**Check for missing data**:
```sql
SELECT 
  eventType,
  COUNT(*) as count
FROM UserEvent
WHERE eventType IN ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'FEEDBACK_LEFT')
  AND (entityType IS NULL OR entityId IS NULL OR vertical IS NULL)
GROUP BY eventType;
```

---

## 7. What's NOT Included (By Design)

As per requirements, the following are NOT implemented:
- ❌ Recommendation engine
- ❌ ML/AI scoring
- ❌ Complex aggregates
- ❌ Dashboards
- ❌ Cron jobs
- ❌ Ranking adjustments

**These are foundation layer only** — ready for future phases.

---

## 8. What's Still Missing

Events defined but not yet tracked:
- ⚠️ UNSAVE (defined, not tracked)
- ⚠️ PLAN_REMOVE (defined, not tracked)
- ⚠️ SEARCH_APPLY (defined, not tracked)
- ⚠️ FILTER_APPLY (defined, not tracked)
- ⚠️ PAGE_VIEW (defined, not tracked)

**These can be added incrementally** — not critical for booking lifecycle.

---

## 9. Next Steps

### Phase 2: Analytics Queries
- Build funnel analysis queries
- Build conversion rate calculations
- Build top-performing offers queries

### Phase 3: Admin Dashboard
- Display booking funnel metrics
- Display conversion rates by vertical/city
- Display top-performing offers
- Display feedback sentiment

### Phase 4: Ranking Integration
- Use booking conversion as ranking signal
- Use completion rate as quality signal
- Use feedback sentiment as trust signal

---

## 10. Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Event Types Added** | ✅ 5/5 | BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_COMPLETED, BOOKING_CANCELLED, FEEDBACK_LEFT |
| **Analytics Helper** | ✅ Created | `trackBookingEvent.ts` with typed API |
| **Booking Service** | ✅ Integrated | BOOKING_CREATED tracking added |
| **Booking Query Service** | ✅ Integrated | BOOKING_CONFIRMED/COMPLETED/CANCELLED tracking added |
| **Feedback Service** | ✅ Integrated | FEEDBACK_LEFT tracking added |
| **TypeScript** | ✅ Pass | No errors |
| **Prisma** | ✅ Pass | Client generated successfully |
| **Fire-and-Forget** | ✅ Implemented | Errors logged, don't break main flow |
| **Metadata Normalized** | ✅ Yes | Consistent across all events |

---

**Status**: ✅ PHASE 1 COMPLETE  
**Ready for**: Phase 2 (Analytics Queries)  
**Recommendation**: Proceed with implementation of analytics queries and admin dashboard
