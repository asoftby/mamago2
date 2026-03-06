# Place Wizard Manual Save Implementation Plan

## Current State Analysis

### Autosave Locations
1. **PlaceWizard.tsx**
   - Uses `useAutosave` hook
   - Calls `updatePlace()` on every field change via `handleUpdate()`
   - Debounced 500ms

2. **PlaceLocationPicker.tsx**
   - Auto-saves location immediately on Google place select
   - Auto-saves location on map pin confirm
   - Auto-saves district/metro changes
   - Auto-saves place details (floor, unit, etc.)

3. **Step1Profile.tsx**
   - Calls `onUpdate()` on every field change
   - Triggers autosave via PlaceWizard's `handleUpdate()`

4. **Step3Photos.tsx**
   - Image uploads likely trigger saves

5. **Step4Contacts.tsx**
   - Contact field changes trigger saves

## Required Changes

### 1. Create Draft on "Добавить место" Click
**File:** `src/app/business/(protected)/places/new/CreatePlaceRedirect.tsx`
- Create Place with status=DRAFT
- Minimal required fields only
- Redirect to `/business/places/{id}/edit`

### 2. Remove Autosave Hook
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
- Remove `useAutosave` import and usage
- Remove `handleUpdate` autosave logic
- Keep optimistic UI updates
- Add dirty state tracking
- Add beforeunload listener

### 3. Add Manual Save Logic
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
- Add `isDirty` state
- Add `saveDraft()` function
- Track changes per step
- Save on "Далее" button if dirty
- Save on explicit "Сохранить черновик" button

### 4. Update PlaceLocationPicker
**File:** `src/components/business/place/PlaceLocationPicker.tsx`
- Remove all auto-save calls
- Keep location state in memory
- Return location data to parent
- Parent decides when to save

### 5. Update Step Components
**Files:** 
- `Step1Profile.tsx`
- `Step2Location.tsx`
- `Step3Photos.tsx`
- `Step4Contacts.tsx`

Changes:
- Remove immediate `onUpdate()` calls
- Track local state
- Add "Сохранить черновик" button
- Return data to parent on save/next

### 6. Add Save Draft Button
**File:** `src/app/business/(protected)/places/[id]/edit/components/WizardStepHeader.tsx`
- Add "Сохранить черновик" button
- Show only when dirty
- Call parent's `saveDraft()` function

### 7. Prevent Data Loss
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
- Add `beforeunload` event listener
- Show warning if `isDirty === true`
- Clean up listener on unmount

### 8. Update Next Button Behavior
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
- Check if dirty before moving to next step
- Save draft if dirty
- Then move to next step
- Show loading state during save

### 9. Add Toast Notifications
- "Черновик сохранён" on successful save
- Error messages on save failure

### 10. Keep Moderation Flow Unchanged
- Final step still shows "Отправить на модерацию"
- Submit endpoint remains the same

## Implementation Order

1. ✅ Create plan document
2. Update CreatePlaceRedirect to create minimal draft
3. Remove autosave from PlaceWizard
4. Add dirty state tracking
5. Add manual save function
6. Add beforeunload listener
7. Update PlaceLocationPicker (remove autosave)
8. Update Step1Profile (local state + manual save)
9. Update Step2Location (pass save handler)
10. Update Step3Photos (remove autosave)
11. Update Step4Contacts (remove autosave)
12. Add "Сохранить черновик" button to WizardStepHeader
13. Update "Далее" button to save before navigation
14. Add toast notifications
15. Test all flows

## Data Flow

### Old Flow (Autosave)
```
User types → onChange → onUpdate() → useAutosave → API call → DB
```

### New Flow (Manual Save)
```
User types → onChange → setState (local) → isDirty = true
User clicks "Сохранить" → saveDraft() → API call → DB → isDirty = false
User clicks "Далее" → if dirty: saveDraft() → navigate
```

## Edge Cases

1. **User leaves page with unsaved changes**
   - Show browser confirmation dialog
   - "You have unsaved changes"

2. **Save fails**
   - Show error toast
   - Keep dirty state
   - Allow retry

3. **User navigates between steps**
   - Save current step if dirty
   - Then navigate

4. **Image upload**
   - Upload image to storage
   - Don't save to Place until user clicks save
   - Store image URLs in local state

5. **Location selection**
   - Store location in local state
   - Don't call location API until save
   - Show preview immediately

## API Changes

### No changes needed to existing APIs
- `PATCH /api/business/places/[id]` - already exists
- `POST /api/business/places/[id]/submit` - unchanged
- Location APIs can be called on save

### Potential optimization
- Batch save all step data in one API call
- Or keep separate calls but only on explicit save

## Testing Checklist

- [ ] Create new place → draft created with minimal data
- [ ] Edit field → no API call
- [ ] Click "Сохранить черновик" → API call, toast shown
- [ ] Click "Далее" with changes → saves then navigates
- [ ] Click "Далее" without changes → navigates immediately
- [ ] Try to leave page with changes → warning shown
- [ ] Leave page without changes → no warning
- [ ] Select location → no immediate API call
- [ ] Save after location select → location saved
- [ ] Upload image → no immediate save
- [ ] Save after image upload → image reference saved
- [ ] Submit for moderation → works as before
- [ ] Network error on save → error shown, can retry

## Benefits

1. **No accidental drafts** - Draft only created when user clicks "Добавить место"
2. **Better UX** - User controls when to save
3. **Fewer API calls** - Only save when needed
4. **Data loss prevention** - Warning before leaving
5. **Clear feedback** - Toast shows when saved
6. **Faster editing** - No network delay on every keystroke

## Risks

1. **User forgets to save** - Mitigated by:
   - Save on "Далее" button
   - Warning on page leave
   - Visual indicator of unsaved changes

2. **More complex state management** - Mitigated by:
   - Clear separation of local vs saved state
   - Dirty tracking per step

3. **Location picker complexity** - Mitigated by:
   - Keep location in memory
   - Save all location data at once
