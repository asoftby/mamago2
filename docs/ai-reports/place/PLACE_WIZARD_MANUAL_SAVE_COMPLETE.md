# Place Wizard Manual Save - Implementation Complete ✅

## Summary
Successfully implemented manual save functionality for Place Wizard, replacing autosave with explicit user-triggered saves.

## What Was Done

### 1. PlaceWizard.tsx - Core Manual Save Logic ✅
- Removed autosave hook usage
- Added dirty state tracking (`isDirty`, `pendingChanges`)
- Implemented `saveDraft()` function with proper error handling
- Added beforeunload listener for unsaved changes warning
- Updated navigation handlers (`handleNext`, `handlePrev`, `handleStepClick`) to save before navigating
- Updated `handleSubmit` to save before submitting
- Added "Есть несохранённые изменения" warning banner

### 2. WizardHeaderNew.tsx - Save Button UI ✅
- Added "Сохранить черновик" button
- Shows save status indicator (Не сохранено / Сохранено / Сохраняю...)
- Button disabled when not dirty
- Visual feedback with colors and icons

### 3. Step4Contacts.tsx - isSaving Prop ✅
- Added `isSaving` prop to interface
- Passed to WizardStepHeader to disable submit button during save

### 4. WizardStepHeader.tsx - Disable During Save ✅
- Added `isSaving` prop
- Next/Submit button disabled when saving

### 5. PlaceLocationPicker.tsx - Removed Autosave ✅
- Added `onUpdate` prop to pass changes to parent
- Removed autosave calls from:
  - `handlePlaceSelect` - now only updates local state and calls onUpdate
  - `handleMapConfirm` - now only updates local state and calls onUpdate
  - `handleDistrictChange` - now only updates local state and calls onUpdate
  - `handleMetroChange` - now only updates local state and calls onUpdate
  - `handleResetDistrict` - now only updates local state and calls onUpdate
  - `handleResetMetro` - now only updates local state and calls onUpdate
- Commented out unused `saveLocation` function (kept for reference)
- Updated toast messages to indicate "(не сохранено)"

### 6. Step2Location.tsx - Pass onUpdate ✅
- Updated to pass `onUpdate` prop to PlaceLocationPicker
- Location changes now tracked by parent wizard

## How It Works

### User Flow
1. User edits any field → `isDirty` becomes true, warning banner appears
2. User clicks "Сохранить черновик" → saves to API, clears dirty state, shows toast
3. User clicks "Далее" → saves if dirty, then navigates to next step
4. User tries to leave page → browser shows warning if dirty
5. User clicks "Отправить на модерацию" → saves if dirty, then submits

### Technical Flow
```
Field Change
  ↓
handleUpdate() called
  ↓
Optimistic UI update (setPlace)
  ↓
Track change (setPendingChanges)
  ↓
Set dirty flag (setIsDirty = true)
  ↓
Show warning banner + enable save button
  ↓
User clicks "Сохранить черновик" or "Далее"
  ↓
saveDraft() called
  ↓
PATCH /api/business/places/{id}
  ↓
Success: clear dirty state, show toast
  ↓
Navigate (if from "Далее")
```

## Files Modified

1. ✅ `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
2. ✅ `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`
3. ✅ `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
4. ✅ `src/app/business/(protected)/places/[id]/edit/components/WizardStepHeader.tsx`
5. ✅ `src/components/business/place/PlaceLocationPicker.tsx`
6. ✅ `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`

## Testing Checklist

### Manual Save
- [ ] Edit title → no API call in Network tab
- [ ] "Сохранить черновик" button appears and is enabled
- [ ] Click "Сохранить черновик" → API call, toast "Черновик сохранён"
- [ ] Button becomes disabled after save
- [ ] "Не сохранено" changes to "Сохранено" with timestamp

### Navigation with Save
- [ ] Edit field, click "Далее" → saves then navigates
- [ ] No changes, click "Далее" → navigates immediately (no API call)
- [ ] Edit field, click step indicator → saves then navigates
- [ ] Edit field, click "Назад" → saves then navigates

### Data Loss Prevention
- [ ] Edit field, try to close tab → browser warning shown
- [ ] No changes, close tab → no warning
- [ ] Edit field, refresh page → browser warning shown

### Location Picker
- [ ] Select Google place → no immediate API call
- [ ] Location shown in preview
- [ ] Select district → no immediate API call, toast "(не сохранено)"
- [ ] Select metro → no immediate API call, toast "(не сохранено)"
- [ ] Click "Сохранить черновик" → all location changes saved together

### Submit Flow
- [ ] Fill all required fields
- [ ] Edit field on step 4
- [ ] Click "Отправить на модерацию" → saves first, then submits
- [ ] Redirects to success page

### Error Handling
- [ ] Network error on save → error toast shown
- [ ] Dirty state preserved after error
- [ ] Can retry save
- [ ] Save fails → doesn't navigate

## Verification Commands

```bash
# Start dev server
pnpm dev

# Open place wizard
# Navigate to: http://localhost:3002/business/places/{placeId}/edit

# Open browser DevTools Network tab
# Filter by "places" to see API calls

# Test scenarios:
# 1. Type in title field → should see NO network requests
# 2. Click "Сохранить черновик" → should see ONE PATCH request
# 3. Click "Далее" with changes → should see ONE PATCH request before navigation
# 4. Select location → should see NO network requests
# 5. Click "Сохранить черновик" → should see ONE PATCH request with location data
```

## Key Improvements

### Before (Autosave)
- ❌ API call on every field change
- ❌ Multiple empty drafts created
- ❌ No user control over when to save
- ❌ Network spam
- ❌ Confusing UX (when is it saved?)

### After (Manual Save)
- ✅ No API calls while typing
- ✅ Single draft per user
- ✅ Explicit save control
- ✅ Minimal network requests
- ✅ Clear save status feedback
- ✅ Data loss prevention
- ✅ Auto-save on navigation

## Notes

- Draft creation still works correctly (CreatePlaceRedirect.tsx unchanged)
- API endpoints unchanged (PATCH /api/business/places/{id} works as before)
- Image upload to storage still happens immediately (only reference save is delayed)
- Geo enrichment still runs server-side on save
- All TypeScript diagnostics pass ✅

## Next Steps (Optional Enhancements)

1. Add keyboard shortcut (Cmd+S / Ctrl+S) to trigger save
2. Add auto-save timer (e.g., save every 2 minutes if dirty)
3. Add "Discard changes" button to reset to last saved state
4. Add optimistic UI updates with rollback on error
5. Add save queue for offline support

## Related Documents

- `PLACE_WIZARD_MANUAL_SAVE_IMPLEMENTATION.md` - Implementation plan
- `PLACE_SINGLE_DRAFT_LIMIT_COMPLETE.md` - Single draft enforcement
- `PLACE_AUTOSAVE_DISABLED_FIX.md` - Autosave hook disabled

---

**Status:** ✅ Complete and ready for testing
**Date:** 2026-03-05
**Implemented by:** Kiro AI Assistant
