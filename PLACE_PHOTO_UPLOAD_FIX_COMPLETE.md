# Place Photo Upload Fix - Complete ✅

## Summary

Fixed the issue where logo/gallery uploads failed with "Place not found" error because uploads were attempted before the place record was created. Uploads now only work after the user explicitly saves a draft, with clear UI guidance.

## Problem

- Logo/gallery upload failed with "Place not found" error
- Uploads were attempted when `placeId` was "new" or missing
- No DB record existed yet in NewPlaceWizard
- Users were confused about why uploads didn't work

## Root Cause

1. `NewPlaceWizard` uses local state only - no DB record until first save
2. `Step3Photos` passed `place.id` which was "new" (mock value)
3. Upload components called `/api/business/places/[id]/images` with invalid ID
4. API returned 404 "Place not found"

## Solution

### 1. Track placeId in NewPlaceWizard

Added `placeId` state that's only set after first successful save:

```typescript
const [placeId, setPlaceId] = useState<string | null>(null);

// In saveDraft callback:
const { place } = await res.json();
setPlaceId(place.id); // Store for future operations
```

### 2. Pass placeId to Step3Photos

```typescript
<Step3Photos
  place={mockPlace}
  images={localDraft.images}
  placeId={placeId}  // null until first save
  onUpdate={handleUpdate}
  onSaveDraft={saveDraft}  // Callback to create place
  onPrev={handlePrev}
  onNext={handleNext}
  canNext={canGoNext}
/>
```

### 3. Update Upload Components

Both `PlaceLogoUpload` and `PlaceGalleryUpload` now:

**Check if place exists:**
```typescript
const placeExists = placeId && placeId !== "new";
```

**Show save draft message when place doesn't exist:**
```typescript
{!placeExists && onSaveDraft ? (
  <div className="border-2 border-dashed rounded-xl p-10 text-center bg-muted/30">
    <div className="space-y-4">
      <Upload className="mx-auto h-12 w-12 text-gray-400" />
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">
          Чтобы загрузить фото, сначала сохраните место как черновик
        </p>
        <p className="text-xs text-muted-foreground">
          Это нужно для привязки фотографий к месту
        </p>
      </div>
      <button onClick={handleSaveDraftClick}>
        Сохранить черновик
      </button>
    </div>
  </div>
) : (
  // Normal upload UI
)}
```

**Handle save draft click:**
```typescript
const handleSaveDraftClick = async () => {
  if (!onSaveDraft) return;
  
  setIsSavingDraft(true);
  try {
    await onSaveDraft();
    toast.success("Черновик сохранён. Теперь можно загружать фото.");
  } catch (error) {
    toast.error("Ошибка сохранения черновика");
  } finally {
    setIsSavingDraft(false);
  }
};
```

## User Flow

### Before Fix
1. User opens "Create Place" wizard
2. Fills Step 1 and Step 2
3. Goes to Step 3
4. Tries to upload logo
5. ❌ Error: "Place not found"
6. User is confused

### After Fix
1. User opens "Create Place" wizard
2. Fills Step 1 and Step 2
3. Goes to Step 3
4. Sees message: "Чтобы загрузить фото, сначала сохраните место как черновик"
5. Clicks "Сохранить черновик" button
6. Place is created, placeId is stored
7. Upload UI appears
8. ✅ User can now upload logo/gallery

## Files Modified

1. **src/app/business/(protected)/places/new/NewPlaceWizard.tsx**
   - Added `placeId` state
   - Store placeId after first save
   - Pass placeId and onSaveDraft to Step3Photos

2. **src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx**
   - Accept optional `placeId` and `onSaveDraft` props
   - Pass them to upload components

3. **src/components/business/place/PlaceLogoUpload.tsx**
   - Accept optional `onSaveDraft` prop
   - Check if place exists
   - Show save draft message when place doesn't exist
   - Handle save draft click

4. **src/components/business/place/PlaceGalleryUpload.tsx**
   - Accept optional `onSaveDraft` prop
   - Check if place exists
   - Show save draft message when place doesn't exist
   - Handle save draft click

## API Behavior

### Before Save
- `placeId` is null or "new"
- Upload components show save draft message
- No API calls are made

### After Save
- `placeId` is a valid cuid (e.g., "clxxx...")
- Upload components show normal upload UI
- API calls to `/api/business/places/[id]/images` succeed

## Testing

### Test Case 1: Upload Before Save
1. Go to `/business/places/new`
2. Fill Step 1 (title, category, shortDesc)
3. Fill Step 2 (location)
4. Go to Step 3
5. ✅ See message: "Чтобы загрузить фото, сначала сохраните место как черновик"
6. ✅ See "Сохранить черновик" button
7. ✅ Upload UI is not shown

### Test Case 2: Save Draft Then Upload
1. Continue from Test Case 1
2. Click "Сохранить черновик"
3. ✅ Place is created
4. ✅ Toast: "Черновик сохранён"
5. ✅ Upload UI appears
6. Upload logo
7. ✅ Upload succeeds
8. ✅ Logo appears in preview

### Test Case 3: Edit Existing Place
1. Go to `/business/places/[id]/edit`
2. Navigate to Step 3
3. ✅ Upload UI is shown immediately (place already exists)
4. Upload logo
5. ✅ Upload succeeds

### Test Case 4: Gallery Upload
1. Follow Test Case 2
2. After logo upload, scroll to gallery section
3. ✅ Gallery upload UI is shown
4. Upload gallery images
5. ✅ Uploads succeed
6. ✅ Images appear in grid

## Edge Cases Handled

### 1. User Clicks Save Draft Multiple Times
- Button is disabled while saving (`isSavingDraft` state)
- Idempotency handled by `createRequestId`
- Only one place record is created

### 2. User Navigates Away Before Saving
- Leave confirmation dialog appears (if meaningful changes)
- User can choose to save or discard

### 3. Save Draft Fails
- Error toast is shown
- Upload UI remains hidden
- User can retry save

### 4. User Refreshes Page
- Local state is lost
- User returns to Step 1
- Must fill form again (expected behavior for new places)

## Acceptance Criteria

✅ Open "Create Place" wizard → no DB record created
✅ Try upload logo/gallery before saving → UI blocks upload
✅ UI shows clear message: "Сохраните место как черновик"
✅ UI shows "Сохранить черновик" button
✅ Click "Save draft" → place created, placeId stored
✅ Upload logo/gallery → succeeds and updates UI immediately
✅ Edit existing place → upload works immediately (place already exists)

## Design Decisions

### Why Not Auto-Create on Step 3?
- Maintains "no auto-create" philosophy
- User has explicit control over when place is created
- Prevents orphaned draft records

### Why Show Button in Upload Component?
- Contextual - user sees button exactly where they need it
- Clear cause-and-effect relationship
- Reduces cognitive load

### Why Not Disable Step 3 Until Saved?
- User can still view Step 3 to see what's needed
- Encourages exploration of wizard
- Button provides clear next action

## Future Enhancements

### 1. Persist Local State
Store localDraft in sessionStorage:
```typescript
useEffect(() => {
  sessionStorage.setItem('newPlaceDraft', JSON.stringify(localDraft));
}, [localDraft]);
```

Restore on mount:
```typescript
const [localDraft, setLocalDraft] = useState(() => {
  const saved = sessionStorage.getItem('newPlaceDraft');
  return saved ? JSON.parse(saved) : defaultDraft;
});
```

### 2. Auto-Save Draft on Step 3
Automatically save draft when user navigates to Step 3:
```typescript
useEffect(() => {
  if (currentStep === 3 && !placeId && isMeaningfulDraft(localDraft)) {
    saveDraft();
  }
}, [currentStep]);
```

### 3. Show Progress Indicator
Show which steps are complete:
```typescript
<div className="flex items-center gap-2">
  <CheckCircle className="text-green-500" />
  <span>Шаг 1: Заполнено</span>
</div>
```

## Related Documentation

- `PLACE_NO_AUTO_CREATE_COMPLETE.md` - No auto-create implementation
- `PLACE_WIZARD_MANUAL_SAVE_COMPLETE.md` - Manual save philosophy
- `PLACE_STEP3_PHOTO_UPLOAD_FIX.md` - Step 3 photo upload fix (images array sync)
