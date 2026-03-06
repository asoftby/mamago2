# Context Transfer - Step 3 Photo Upload Fix

## Summary

Fixed the issue where Step 4 (Contacts) becomes unavailable after uploading photos on Step 3 until page reload. Step 4 now becomes available immediately after logo upload without requiring a reload.

## Problem

After uploading a logo on Step 3:
- Step 4 remained locked (grayed out)
- User had to reload the page to proceed
- After reload, Step 4 became available

## Root Cause

Step validation (`validateStep3`) checks:
1. `place.logoImageId` exists ✅
2. Logo image exists in `place.images` array ❌

When logo was uploaded:
- API returned only `{ image }` object
- `Step3Photos` updated `place.logoImageId` but not `place.images`
- Validation failed because `place.images` was stale
- Page reload fetched fresh data with updated images array

## Solution

### 1. API Returns Complete Images Array
Modified POST `/api/business/places/[id]/images` to return updated images:
```typescript
const allImages = await prisma.placeImage.findMany({
  where: { placeId },
  orderBy: [
    { kind: "asc" },
    { sortOrder: "asc" },
  ],
});

return NextResponse.json({ image, images: allImages });
```

### 2. Component Chain Updates Images
- `PlaceLogoUpload` receives `images` from API and passes to callback
- `Step3Photos` receives `images` and updates wizard state
- `PlaceWizard` updates both `place.logoImageId` and `place.images`

### 3. Validation Passes Immediately
After state update:
- `place.logoImageId` is set ✅
- `place.images` includes logo ✅
- `validateStep3` returns true ✅
- Step 4 becomes available ✅

## Files Modified

1. **src/app/api/business/places/[id]/images/route.ts**
   - Return complete images array after upload

2. **src/components/business/place/PlaceLogoUpload.tsx**
   - Accept images in callback signature
   - Pass images to parent component

3. **src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx**
   - Update images array in wizard state
   - Added logging for debugging

4. **src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx**
   - Handle images array updates
   - Exclude images from pendingChanges (already saved)
   - Added validation logging

## Testing

See `PLACE_STEP3_TESTING_GUIDE.md` for detailed testing instructions.

Quick test:
1. Edit place, complete Steps 1-2
2. Go to Step 3, upload logo
3. ✅ Step 4 becomes available immediately
4. ✅ Click "Next" navigates to Step 4

## Acceptance Criteria

✅ Upload logo → Step 4 available immediately
✅ No reload required
✅ Upload failure keeps Step 4 locked
✅ Error toast shown on failure
✅ Navigation disabled during upload
✅ Images array synced with wizard state

## Design Decisions

### Why Not Refetch Entire Place?
- More efficient to return just images array
- Avoids race conditions with other pending changes
- Faster response time

### Why Exclude Images from pendingChanges?
- Images are saved immediately via upload API
- No need to save again via draft save
- Prevents confusion about what needs saving

### Why Update State Immediately?
- Better UX (no waiting for manual save)
- Upload is already an explicit save action
- Consistent with manual save philosophy

## Future Enhancements

1. **Gallery Upload State Sync**
   - Currently gallery manages its own state
   - Could sync with wizard state for consistency
   - Useful if gallery affects validation

2. **Optimistic UI Updates**
   - Show preview immediately while uploading
   - Update with final URL after completion

3. **Batch Upload Progress**
   - Show progress for multiple uploads
   - Disable navigation until all complete

## Related Documentation

- `PLACE_STEP3_PHOTO_UPLOAD_FIX.md` - Detailed implementation
- `PLACE_STEP3_TESTING_GUIDE.md` - Testing instructions
- `src/app/business/(protected)/places/[id]/edit/utils/stepValidation.ts` - Validation logic
