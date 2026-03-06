# Place Locked State Implementation - Complete

## Overview
Implemented full read-only/locked state for places with status PENDING (on moderation). When a place is under review, all editing is blocked and users see clear status indicators.

Also fixed submit flow to properly handle PUBLISHED places by submitting revisions instead of the place directly.

## Implementation

### Core Logic (PlaceWizard.tsx)
```typescript
// Single source of truth for locked state
// For published places, check revision status
// For non-published places, check place status
const isLocked = place.status === "PUBLISHED" 
  ? activeRevision?.status === "PENDING"
  : place.status === "PENDING";
const isEditable = !isLocked;
```

This ensures:
- **Non-published places (DRAFT, NEEDS_REVISION, REJECTED)**: Locked when place.status === PENDING
- **Published places**: Locked when activeRevision.status === PENDING (place stays PUBLISHED)

### Features Implemented

1. **Locked State Detection**
   - Places with status PENDING are automatically locked
   - Single `isLocked` flag controls all editing behavior
   - `isEditable` prop passed to all steps

2. **UI Indicators**
   - Blue banner: "Изменения находятся на проверке модератора. Редактирование станет доступно после проверки."
   - Button shows "⏳ На проверке" when locked
   - Button is disabled when locked

3. **Blocked Operations**
   - `saveDraft()` returns early if locked
   - `handleUpdate()` returns early if locked
   - `handleSubmit()` shows error toast if locked
   - All form inputs disabled via `isEditable` prop

### Step-by-Step Disabling

#### Step 1: Profile (Step1Profile.tsx)
- All Input fields: `disabled={!isEditable}`
- Textarea: `disabled={!isEditable}`
- Select dropdown: `disabled={!isEditable}`
- Tag buttons: `disabled={!isEditable}` + `onClick` guards

#### Step 2: Location (Step2Location.tsx)
- PlaceLocationPicker: `disabled={!isEditable}`
- Search input disabled
- Map selection button disabled
- District/metro selects disabled
- All reset buttons disabled
- Address detail inputs disabled

#### Step 3: Photos (Step3Photos.tsx)
- PlaceLogoUploadTemp: `disabled={!isEditable}`
- PlaceGalleryUploadTemp: `disabled={!isEditable}`
- Upload zones disabled
- Drag & drop disabled
- Remove buttons disabled

#### Step 4: Contacts (Step4Contacts.tsx)
- Phone input: `disabled={!isEditable}`
- Website input: `disabled={!isEditable}`
- Instagram input: `disabled={!isEditable}`
- Submit button: disabled when `isPending`
- Button text: "⏳ На проверке" when pending

## Files Modified

### Core Wizard
- `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
  - Added `useWizardSession` hook for temp media
  - Added `isLocked` and `isEditable` flags
  - Blocked save/update/submit when locked
  - Added locked state banner
  - Fixed status checks (PENDING not UNDER_REVIEW)
  - Improved error handling in handleSubmit

### Steps
- `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx`
  - Added `isEditable` prop to interface
  - Disabled all inputs, textarea, select, buttons

- `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`
  - Added `isEditable` prop to interface
  - Passed `disabled` to PlaceLocationPicker

- `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
  - Added `isEditable` prop to interface
  - Passed `disabled` to upload components
  - Added `wizardSessionId` prop

- `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
  - Fixed status check (PENDING not UNDER_REVIEW)
  - Button text: "⏳ На проверке"

### Components
- `src/components/business/place/PlaceLocationPicker.tsx`
  - Added `disabled` prop to interface
  - Disabled search input, map button, selects, reset buttons, detail inputs

- `src/components/business/place/PlaceLogoUploadTemp.tsx`
  - Added `disabled` prop to interface
  - Disabled click, drag & drop, remove actions

- `src/components/business/place/PlaceGalleryUploadTemp.tsx`
  - Added `disabled` prop to interface
  - Disabled click, drag & drop, remove actions

## Status Enum Values
Correct ContentStatus values from schema:
- DRAFT
- PENDING (used for locked state)
- PUBLISHED
- NEEDS_REVISION
- REJECTED

## Submit Flow Logic

### For Non-Published Places (DRAFT, NEEDS_REVISION, REJECTED)
```typescript
POST /api/business/places/[id]/submit
// Submits the place directly for moderation
```

### For Published Places
```typescript
// 1. Get or create revision
GET /api/business/places/[id]/revision

// 2. Submit the revision (not the place)
POST /api/business/places/[id]/revision/submit
Body: { revisionId: string }
```

This ensures published places maintain their live version while changes are reviewed through the revision system.

## User Experience

### When Place is NOT on Moderation
- All fields editable
- Normal save/autosave behavior
- Status badge: depends on place status (Черновик, Опубликовано, etc.)
- Submit button: "Отправить на модерацию"

### When Place IS on Moderation
**For non-published places (place.status === PENDING):**
- Status badge: "На модерации"
- Blue banner: "Изменения находятся на проверке модератора..."
- All form fields disabled
- Submit button: "На модерации" (disabled)

**For published places (activeRevision.status === PENDING):**
- Status badge: "На модерации" (instead of "Опубликовано")
- Blue banner: "Изменения находятся на проверке модератора..."
- All form fields disabled
- Submit button: "На модерации" (disabled)
- Live published place remains unchanged
- Editing blocked until revision is approved/rejected

### When Revision Needs Changes (activeRevision.status === NEEDS_REVISION)
- Status badge: "Правки к изменениям"
- Yellow banner: "Требуется исправление изменений" + moderator comment
- All fields editable
- Submit button: "Отправить на модерацию"
- Can make changes and resubmit

## Testing Checklist
- [x] Place with PENDING status shows locked banner
- [x] All inputs in Step 1 are disabled
- [x] Location picker in Step 2 is disabled
- [x] Photo uploads in Step 3 are disabled
- [x] Contact inputs in Step 4 are disabled
- [x] Submit button shows "⏳ На проверке"
- [x] Submit button is disabled
- [x] saveDraft blocked when locked
- [x] handleUpdate blocked when locked
- [x] handleSubmit shows error when locked
- [x] No TypeScript errors
- [x] Step navigation works without saving

## Architecture Notes

### Single Source of Truth
```typescript
const isLocked = place.status === "PENDING";
const isEditable = !isLocked;
```

This single flag is:
1. Calculated once in PlaceWizard
2. Passed down to all steps via props
3. Used consistently across all components
4. No scattered if-checks throughout codebase

### Prop Drilling Pattern
```
PlaceWizard (isEditable)
  ├─ Step1Profile (isEditable)
  ├─ Step2Location (isEditable)
  │   └─ PlaceLocationPicker (disabled)
  ├─ Step3Photos (isEditable)
  │   ├─ PlaceLogoUploadTemp (disabled)
  │   └─ PlaceGalleryUploadTemp (disabled)
  └─ Step4Contacts (isEditable)
```

### Guard Pattern
All mutation functions check locked state:
```typescript
if (isLocked) {
  console.log("Operation blocked - place is on moderation");
  return;
}
```

## Future Improvements
1. Add locked state indicator in wizard header
2. Show estimated review time
3. Add "Cancel Review" option for business owners
4. Show review progress/status updates
5. Add notification when review completes

## Related Documents
- PLACE_WIZARD_REVISION_FIX.md - Revision flow fixes
- PLACE_MODERATION_BUTTON_UX.md - Button state improvements
- PLACE_MODERATION_IMPLEMENTATION.md - Moderation system
