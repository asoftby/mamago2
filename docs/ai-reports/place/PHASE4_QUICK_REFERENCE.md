# Phase 4: Business UI - Quick Reference

## What Was Implemented

Phase 4 integrated the PlaceRevision system into the business frontend, allowing published Places to be edited through revisions while keeping the live version visible.

## Key Features

### 1. Revision Mode Detection
- PlaceWizard automatically detects when editing a PUBLISHED Place
- Switches to revision mode (creates/edits PlaceRevision instead of Place)
- Shows clear status banners to indicate revision mode

### 2. Status Indicators
- Place cards show revision status badges for published Places
- Color-coded badges: DRAFT (blue), PENDING (amber), NEEDS_REVISION (yellow)
- Inactivity tracking shows days since revision request

### 3. Moderator Feedback
- NEEDS_REVISION revisions display moderator comments
- Comments shown in yellow banner on edit page
- Days since request calculated and displayed

### 4. Smart Action Buttons
- PENDING revisions disable edit button ("На проверке")
- DRAFT/NEEDS_REVISION enable edit button
- Button text updates based on effective status

## API Endpoints Used

```typescript
// Get or create revision
GET /api/business/places/[id]/revision

// Save revision draft
PATCH /api/business/places/[id]/revision
Body: { revisionId, data }

// Submit revision
POST /api/business/places/[id]/revision/submit
Body: { revisionId }
```

## Component Updates

### PlaceWizard
- Added `isRevisionMode` flag
- Updated `saveDraft()` to handle revisions
- Updated `handleSubmit()` to submit revisions
- Added revision status banners

### PlaceCardHorizontal
- Shows revision status badge
- Calculates inactivity days
- Updates action button based on status

### Step4Contacts
- Added revision mode props
- Updated submit button logic
- Updated status messages

## Status Flow

```
PUBLISHED Place
    ↓
Edit → Create DRAFT revision
    ↓
Save → Update DRAFT revision
    ↓
Submit → PENDING revision
    ↓
Admin reviews:
    ├─ APPROVE → Copy to Place
    ├─ NEEDS_REVISION → Show comment + days
    └─ REJECT → Mark REJECTED
```

## Files Modified

1. `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
2. `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
3. `src/components/business/places/PlaceCardHorizontal.tsx`
4. `src/app/business/(protected)/places/page.tsx`
5. `src/app/business/(protected)/places/PlacesList.tsx`
6. `src/app/business/(protected)/places/[id]/edit/page.tsx`

## Testing

Run manual tests: `npx tsx scripts/manual-tests/test-phase4-ui.ts`

## Next Phase

Phase 5: Admin UI for revision moderation
- Add revisions to moderation queue
- Create revision comparison view
- Update moderation panel
