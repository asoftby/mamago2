# Context Transfer - Photo Upload Fix

## Summary

Fixed logo/gallery upload failures in NewPlaceWizard by ensuring uploads only work after the place record is created. Added clear UI guidance with a "Save Draft" button when uploads are blocked.

## Problem

- Logo/gallery uploads failed with "Place not found" error
- NewPlaceWizard had no DB record until first save
- Upload components tried to call API with invalid placeId ("new")
- Users were confused about why uploads didn't work

## Solution

### 1. Track placeId in NewPlaceWizard
```typescript
const [placeId, setPlaceId] = useState<string | null>(null);

// Store after first save:
const { place } = await res.json();
setPlaceId(place.id);
```

### 2. Pass placeId and onSaveDraft to Step3Photos
```typescript
<Step3Photos
  placeId={placeId}
  onSaveDraft={saveDraft}
  // ... other props
/>
```

### 3. Update Upload Components
Both PlaceLogoUpload and PlaceGalleryUpload now:
- Check if `placeId` is valid
- Show "Save Draft" message when place doesn't exist
- Provide button to create place before upload
- Show normal upload UI after place is created

## User Flow

**Before:**
1. User tries to upload → ❌ Error: "Place not found"

**After:**
1. User sees message: "Чтобы загрузить фото, сначала сохраните место как черновик"
2. User clicks "Сохранить черновик"
3. Place is created, placeId is stored
4. ✅ Upload UI appears and works

## Files Modified

1. `src/app/business/(protected)/places/new/NewPlaceWizard.tsx`
   - Added placeId state
   - Pass placeId and onSaveDraft to Step3Photos

2. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
   - Accept optional placeId and onSaveDraft props
   - Pass to upload components

3. `src/components/business/place/PlaceLogoUpload.tsx`
   - Show save draft message when place doesn't exist
   - Handle save draft click

4. `src/components/business/place/PlaceGalleryUpload.tsx`
   - Show save draft message when place doesn't exist
   - Handle save draft click

## Testing

✅ Open new place wizard → no DB record
✅ Go to Step 3 → see "Save Draft" message
✅ Click "Save Draft" → place created
✅ Upload logo → succeeds
✅ Upload gallery → succeeds
✅ Edit existing place → upload works immediately

## Acceptance Criteria

✅ No auto-create on wizard open
✅ Upload blocked before save with clear message
✅ "Save Draft" button creates place
✅ Uploads work after place is created
✅ Existing places work normally

## Related Documentation

- `PLACE_PHOTO_UPLOAD_FIX_COMPLETE.md` - Complete implementation details
- `PLACE_NO_AUTO_CREATE_COMPLETE.md` - No auto-create philosophy
- `PLACE_WIZARD_MANUAL_SAVE_COMPLETE.md` - Manual save implementation
