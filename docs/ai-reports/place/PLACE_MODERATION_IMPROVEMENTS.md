# Place Moderation Improvements & Inactivity Tracking

## Status: ✅ IMPLEMENTED

## Overview

Enhanced the Place moderation system with detailed metadata tracking and inactivity monitoring to prepare for notification-based reminders when businesses don't fix moderation issues.

## Database Changes

### New Place Model Fields

Added moderation metadata fields to the `Place` model:

```prisma
// Moderation metadata
moderatorComment      String?   // Explanation of required fixes
moderationReviewedAt  DateTime? // When moderation was completed
moderatedByUserId     String?   // Admin/moderator who reviewed
revisionRequestedAt   DateTime? // When NEEDS_REVISION was assigned
revisionResubmittedAt DateTime? // When business resubmitted after fixes
```

### New Indexes

- `@@index([moderatedByUserId])` - For querying places by moderator
- `@@index([status, revisionRequestedAt])` - For filtering expired revisions

### New Relation

- `moderatedBy User?` - Relation to the admin/moderator who reviewed the place

### Migration

Created migration: `20260306094955_add_place_moderation_fields`

## Admin Moderation Actions

When moderator performs actions, the following fields are set:

### APPROVE
```typescript
{
  status: "PUBLISHED",
  moderationReviewedAt: now(),
  moderatedByUserId: adminId,
  moderatorComment: comment || null
}
```

### NEEDS_CHANGES
```typescript
{
  status: "NEEDS_CHANGES",
  moderatorComment: comment, // Required
  revisionRequestedAt: now(),
  moderationReviewedAt: now(),
  moderatedByUserId: adminId
}
```

### REJECT
```typescript
{
  status: "REJECTED",
  moderatorComment: comment, // Required
  moderationReviewedAt: now(),
  moderatedByUserId: adminId
}
```

## Business Resubmission

When business edits a Place with status `NEEDS_CHANGES` and clicks "Submit for moderation":

```typescript
{
  status: "PENDING",
  revisionResubmittedAt: now()
}
```

The `moderatorComment` remains visible for history until next review.

## Business Dashboard UI

### PlaceCardHorizontal Component

Updated to show inactivity tracking for `NEEDS_CHANGES` status:

**Status Display:**
- PENDING: "На модерации" (disabled button)
- PUBLISHED: "Опубликовано" + "Редактировать" button
- NEEDS_CHANGES: "Требуются правки" + "Исправить" button + inactivity message
- REJECTED: "Отклонено" + moderator comment (in edit page only)

**Inactivity Message:**
```
Отправлено на доработку X дней назад
```

Example:
```
Требуются правки
Отправлено на доработку 5 дней назад
[Исправить]
```

**Days Calculation:**
```typescript
const daysSinceRevision = Math.floor(
  (now - revisionRequestedAt) / (1000 * 60 * 60 * 24)
);
```

**Russian Pluralization:**
- 1 день
- 2-4 дня
- 5+ дней

### Card Behavior

- Cards stay compact
- No long moderator comments in list view
- Detailed comments shown only in edit page
- Status explains situation
- Buttons represent actions

## Edit Page Improvements

When opening `/business/places/[id]/edit` with status `NEEDS_CHANGES`:

**Warning Block (above form):**
```
⚠️ Требуются правки от модератора

• [Moderator comment line 1]
• [Moderator comment line 2]
```

Then shows normal editing form.

## Inactivity Tracking

### Data Layer Preparation

The system now tracks:
- `revisionRequestedAt` - When NEEDS_CHANGES was assigned
- `revisionResubmittedAt` - When business resubmitted fixes

### Filtering Logic (Prepared)

**Expired revisions condition:**
```typescript
{
  status: "NEEDS_CHANGES",
  revisionRequestedAt: {
    lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  }
}
```

This allows admins to:
- See inactive places requiring follow-up
- Send reminder notifications (future feature)
- Track moderation efficiency

## API Updates

### Admin Moderation API

**File:** `src/app/api/admin/moderation/places/[id]/route.ts`

Updated to set all new moderation fields based on action.

### Business Submit API

**File:** `src/app/api/business/places/[id]/submit/route.ts`

Fixed Next.js 15+ async params issue and updated to set `revisionResubmittedAt` when resubmitting after `NEEDS_CHANGES`.

### Moderation Service

**File:** `src/server/services/moderation.service.ts`

Updated `submitPlace()` function to:
- Detect if resubmitting after NEEDS_CHANGES
- Set `revisionResubmittedAt` timestamp
- Log appropriate message ("Resubmitted after revision" vs "Submitted for moderation")

## Files Modified

### Database
1. `prisma/schema.prisma` - Added moderation fields to Place model
2. `prisma/migrations/20260306094955_add_place_moderation_fields/` - Migration

### API
3. `src/app/api/admin/moderation/places/[id]/route.ts` - Set moderation fields
4. `src/app/api/business/places/[id]/submit/route.ts` - Set revisionResubmittedAt, fix async params
5. `src/server/services/moderation.service.ts` - Update submitPlace logic

### Components
6. `src/components/business/places/PlaceCardHorizontal.tsx` - Add inactivity tracking display

## Status Flow

```
DRAFT → submit → PENDING
PENDING → APPROVE → PUBLISHED
PENDING → NEEDS_CHANGES → (business fixes) → submit → PENDING
PENDING → REJECT → REJECTED
```

## Future Features (Not Implemented)

The data layer is now prepared for:

1. **Notification System**
   - Email reminders for inactive revisions
   - Push notifications for status changes

2. **Admin Dashboard**
   - Filter places by expired revisions (>30 days)
   - Moderation efficiency metrics
   - Moderator performance tracking

3. **Automated Actions**
   - Auto-reject after X days of inactivity
   - Escalation workflows

4. **Analytics**
   - Average time to fix issues
   - Revision success rate
   - Common rejection reasons

## Testing

### Manual Testing Checklist

- [ ] Admin approves place → moderationReviewedAt set
- [ ] Admin requests changes → revisionRequestedAt set
- [ ] Business resubmits → revisionResubmittedAt set
- [ ] Card shows "X дней назад" for NEEDS_CHANGES
- [ ] Pluralization works correctly (1 день, 2 дня, 5 дней)
- [ ] moderatorComment persists through resubmission
- [ ] Edit page shows warning block for NEEDS_CHANGES

### Database Query Examples

**Find expired revisions:**
```sql
SELECT * FROM "Place"
WHERE status = 'NEEDS_CHANGES'
  AND "revisionRequestedAt" < NOW() - INTERVAL '30 days'
ORDER BY "revisionRequestedAt" ASC;
```

**Find places pending resubmission:**
```sql
SELECT 
  id,
  title,
  "revisionRequestedAt",
  "moderatorComment",
  EXTRACT(DAY FROM NOW() - "revisionRequestedAt") as days_waiting
FROM "Place"
WHERE status = 'NEEDS_CHANGES'
ORDER BY "revisionRequestedAt" ASC;
```

**Moderator performance:**
```sql
SELECT 
  u.email,
  COUNT(*) as reviews_count,
  COUNT(CASE WHEN p.status = 'PUBLISHED' THEN 1 END) as approved,
  COUNT(CASE WHEN p.status = 'NEEDS_CHANGES' THEN 1 END) as needs_changes,
  COUNT(CASE WHEN p.status = 'REJECTED' THEN 1 END) as rejected
FROM "Place" p
JOIN "User" u ON p."moderatedByUserId" = u.id
WHERE p."moderatedByUserId" IS NOT NULL
GROUP BY u.id, u.email
ORDER BY reviews_count DESC;
```

## Important Notes

1. **moderatorComment Persistence:** The comment is NOT cleared on resubmission, allowing history tracking.

2. **Timestamp Accuracy:** All timestamps use `new Date()` for consistency.

3. **Index Performance:** The composite index `[status, revisionRequestedAt]` optimizes queries for expired revisions.

4. **Backward Compatibility:** Existing places without moderation fields will have NULL values, which is handled gracefully.

5. **Next.js 15+ Compatibility:** All API routes now properly await `params` Promise.

## Related Documentation

- Initial implementation: `docs/ai-reports/place/PLACE_MODERATION_IMPLEMENTATION.md`
- Place API: `docs/PLACE_API_USAGE.md`
- Moderation service: `src/server/services/moderation.service.ts`
