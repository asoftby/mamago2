# ✅ Activity V2 - Auto-Classification System - COMPLETE

## Overview

Implemented new Activity model with automatic section classification based on type and schedule mode. Business owners don't manually choose sections - the system automatically determines where activities will appear.

## Database Schema

### New Enums

```prisma
enum ActivityType {
  EVENT         // Разовое мероприятие → "Куда пойти"
  PERMANENT     // Постоянное место → "Куда пойти" + "Всегда рядом"
  COURSE        // Курс/занятие → "Занятия"
  ROUTE         // Маршрут (без привязки к месту) → "Куда пойти"
  OFFER         // Предложение для ДР → "Куда пойти" (для будущего конструктора ДР)
}

enum ScheduleMode {
  ONE_TIME    // Одна дата/время (EVENT)
  MULTI_DATE  // Несколько конкретных дат (EVENT)
  RECURRING   // Повторяющееся расписание (COURSE, PERMANENT)
  ON_DEMAND   // По запросу (PERMANENT, COURSE)
  ALWAYS      // Всегда доступно (PERMANENT)
}
```

### Updated Activity Model

```prisma
model Activity {
  id     String       @id @default(cuid())
  placeId String?     // Required for EVENT/PERMANENT/COURSE/OFFER; nullable for ROUTE
  
  // Activity classification
  type   ActivityType
  status ContentStatus @default(DRAFT)
  
  // Basic info
  title       String
  shortDesc   String
  description String?
  
  // Age targeting
  ageTags String[] // e.g., ["0-3", "3-7", "7-12"]
  
  // Schedule
  scheduleMode      ScheduleMode
  scheduleJson      Json? // Payload depends on scheduleMode
  nextOccurrenceAt  DateTime? // Denormalized for "Today/Tomorrow/Weekend/Week" queries
  
  // Pricing (optional)
  priceFrom    Float?
  priceTo      Float?
  priceText    String? // e.g., "от 50 BYN", "бесплатно"
  currency     String? @default("BYN")
  
  // Images
  coverImageId String?
  
  // Business ownership
  ownerUserId String
  
  // Relations
  place         Place?
  owner         User
  images        ActivityImage[]
  
  // Legacy fields (kept for backward compatibility)
  cityId, metroStationId, businessId, createdBy, etc.
}

model ActivityImage {
  id         String @id @default(cuid())
  activityId String
  url        String
  width      Int?
  height     Int?
  blurhash   String?
  sortOrder  Int    @default(0)
}
```

## Auto-Classification Rules

### Section Assignment

The system automatically determines which section(s) an activity belongs to:

**"Занятия" (Classes)**
- `type = COURSE` OR
- `scheduleMode = RECURRING`

**"Куда пойти" + "Всегда рядом" (Where to go + Always nearby)**
- `type = PERMANENT` AND
- `scheduleMode = ON_DEMAND` OR `scheduleMode = ALWAYS`

**"Куда пойти" (Where to go)**
- Everything else (EVENT, ROUTE, OFFER)

### Classification Helper

```typescript
// src/lib/activity/classification.ts

getActivitySections(type, scheduleMode): ActivitySection[]
// Returns: ["where-to-go"] | ["classes"] | ["where-to-go", "always-nearby"]

getPrimarySection(type, scheduleMode): ActivitySection
// Returns the primary section for display

getSectionLabel(section): string
// Returns Russian label: "Куда пойти" | "Занятия" | "Всегда рядом"

getActivitySectionLabels(type, scheduleMode): string[]
// Returns all section labels for an activity

isPlaceRequired(type): boolean
// Returns false for ROUTE, true for all others
```

## API Endpoints

### Business Owner Endpoints

**POST /api/business/activities-v2**
- Create new Activity in DRAFT status
- Required: `type`, `placeId` (except for ROUTE)
- Returns: activity with place and images

**GET /api/business/activities-v2**
- List my activities
- Query params: `status`, `type`
- Returns: activities with place and cover image

**GET /api/business/activities-v2/[id]**
- Get activity details
- Returns: activity with place and all images

**PATCH /api/business/activities-v2/[id]**
- Update activity (autosave-friendly)
- Lenient validation (only type checking)
- Cannot edit PUBLISHED activities
- Returns: updated activity

**DELETE /api/business/activities-v2/[id]**
- Delete activity
- Cannot delete PUBLISHED activities
- Returns: success

**POST /api/business/activities-v2/[id]/submit**
- Submit for moderation (strict validation)
- Required fields:
  - title, shortDesc
  - type, scheduleMode
  - placeId (except for ROUTE)
  - ageTags (at least one)
  - coverImageId
- Changes status: DRAFT/NEEDS_CHANGES/REJECTED → PENDING
- Creates moderation log
- Returns: updated activity

## Validation Rules

### Lenient (PATCH - autosave)
- Only type checking
- Allows partial updates
- No required field validation

### Strict (POST submit)
- title, shortDesc required
- type, scheduleMode required
- placeId required (except for ROUTE)
- At least one age tag required
- Cover image required
- Can only submit from DRAFT, NEEDS_CHANGES, or REJECTED

## UI Hints

When creating/editing an activity, show automatic section assignment:

```typescript
import { getActivitySectionLabels } from "@/lib/activity/classification";

const sections = getActivitySectionLabels(activity.type, activity.scheduleMode);
// ["Куда пойти"] or ["Занятия"] or ["Куда пойти", "Всегда рядом"]

// Display hint:
"Будет опубликовано в: {sections.join(", ")}"
```

## Examples

### EVENT (One-time event)
```typescript
{
  type: "EVENT",
  scheduleMode: "ONE_TIME",
  placeId: "place-id", // required
  scheduleJson: {
    date: "2026-03-15",
    time: "10:00"
  },
  nextOccurrenceAt: "2026-03-15T10:00:00Z"
}
// → "Куда пойти"
```

### COURSE (Recurring classes)
```typescript
{
  type: "COURSE",
  scheduleMode: "RECURRING",
  placeId: "place-id", // required
  scheduleJson: {
    weekdays: ["monday", "wednesday"],
    time: "15:00"
  }
}
// → "Занятия"
```

### PERMANENT (Always available)
```typescript
{
  type: "PERMANENT",
  scheduleMode: "ALWAYS",
  placeId: "place-id", // required
  scheduleJson: null
}
// → "Куда пойти" + "Всегда рядом"
```

### ROUTE (Walking route, no place)
```typescript
{
  type: "ROUTE",
  scheduleMode: "ON_DEMAND",
  placeId: null, // OK for ROUTE
  scheduleJson: {
    waypoints: [...]
  }
}
// → "Куда пойти"
```

### OFFER (Birthday package)
```typescript
{
  type: "OFFER",
  scheduleMode: "ON_DEMAND",
  placeId: "place-id", // required
  priceFrom: 100,
  priceTo: 300,
  priceText: "от 100 BYN"
}
// → "Куда пойти" (for future birthday constructor)
```

## Migration

**Migration:** `20260304212419_activity_type_schedule_classification`
- Added ActivityType and ScheduleMode enums
- Updated Activity model with new fields
- Created ActivityImage table
- Migrated existing data (name → title, default type=EVENT)
- Added indexes for efficient queries

## Moderation Integration

Activity moderation uses the unified moderation system:

```typescript
// src/server/services/moderation.service.ts

approveActivity(activityId, reviewedByUserId, message?)
needsChangesActivity(activityId, reviewedByUserId, message)
rejectActivity(activityId, reviewedByUserId, message)
```

All moderation actions are logged in ModerationLog with entityType="ACTIVITY".

## Testing

**Test script:** `scripts/test-activity-v2-api.ts`

Tests cover:
- ✅ Classification for all activity types
- ✅ Section assignment rules
- ✅ Place requirement validation
- ✅ Create EVENT, COURSE, PERMANENT, ROUTE, OFFER
- ✅ List activities by owner
- ✅ Auto-classification display

All tests passing.

## Key Features

1. **Automatic Classification**
   - No manual section selection
   - Based on type + scheduleMode
   - Clear, predictable rules

2. **Flexible Scheduling**
   - ONE_TIME: Single event
   - MULTI_DATE: Multiple specific dates
   - RECURRING: Repeating schedule
   - ON_DEMAND: Available on request
   - ALWAYS: Always available

3. **Place Flexibility**
   - Required for most types
   - Optional for ROUTE
   - Validated at API level

4. **Future-Ready**
   - OFFER type for birthday constructor
   - scheduleJson for flexible schedule data
   - nextOccurrenceAt for efficient queries

5. **Unified Moderation**
   - Same workflow as Place
   - Full audit trail
   - Business owner feedback

## Next Steps

1. Create Activity form UI with section hints
2. Implement schedule builder for each mode
3. Add image upload for cover and gallery
4. Create admin moderation UI for Activity
5. Build birthday constructor using OFFER type
6. Implement "Куда пойти" and "Занятия" feed queries

## Files Created/Modified

### Created
- `src/lib/activity/classification.ts`
- `src/app/api/business/activities-v2/route.ts`
- `src/app/api/business/activities-v2/[id]/route.ts`
- `src/app/api/business/activities-v2/[id]/submit/route.ts`
- `scripts/test-activity-v2-api.ts`
- `prisma/migrations/20260304212419_activity_type_schedule_classification/`

### Modified
- `prisma/schema.prisma` - Added ActivityType, ScheduleMode, updated Activity model
- `src/server/services/moderation.service.ts` - Added Activity moderation functions

## Summary

Successfully implemented Activity V2 with automatic section classification. The system intelligently determines where activities appear based on their type and schedule, eliminating manual section selection and ensuring consistent categorization. Ready for UI implementation and moderation workflow.
