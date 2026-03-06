# Place Step 3 Photo Upload Fix - Complete ✅

## Problem

After uploading photos on Step 3, Step 4 (Contacts) becomes unavailable until page reload. After reload, everything works fine.

## Root Cause

The step validation logic (`validateStep3`) checks two conditions:
1. `place.logoImageId` exists
2. A logo image exists in `place.images` array

When a logo is uploaded:
1. The API returns only the `image` object
2. `Step3Photos` calls `onUpdate({ logoImageId: imageId })` 
3. This updates `place.logoImageId` but NOT `place.images`
4. `validateStep3` fails because `place.images` doesn't include the new logo
5. Step 4 remains locked until page reload fetches fresh data

## Solution Implemented

### 1. API Returns Updated Images Array

Modified `/api/business/places/[id]/images/route.ts` POST endpoint to return the complete updated images array:

```typescript
// After creating image and updating place.logoImageId
const allImages = await prisma.placeImage.findMany({
  where: { placeId },
  orderBy: [
    { kind: "asc" }, // LOGO first, then GALLERY
    { sortOrder: "asc" },
  ],
});

return NextResponse.json({ image, images: allImages });
```

### 2. PlaceLogoUpload Passes Images Array

Updated `PlaceLogoUpload` component to:
- Accept `images` array in API response
- Pass both `imageId` and `images` to `onUploadComplete` callback

```typescript
interface PlaceLogoUploadProps {
  placeId: string;
  currentLogoUrl?: string | null;
  onUploadComplete?: (imageId: string, images: any[]) => void;
}

// In upload handler:
const data = await response.json();
onUploadComplete?.(data.image.id, data.images || []);
```

### 3. Step3Photos Updates Images Array

Updated `Step3Photos` to update both `logoImageId` and `images` in wizard state:

```typescript
const handleLogoUploadComplete = (imageId: string, updatedImages: PlaceImage[]) => {
  setHasLogo(true);
  onUpdate({ 
    logoImageId: imageId,
    images: updatedImages 
  });
};
```

### 4. PlaceWizard Handles Images Update

Updated `PlaceWizard.handleUpdate` to handle `images` array updates:

```typescript
const handleUpdate = (updates: Partial<Place> & { images?: PlaceImage[] }) => {
  const { images: updatedImages, ...placeUpdates } = updates;
  
  setPlace((prev) => ({ 
    ...prev, 
    ...placeUpdates,
    ...(updatedImages && { images: updatedImages })
  }));
  
  // Track changes for manual save (exclude images from pendingChanges)
  if (Object.keys(placeUpdates).length > 0) {
    setPendingChanges((prev) => ({ ...prev, ...placeUpdates }));
    setIsDirty(true);
  }
};
```

Note: Images are excluded from `pendingChanges` because they're saved immediately via the upload API, not via the manual save draft flow.

## How It Works Now

1. User uploads logo on Step 3
2. `PlaceLogoUpload` calls upload API
3. API creates image, updates `place.logoImageId`, and returns updated images array
4. `PlaceLogoUpload` calls `onUploadComplete(imageId, images)`
5. `Step3Photos` calls `onUpdate({ logoImageId, images })`
6. `PlaceWizard` updates both `place.logoImageId` and `place.images`
7. `validateStep3` now passes (both conditions met)
8. Step 4 becomes available immediately

## Files Modified

1. `src/app/api/business/places/[id]/images/route.ts`
   - Return updated images array after upload

2. `src/components/business/place/PlaceLogoUpload.tsx`
   - Accept images in callback signature
   - Pass images to parent

3. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
   - Update images array in wizard state

4. `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
   - Handle images array updates separately from pendingChanges

## Testing

### Test Case 1: Logo Upload Enables Step 4
1. Create new place or edit existing draft
2. Complete Step 1 (title, category, shortDesc)
3. Complete Step 2 (location)
4. Go to Step 3
5. Upload logo
6. ✅ Step 4 should become available immediately (no reload needed)
7. ✅ Click "Next" should navigate to Step 4

### Test Case 2: Upload Failure Keeps Step 4 Locked
1. Go to Step 3
2. Simulate upload failure (disconnect network or use invalid file)
3. ✅ Error toast should appear
4. ✅ Step 4 should remain locked
5. ✅ User can retry upload

### Test Case 3: Gallery Upload (Future Enhancement)
Currently, gallery uploads don't affect step validation (only logo is required). Gallery images are managed by `PlaceGalleryUpload` component with its own state.

If gallery images need to affect step validation in the future:
- Add `onImagesChange` callback to `PlaceGalleryUpload` in `Step3Photos`
- Update wizard state when gallery changes
- Modify `validateStep3` to check gallery requirements

## Race Condition Prevention

The current implementation prevents race conditions by:
1. Upload is awaited before calling `onUploadComplete`
2. State updates are synchronous after upload completes
3. Step validation runs on updated state
4. No navigation is possible during upload (button is disabled)

## Manual Save Philosophy

This fix maintains the manual save philosophy:
- Logo upload is an explicit save action (uploads to CDN + saves to DB)
- Upload marks Step 3 as completed immediately
- No extra "Save Draft" click needed for photos
- Other field changes still require manual save

## Acceptance Criteria

✅ Upload 1+ photos → Step 4 becomes available immediately
✅ No reload required
✅ If upload fails, Step 4 remains locked and user sees error toast
✅ Upload is awaited before enabling navigation
✅ Images array is synced with wizard state

## Future Enhancements

1. **Gallery Upload State Sync**
   - Add callback to sync gallery images with wizard state
   - Useful if gallery affects validation or needs to be displayed elsewhere

2. **Optimistic UI Updates**
   - Show image preview immediately while uploading
   - Update with final URL after upload completes

3. **Batch Upload Progress**
   - Show progress for multiple gallery uploads
   - Disable navigation until all uploads complete

## Related Files

- `src/app/business/(protected)/places/[id]/edit/utils/stepValidation.ts` - Step validation logic
- `src/components/business/place/PlaceGalleryUpload.tsx` - Gallery upload component (not modified)
