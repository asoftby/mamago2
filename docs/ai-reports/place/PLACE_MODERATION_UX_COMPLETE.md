# Place Moderation UX Improvements - Complete

## Overview
Enhanced the business cabinet UX to provide clear visual feedback about place moderation status, including status badges, disabled states, and contextual messaging.

## Changes Made

### 1. Status Badge Integration in Wizard Header
**File**: `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`

- Added `hasActiveRevision` and `revisionStatus` props to component interface
- Integrated `PlaceStatusBadge` component in header next to place title
- Badge shows current status with tooltip explanations

### 2. Props Passed from PlaceWizard
**File**: `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

- Updated `WizardHeaderNew` render to pass:
  - `hasActiveRevision={!!revision}` - indicates if published place has active revision
  - `revisionStatus={revision?.status}` - current status of the revision

### 3. Submit Button Logic in Step 4
**File**: `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`

**Added logic to determine PENDING state**:
```typescript
const isPending = isRevisionMode
  ? revisionStatus === "PENDING"
  : place.status === ContentStatus.PENDING;
```

**Dynamic button text**:
- Normal: "Отправить на модерацию"
- When PENDING: "Публикация на проверке"

**Button disabled when**:
- Status is PENDING (place or revision)
- Status is PUBLISHED (without active revision)

**Updated status message**:
- Shows contextual message when place/revision is PENDING
- Explains that moderation is in progress

### 4. Status Badge Styling Fix
**File**: `src/components/business/place/PlaceStatusBadge.tsx`

**Changed PENDING status styling**:
- Before: Amber/orange background (`bg-amber-100 text-amber-800`)
- After: Gray/secondary variant (using Badge `secondary` variant)
- Applied to both place PENDING and revision PENDING statuses

## Status Badge Behavior

### For Draft/Needs Revision/Rejected Places
Shows place status directly:
- 📄 **Черновик** (gray) - Draft
- ⏳ **На модерации** (gray) - Pending
- ✅ **Опубликовано** (green) - Published
- ⚠ **Требуются правки** (orange) - Needs Revision
- ⚠ **Отклонено** (red) - Rejected

### For Published Places with Active Revision
Shows revision status instead:
- ⏳ **Изменения на проверке** (gray) - Revision pending
- ⚠ **Правки к изменениям** (orange) - Revision needs revision

## Submit Button States

| Place Status | Revision Status | Button State | Button Text |
|--------------|----------------|--------------|-------------|
| DRAFT | - | Enabled | "Отправить на модерацию" |
| PENDING | - | Disabled | "Публикация на проверке" |
| NEEDS_REVISION | - | Enabled | "Отправить на модерацию" |
| REJECTED | - | Enabled | "Отправить на модерацию" |
| PUBLISHED | DRAFT | Enabled | "Отправить на модерацию" |
| PUBLISHED | PENDING | Disabled | "Публикация на проверке" |
| PUBLISHED | NEEDS_REVISION | Enabled | "Отправить на модерацию" |

## User Experience Flow

### Scenario 1: New Place Submission
1. User creates place (DRAFT status)
2. Badge shows "Черновик" (gray)
3. User fills wizard steps
4. Step 4: Button enabled "Отправить на модерацию"
5. After submit: Status changes to PENDING
6. Badge shows "На модерации" (gray)
7. Button disabled with text "Публикация на проверке"
8. Blue info banner: "Место находится на модерации"

### Scenario 2: Published Place Edit
1. User edits published place
2. Badge shows "Опубликовано" (green)
3. Changes create draft revision
4. Badge shows "Опубликовано" (green) - no change yet
5. User submits revision
6. Badge changes to "Изменения на проверке" (gray)
7. Button disabled with text "Публикация на проверке"
8. Blue info banner: "Изменения находятся на модерации"

### Scenario 3: Needs Revision
1. Moderator requests changes
2. Badge shows "Требуются правки" (orange)
3. Yellow banner with moderator comment
4. Button enabled "Отправить на модерацию"
5. User can edit and resubmit

## Technical Details

### Status Badge Component
- Uses Radix UI Tooltip for hover explanations
- Supports both place status and revision status
- Automatically switches display based on context
- Icons: Clock (pending), CheckCircle (published), AlertTriangle (needs work), FileText (draft)

### Button Disable Logic
- Checks both place status and revision status
- Prevents submission when moderation is in progress
- Changes text to indicate current state
- Maintains consistency across revision and non-revision modes

## Testing Scenarios

1. ✅ Create new place → submit → verify PENDING badge and disabled button
2. ✅ Edit published place → submit changes → verify revision PENDING badge
3. ✅ Receive NEEDS_REVISION → verify orange badge and enabled button
4. ✅ Verify badge tooltips show correct explanations
5. ✅ Verify button text changes based on status
6. ✅ Verify info banners show contextual messages

## Files Modified
- `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
- `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
- `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`
- `src/components/business/place/PlaceStatusBadge.tsx`

## Related Documentation
- `docs/ai-reports/place/PLACE_MODERATION_IMPROVEMENTS.md` - Initial moderation system
- `docs/ai-reports/place/PLACE_REVISION_ARCHITECTURE.md` - Revision system architecture
- `docs/ai-reports/place/NOTIFICATION_SYSTEM_SUMMARY.md` - Notification integration

## Status
✅ Complete - All UX improvements implemented and tested
