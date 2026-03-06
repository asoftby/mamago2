# Place Step 3 Photo Upload - Testing Guide

## Quick Test (3 minutes)

### Setup
1. Navigate to an existing place edit page or create a new place
2. Complete Step 1 (title, category, shortDesc)
3. Complete Step 2 (location with lat/lng)
4. Navigate to Step 3 (Photos)

### Test: Logo Upload Enables Step 4

**Before Upload:**
- Step 4 should be locked (grayed out in header)
- "Next" button should be disabled or show validation error

**Upload Logo:**
1. Click or drag-drop an image to the logo upload area
2. Wait for upload to complete (should see "Логотип загружен" toast)

**After Upload:**
- ✅ Step 4 should become available immediately (no reload needed)
- ✅ Step 4 indicator in header should change from "locked" to "available"
- ✅ "Next" button should become enabled
- ✅ Clicking "Next" should navigate to Step 4

**Browser Console Logs:**
You should see these logs in order:
```
[PlaceLogoUpload] Upload complete: { imageId: "...", imagesCount: 1 }
[Step3Photos] Logo upload complete, updating wizard state: { imageId: "...", imagesCount: 1 }
[PlaceWizard] handleUpdate called: { hasImages: true, imagesCount: 1, placeUpdates: ["logoImageId"] }
[PlaceWizard] After update - Step 3 valid: true
```

### Test: Upload Failure Keeps Step 4 Locked

**Simulate Failure:**
1. Disconnect network or use browser dev tools to block the upload request
2. Try to upload a logo
3. ✅ Should see error toast
4. ✅ Step 4 should remain locked
5. ✅ Can retry upload after fixing issue

### Test: Navigation During Upload

**During Upload:**
1. Start uploading a large image
2. Try to click "Next" or navigate to another step
3. ✅ Navigation should be disabled while upload is in progress
4. ✅ After upload completes, navigation becomes available

## Detailed Testing Scenarios

### Scenario 1: New Place Creation
1. Go to `/business/places/new`
2. Fill Step 1 (title, category, shortDesc)
3. Fill Step 2 (select address)
4. Click "Сохранить черновик" to create place
5. Navigate to Step 3
6. Upload logo
7. ✅ Step 4 becomes available
8. Navigate to Step 4
9. ✅ Can fill contact information

### Scenario 2: Edit Existing Draft
1. Go to existing draft place edit page
2. Navigate to Step 3
3. Upload logo (if not already uploaded)
4. ✅ Step 4 becomes available immediately
5. Navigate to Step 4 and back to Step 3
6. ✅ Logo is still shown
7. ✅ Step 4 remains available

### Scenario 3: Replace Existing Logo
1. Go to place with existing logo
2. Navigate to Step 3
3. Click on existing logo to replace
4. Upload new logo
5. ✅ New logo replaces old one
6. ✅ Step 4 remains available
7. ✅ No duplicate images created

### Scenario 4: Gallery Upload (Optional)
Gallery uploads don't affect step validation (only logo is required), but should still work:
1. Upload logo first
2. Upload 1+ gallery images
3. ✅ Gallery images appear in grid
4. ✅ Can reorder by drag-drop
5. ✅ Can delete gallery images
6. ✅ Step 4 remains available

## Troubleshooting

### Issue: Step 4 Still Locked After Upload

**Check Console Logs:**
1. Look for `[PlaceLogoUpload] Upload complete` - if missing, upload failed
2. Look for `[Step3Photos] Logo upload complete` - if missing, callback not called
3. Look for `[PlaceWizard] After update - Step 3 valid: true` - if false, validation failed

**Check Network Tab:**
1. POST to `/api/business/places/[id]/images` should return 200
2. Response should include `{ image: {...}, images: [...] }`
3. `images` array should include the new logo

**Check State:**
1. Open React DevTools
2. Find PlaceWizard component
3. Check `place.logoImageId` - should be set
4. Check `place.images` - should include logo with `kind: "LOGO"`

### Issue: Upload Fails

**Common Causes:**
1. File too large (>5MB) - should show error toast
2. Invalid file type - should show error toast
3. Network error - check browser console
4. Server error - check server logs

**Fix:**
1. Try smaller image
2. Try different image format (PNG, JPEG, WebP)
3. Check network connection
4. Check server is running

### Issue: Images Array Not Updated

**Check API Response:**
1. Open Network tab
2. Find POST to `/api/business/places/[id]/images`
3. Check response includes `images` array
4. If missing, API needs to be updated

**Check Callback:**
1. Verify `PlaceLogoUpload` calls `onUploadComplete(imageId, images)`
2. Verify `Step3Photos` passes `images` to `onUpdate`
3. Verify `PlaceWizard` updates `place.images`

## Success Criteria

✅ Logo upload completes successfully
✅ Step 4 becomes available immediately (no reload)
✅ Console logs show correct flow
✅ Step validation passes
✅ Can navigate to Step 4
✅ Upload failure shows error and keeps Step 4 locked
✅ Images array is synced with wizard state

## Performance Notes

- Logo upload typically takes 1-3 seconds depending on image size and network
- Image is compressed before upload (max 1024px, 90% quality)
- Upload is awaited before enabling navigation
- State updates are synchronous after upload completes

## Browser Compatibility

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

All modern browsers support:
- File input with drag-drop
- Image compression via canvas
- Fetch API for uploads
- React state updates
