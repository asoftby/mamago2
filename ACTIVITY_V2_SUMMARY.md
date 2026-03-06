# Activity V2 - Implementation Summary

## What Was Built

Complete Activity model with automatic section classification system. Business owners create activities without manually selecting sections - the system automatically determines where they appear based on type and schedule.

## Key Achievements

### ✅ Database Schema
- ActivityType enum (EVENT, PERMANENT, COURSE, ROUTE, OFFER)
- ScheduleMode enum (ONE_TIME, MULTI_DATE, RECURRING, ON_DEMAND, ALWAYS)
- Updated Activity model with new fields
- ActivityImage model for gallery
- Migration with backward compatibility

### ✅ Auto-Classification System
- Classification helper functions
- Section assignment rules
- Russian labels for UI
- Place requirement validation

### ✅ API Endpoints
- POST /api/business/activities-v2 - Create draft
- GET /api/business/activities-v2 - List activities
- GET /api/business/activities-v2/[id] - Get details
- PATCH /api/business/activities-v2/[id] - Update (autosave)
- POST /api/business/activities-v2/[id]/submit - Submit for moderation
- DELETE /api/business/activities-v2/[id] - Delete

### ✅ Moderation Integration
- Activity moderation functions in moderation.service.ts
- approveActivity, needsChangesActivity, rejectActivity
- Full audit trail with ModerationLog

### ✅ Testing
- Comprehensive test script
- All classification rules tested
- All activity types tested
- All tests passing

## Classification Rules

### "Занятия" (Classes)
- COURSE type OR
- RECURRING schedule mode

### "Куда пойти" + "Всегда рядом" (Where to go + Always nearby)
- PERMANENT type AND
- (ON_DEMAND OR ALWAYS schedule mode)

### "Куда пойти" (Where to go)
- Everything else (EVENT, ROUTE, OFFER)

## Activity Types

| Type | Description | Place Required | Typical Schedule | Section |
|------|-------------|----------------|------------------|---------|
| EVENT | Разовое мероприятие | ✅ Yes | ONE_TIME, MULTI_DATE | Куда пойти |
| PERMANENT | Постоянное место | ✅ Yes | ALWAYS, ON_DEMAND | Куда пойти + Всегда рядом |
| COURSE | Курс/занятие | ✅ Yes | RECURRING, ON_DEMAND | Занятия |
| ROUTE | Маршрут | ❌ No | ON_DEMAND | Куда пойти |
| OFFER | Предложение для ДР | ✅ Yes | ON_DEMAND | Куда пойти |

## Schedule Modes

| Mode | Description | Use Cases |
|------|-------------|-----------|
| ONE_TIME | Одна дата/время | Single event |
| MULTI_DATE | Несколько дат | Event series |
| RECURRING | Повторяющееся | Weekly classes |
| ON_DEMAND | По запросу | Book on demand |
| ALWAYS | Всегда доступно | Permanent attractions |

## API Features

### Autosave (PATCH)
- Lenient validation
- Partial updates
- Debounce-friendly
- Cannot edit PUBLISHED

### Submit (POST)
- Strict validation
- Required fields check
- Status transition validation
- Moderation log creation

### Validation Rules

**Required for Submit:**
- title, shortDesc
- type, scheduleMode
- placeId (except ROUTE)
- ageTags (at least one)
- coverImageId

**Optional:**
- description
- scheduleJson
- nextOccurrenceAt
- pricing fields

## Helper Functions

```typescript
// Get sections where activity will appear
getActivitySections(type, scheduleMode)
// → ["where-to-go"] | ["classes"] | ["where-to-go", "always-nearby"]

// Get Russian labels
getActivitySectionLabels(type, scheduleMode)
// → ["Куда пойти"] | ["Занятия"] | ["Куда пойти", "Всегда рядом"]

// Check if place is required
isPlaceRequired(type)
// → false for ROUTE, true for others
```

## UI Integration

### Section Hint Component
```tsx
<ActivitySectionHint type={activity.type} scheduleMode={activity.scheduleMode} />
// Shows: "Будет опубликовано в: Куда пойти, Всегда рядом"
```

### Place Validation
```tsx
if (isPlaceRequired(activityType) && !placeId) {
  showError("Place is required for this activity type");
}
```

## Migration Details

**Migration:** `20260304212419_activity_type_schedule_classification`

- Added ActivityType and ScheduleMode enums
- Updated Activity model:
  - Renamed `name` → `title`
  - Added `shortDesc`, `type`, `scheduleMode`, `status`
  - Added `placeId`, `ownerUserId`, `ageTags`
  - Added `scheduleJson`, `nextOccurrenceAt`
  - Added pricing fields
- Created ActivityImage table
- Migrated existing data with defaults
- Added indexes for efficient queries

## Status Flow

```
DRAFT (create)
  ↓ submit
PENDING (moderation)
  ↓ approve          ↓ needs_changes        ↓ reject
PUBLISHED        NEEDS_CHANGES           REJECTED
                      ↓ fix + submit          ↓ fix + submit
                    PENDING                 PENDING
```

## Files Structure

```
prisma/
  schema.prisma                                    # Updated Activity model
  migrations/
    20260304212419_activity_type_schedule_classification/

src/
  lib/activity/
    classification.ts                              # Auto-classification helpers
  
  server/services/
    moderation.service.ts                          # Activity moderation functions
  
  app/api/business/activities-v2/
    route.ts                                       # Create, list
    [id]/route.ts                                  # Get, update, delete
    [id]/submit/route.ts                           # Submit for moderation

docs/
  ACTIVITY_V2_USAGE.md                             # Usage guide

scripts/
  test-activity-v2-api.ts                          # Test script
```

## Testing Results

All tests passing:
- ✅ Classification for EVENT → "Куда пойти"
- ✅ Classification for COURSE → "Занятия"
- ✅ Classification for PERMANENT ALWAYS → "Куда пойти" + "Всегда рядом"
- ✅ Classification for ROUTE → "Куда пойти" (no place required)
- ✅ Classification for OFFER → "Куда пойти"
- ✅ Create all activity types
- ✅ List activities by owner
- ✅ Section labels display correctly

## Next Steps

### Immediate
1. Create Activity form UI with section hints
2. Implement schedule builder for each mode
3. Add image upload (cover + gallery)
4. Add moderation banner for NEEDS_CHANGES

### Near Future
1. Create admin moderation UI for Activity
2. Build "Куда пойти" feed with filters
3. Build "Занятия" feed with filters
4. Build "Всегда рядом" section
5. Implement birthday constructor using OFFER type

### Future Enhancements
1. Advanced schedule builder
2. Recurring event exceptions
3. Capacity management
4. Booking integration
5. Analytics and insights

## Benefits

### For Business Owners
- ✅ No manual section selection
- ✅ Clear, predictable classification
- ✅ Automatic multi-section publishing
- ✅ Flexible scheduling options
- ✅ Autosave for smooth UX

### For Users
- ✅ Consistent categorization
- ✅ Activities appear in correct sections
- ✅ Easy to find what they're looking for
- ✅ "Всегда рядом" for permanent attractions

### For Developers
- ✅ Clean, maintainable code
- ✅ Reusable classification logic
- ✅ Extensible for future types
- ✅ Well-tested and documented

## Summary

Successfully implemented Activity V2 with automatic section classification. The system intelligently determines where activities appear based on type and schedule mode, eliminating manual section selection and ensuring consistent categorization. The API is production-ready with full CRUD operations, autosave, strict validation, and moderation integration. Ready for UI implementation.

**Key Innovation:** Business owners don't choose sections - the system automatically classifies activities based on their characteristics, ensuring consistency and reducing cognitive load.
