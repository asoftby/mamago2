# Place Moderation System - Implementation Complete

## Status: ✅ IMPLEMENTED

## Overview

Implemented a complete moderation system for Places in the mamaGo admin panel. This allows admin/moderator users to review, approve, request changes, or reject places submitted by businesses.

## Features Implemented

### 1. Admin Navigation

Added "Moderation" section to admin sidebar with two pages:
- Queue - Shows all PENDING places
- Places - Shows all places with filters

**File:** `src/components/admin/AdminNav.tsx`

### 2. Moderation Queue Page

**Route:** `/admin/moderation/queue`
**File:** `src/app/admin/moderation/queue/page.tsx`

Shows all places with `status = PENDING`:
- Place name
- City
- Business name
- Submitted date
- Status badge
- Click to open moderation page

Sorted by creation date (oldest first - FIFO).

### 3. Places List Page

**Route:** `/admin/moderation/places`
**File:** `src/app/admin/moderation/places/page.tsx`

Shows all places in a table with:
- Name
- City
- Business
- Status
- Created date
- Review action link

**Filters:**
- Status (DRAFT, PENDING, PUBLISHED, NEEDS_CHANGES, REJECTED)
- City

**File:** `src/app/admin/moderation/places/PlacesFilters.tsx` (client component for filters)

### 4. Place Moderation Detail Page

**Route:** `/admin/moderation/places/[id]`
**Files:**
- `src/app/admin/moderation/places/[id]/page.tsx` (server component)
- `src/components/admin/PlaceModerationView.tsx` (client component)

**Layout:** Two-column design

**LEFT COLUMN (Content Preview):**
- Logo image
- Title and short description
- Full description
- Location (address, district, metro with distance)
- Coordinates
- Contacts (phone, website, Instagram)
- Gallery images
- Tags (age, visit formats, activity types)

**RIGHT COLUMN (Sticky Moderation Panel):**
- Place info:
  - Status badge
  - Type (Place)
  - City
  - Business name
  - Submitted date
- Moderator comment textarea
- Action buttons:
  - Approve (green)
  - Needs Revision (outline)
  - Reject (red/destructive)

The moderation panel is sticky (`position: sticky; top: 24px`) so it stays visible while scrolling through content.

### 5. Moderation API Endpoint

**Route:** `POST /api/admin/moderation/places/[id]`
**File:** `src/app/api/admin/moderation/places/[id]/route.ts`

**Authentication:** Requires ADMIN or MODERATOR role

**Request Body:**
```json
{
  "action": "APPROVE" | "NEEDS_CHANGES" | "REJECT",
  "comment": "Optional moderator comment"
}
```

**Actions:**
- `APPROVE` → Sets status to `PUBLISHED`
- `NEEDS_CHANGES` → Sets status to `NEEDS_CHANGES`
- `REJECT` → Sets status to `REJECTED`

**Database Operations (Transaction):**
1. Updates `Place.status`
2. Creates `ModerationLog` entry with:
   - entityType: "PLACE"
   - entityId: place.id
   - action: corresponding ModerationAction
   - message: moderator comment
   - reviewedByUserId: current user

### 6. Business UI Integration

**Existing Implementation:**
- `PlaceCardHorizontal` already has correct status configuration
- Edit page already shows moderation messages for NEEDS_CHANGES and REJECTED
- Uses `getLatestModerationMessage()` from `src/server/services/moderation.service.ts`

**Status Display:**
- DRAFT → "Продолжить" (active button)
- PENDING → "На модерации" (disabled button)
- PUBLISHED → "Редактировать" (active button)
- NEEDS_CHANGES → "Исправить" (active button) + moderator comment banner
- REJECTED → "Отклонено" (active button) + moderator comment banner

## Status Flow

```
DRAFT → (user submits) → PENDING
PENDING → (admin approves) → PUBLISHED
PENDING → (admin requests changes) → NEEDS_CHANGES
PENDING → (admin rejects) → REJECTED
NEEDS_CHANGES → (user edits & resubmits) → PENDING
```

## Database Schema

**Already Exists:**
- `ContentStatus` enum with all required statuses
- `ModerationLog` model for tracking moderation history
- `ModerationEntityType` enum (PLACE, ACTIVITY)
- `ModerationAction` enum (SUBMIT, APPROVE, NEEDS_CHANGES, REJECT)

No schema changes were needed.

## Files Created

### Admin Pages
1. `src/app/admin/moderation/queue/page.tsx` - Queue page
2. `src/app/admin/moderation/places/page.tsx` - Places list page
3. `src/app/admin/moderation/places/PlacesFilters.tsx` - Filters component
4. `src/app/admin/moderation/places/[id]/page.tsx` - Moderation detail page

### Components
5. `src/components/admin/PlaceModerationView.tsx` - Main moderation view

### API
6. `src/app/api/admin/moderation/places/[id]/route.ts` - Moderation API

### Modified
7. `src/components/admin/AdminNav.tsx` - Added Moderation section

## Testing Checklist

### Admin Flow
- [ ] Navigate to `/admin/moderation/queue`
- [ ] Verify PENDING places appear
- [ ] Click on a place to open moderation page
- [ ] Verify content preview displays correctly
- [ ] Verify moderation panel is sticky
- [ ] Test "Approve" action
- [ ] Test "Needs Revision" action (with comment)
- [ ] Test "Reject" action (with comment)
- [ ] Verify redirect to queue after action
- [ ] Navigate to `/admin/moderation/places`
- [ ] Test status filter
- [ ] Test city filter
- [ ] Verify table displays all places

### Business Flow
- [ ] Create a new place as business user
- [ ] Submit for moderation (status → PENDING)
- [ ] Verify "На модерации" button is disabled
- [ ] Admin approves → verify status changes to PUBLISHED
- [ ] Admin requests changes → verify moderator comment appears
- [ ] Edit and resubmit → verify status returns to PENDING
- [ ] Admin rejects → verify rejection message appears

### Authorization
- [ ] Verify non-admin users cannot access `/admin/moderation/*`
- [ ] Verify API returns 403 for non-admin users

## Important Notes

1. **Sticky Panel:** The moderation panel uses `position: sticky` to stay visible while scrolling through long content.

2. **Comment Required:** For NEEDS_CHANGES and REJECT actions, the moderator comment is required (validated on client).

3. **Transaction Safety:** Place status update and moderation log creation happen in a single transaction.

4. **Existing Integration:** The business UI already had moderation message display implemented, so no changes were needed there.

5. **Scope:** This implementation is ONLY for Place moderation. Activity, Offer, and other entity moderation are NOT included.

## Future Enhancements

Potential improvements (not implemented):
- Bulk moderation actions
- Moderation statistics dashboard
- Email notifications to business owners
- Moderation history view
- Duplicate detection integration
- Image moderation tools
- Automated content checks

## Related Documentation

- Moderation service: `src/server/services/moderation.service.ts`
- Test script: `scripts/test-moderation-system.ts`
- Place API: `docs/PLACE_API_USAGE.md`
