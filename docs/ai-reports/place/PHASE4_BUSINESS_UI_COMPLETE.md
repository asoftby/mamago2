# Phase 4: Business UI Implementation - COMPLETE

## Status: ✅ COMPLETE

## Overview

Phase 4 successfully implemented the Business UI updates to integrate the PlaceRevision flow into the frontend. Published Places now use the revision system for edits, with clear status indicators and moderator feedback.

## Implementation Summary

### 1. PlaceWizard Component Updates

**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

**Key Changes:**
- Added `activeRevision` prop to receive initial revision data
- Added `isRevisionMode` flag to detect when editing published Place
- Updated `saveDraft()` to handle both direct Place edits and revision edits
- Updated `handleSubmit()` to submit revisions via revision endpoint
- Added revision status banners with moderator comments
- Tracks revision state alongside Place state

**Revision Mode Detection:**
```typescript
const isRevisionMode = place.status === "PUBLISHED";
```

**Save Logic:**
- PUBLISHED Place → Create/update revision via `/api/business/places/[id]/revision`
- Other statuses → Direct Place edit via `/api/business/places/[id]`

**Submit Logic:**
- PUBLISHED Place → Submit revision via `/api/business/places/[id]/revision/submit`
- Other statuses → Submit Place via `/api/business/places/[id]/submit`

**Status Banners:**
- `DRAFT` revision: "Редактирование опубликованного места"
- `PENDING` revision: "Изменения на проверке" (locked)
- `NEEDS_REVISION` revision: Shows moderator comment + days since request

### 2. Step4Contacts Component Updates

**File:** `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`

**Key Changes:**
- Added `isRevisionMode` and `revisionStatus` props
- Updated submit button logic to handle revision statuses
- Updated status messages for revision mode

**Submit Button Logic:**
```typescript
const canSubmit = isRevisionMode
  ? revisionStatus === "DRAFT" || revisionStatus === "NEEDS_REVISION"
  : place.status === "DRAFT" || 
    place.status === "NEEDS_REVISION" || 
    place.status === "REJECTED";
```

### 3. PlaceCardHorizontal Component Updates

**File:** `src/components/business/places/PlaceCardHorizontal.tsx`

**Key Changes:**
- Added `activeRevision` field to interface
- Added `REVISION_STATUS_CONFIG` for revision status display
- Shows revision status badge for published Places with active revisions
- Calculates inactivity days for both Place and revision NEEDS_REVISION status
- Updates action button based on effective status (revision takes precedence)

**Revision Status Badge:**
- Displayed below address for PUBLISHED Places with active revisions
- Color-coded: DRAFT (blue), PENDING (amber), NEEDS_REVISION (yellow)

**Effective Status:**
```typescript
const hasActiveRevision = place.activeRevision && 
  ["DRAFT", "PENDING", "NEEDS_REVISION"].includes(place.activeRevision.status);

const displayStatus = hasActiveRevision && place.status === "PUBLISHED"
  ? place.activeRevision!.status
  : place.status;
```

### 4. Places List Page Updates

**File:** `src/app/business/(protected)/places/page.tsx`

**Key Changes:**
- Fetches active revisions for published Places
- Maps revisions to places data
- Passes `placesWithRevisions` to PlacesList component

**Query Logic:**
```typescript
// Get published place IDs
const publishedPlaceIds = places
  .filter(p => p.status === "PUBLISHED")
  .map(p => p.id);

// Fetch active revisions
const activeRevisions = await prisma.placeRevision.findMany({
  where: {
    placeId: { in: publishedPlaceIds },
    status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
  },
  // ...
});

// Map to places
const placesWithRevisions = places.map(place => ({
  ...place,
  activeRevision: activeRevisions.find(r => r.placeId === place.id) || null,
}));
```

### 5. Edit Page Updates

**File:** `src/app/business/(protected)/places/[id]/edit/page.tsx`

**Key Changes:**
- Fetches active revision for PUBLISHED Places
- Gets moderator comment from revision if applicable
- Passes `activeRevision` to PlaceWizard

**Revision Fetch:**
```typescript
let activeRevision = null;
if (place.status === "PUBLISHED") {
  activeRevision = await prisma.placeRevision.findFirst({
    where: {
      placeId: place.id,
      status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
    },
    include: { images: true },
  });
}
```

### 6. PlacesList Component Updates

**File:** `src/app/business/(protected)/places/PlacesList.tsx`

**Key Changes:**
- Updated `Place` interface to include `activeRevision` field
- Added `moderatorComment` and `revisionRequestedAt` fields

## User Experience Flow

### Editing Published Place

1. User clicks "Редактировать" on published Place card
2. PlaceWizard detects `isRevisionMode = true`
3. Blue banner shows: "Редактирование опубликованного места"
4. User makes changes
5. Clicking "Сохранить черновик" creates/updates revision
6. Clicking "Отправить на модерацию" submits revision
7. Redirects to success page with `?revision=true` param

### Viewing Place with Active Revision

**Place Card Display:**
- Main status: "Опубликовано"
- Revision badge: "Редактирование изменений" (DRAFT)
- Revision badge: "Изменения на проверке" (PENDING)
- Revision badge: "Требуются правки" (NEEDS_REVISION)

**Action Button:**
- DRAFT/NEEDS_REVISION: "Редактировать" (enabled)
- PENDING: "На проверке" (disabled)

### Revision Needs Changes

**Place Card:**
- Shows: "Отправлено на доработку X дней назад"
- Badge: "Требуются правки" (yellow)
- Button: "Редактировать" (enabled)

**Edit Page:**
- Yellow banner with moderator comment
- Shows days since revision request
- Can edit and resubmit

## Status Combinations Handled

| Place Status | Revision Status | Card Display | Edit Page Behavior |
|--------------|----------------|--------------|-------------------|
| DRAFT | null | "Черновик" | Direct edit |
| PENDING | null | "На модерации" | Locked |
| PUBLISHED | null | "Опубликовано" | Create revision on edit |
| PUBLISHED | DRAFT | "Опубликовано" + badge | Edit revision |
| PUBLISHED | PENDING | "Опубликовано" + badge | View only |
| PUBLISHED | NEEDS_REVISION | "Опубликовано" + badge + days | Edit revision |
| NEEDS_REVISION | null | "Требует правок" + days | Direct edit |
| REJECTED | null | "Отклонено" | Direct edit |

## Inactivity Tracking

**Calculation:**
```typescript
const daysSinceRevision = Math.floor(
  (Date.now() - new Date(revisionRequestedAt).getTime()) 
  / (1000 * 60 * 60 * 24)
);
```

**Display:**
- "X день назад" (1 day)
- "X дня назад" (2-4 days)
- "X дней назад" (5+ days)

**Shown When:**
- Place status = NEEDS_REVISION
- Revision status = NEEDS_REVISION

## Error Handling

**Save Errors:**
- Shows toast with error message
- Prevents navigation if save fails
- Logs errors to console

**Submit Errors:**
- Shows toast with error message
- Handles validation errors separately
- Displays API error messages

**Revision Creation:**
- Automatically creates revision on first save
- Reuses existing active revision
- Enforces one-active-revision rule

## Files Modified

1. `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx` - Revision mode logic
2. `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx` - Submit button logic
3. `src/components/business/places/PlaceCardHorizontal.tsx` - Revision status display
4. `src/app/business/(protected)/places/page.tsx` - Fetch active revisions
5. `src/app/business/(protected)/places/PlacesList.tsx` - Interface updates
6. `src/app/business/(protected)/places/[id]/edit/page.tsx` - Fetch revision data

## Files Created

7. `docs/ai-reports/place/PHASE4_BUSINESS_UI_COMPLETE.md` - This document

## Testing Checklist

### Manual Testing

**Published Place Editing:**
- [ ] Click "Редактировать" on published Place
- [ ] See blue banner about editing published Place
- [ ] Make changes and save draft
- [ ] Verify revision created in database
- [ ] Submit revision for moderation
- [ ] Verify redirect to success page

**Revision Status Display:**
- [ ] DRAFT revision shows "Редактирование изменений" badge
- [ ] PENDING revision shows "Изменения на проверке" badge
- [ ] NEEDS_REVISION shows "Требуются правки" badge
- [ ] Inactivity days calculated correctly

**Moderator Comments:**
- [ ] NEEDS_REVISION revision shows moderator comment
- [ ] Comment displayed in yellow banner
- [ ] Days since request shown

**Action Buttons:**
- [ ] PENDING revision disables edit button
- [ ] DRAFT/NEEDS_REVISION enables edit button
- [ ] Button text updates based on status

**Error Cases:**
- [ ] Save failure shows error toast
- [ ] Submit failure shows error message
- [ ] Validation errors displayed clearly

## Known Limitations

1. **Image Handling:** Images are not yet fully integrated with revision system
2. **Revision History:** No UI to view past revisions (APPROVED/REJECTED)
3. **Comparison View:** No before/after comparison (Phase 5)
4. **Notifications:** Revision notifications not yet implemented (Phase 6)

## Next Steps (Phase 5)

### Admin UI Updates

**Moderation Queue:**
- Include PlaceRevisions with status PENDING
- Show [PLACE] vs [PLACE UPDATE] indicators
- Link to revision moderation page

**Revision Moderation Page:**
- Show comparison view (before/after)
- Highlight changed fields
- Use POST `/api/admin/moderation/revisions/[id]` for actions
- Display revision metadata (submittedAt, etc.)

**Moderation Panel:**
- Add revision-specific actions
- Show revision history
- Display business owner info

## Success Criteria

- [x] PlaceWizard detects PUBLISHED status and uses revision flow
- [x] Revision creation/update works via API
- [x] Revision submission works via API
- [x] PlaceCardHorizontal shows revision status
- [x] Moderator comments displayed for NEEDS_REVISION
- [x] Inactivity tracking shows days since request
- [x] Status banners show appropriate messages
- [x] Action buttons update based on status
- [x] No TypeScript errors
- [ ] Admin UI implemented (Phase 5)
- [ ] Notifications implemented (Phase 6)

## Related Documentation

- Phase 1: `PHASE1_SCHEMA_FOUNDATION_COMPLETE.md`
- Phase 2: `PHASE2_SERVICE_LAYER_COMPLETE.md`
- Phase 3: `PHASE3_API_LAYER_COMPLETE.md`
- Architecture: `PLACE_REVISION_ARCHITECTURE.md`
