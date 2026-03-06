# Step 3 Validation - Quick Test Guide

## 🎯 What Was Fixed

Step 4 (Contacts) now unlocks immediately after uploading photos on Step 3.

## ⚡ Quick Test (1 minute)

### Test 1: Logo Upload
1. Go to http://localhost:3002/business/places/new
2. Fill Step 1 (title, category, description)
3. Fill Step 2 (select address)
4. Navigate to Step 3
5. Upload a logo
6. ✅ **Step 4 should unlock immediately**
7. ✅ Click "Далее" or click "4. Контакты" in header
8. ✅ Should navigate to Step 4

### Test 2: Gallery Upload
1. Open new wizard
2. Fill Steps 1-2
3. Navigate to Step 3
4. Skip logo
5. Upload 1-2 gallery images
6. ✅ **Step 4 should unlock immediately**
7. ✅ Can navigate to Step 4

### Test 3: No Photos
1. Open new wizard
2. Fill Steps 1-2
3. Navigate to Step 3
4. Don't upload anything
5. ❌ **Step 4 should remain locked**
6. ❌ "Далее" button disabled
7. ❌ Cannot click "4. Контакты" in header

## 🔍 What to Check

### Visual Indicators
- Step 4 badge in header changes from gray (locked) to clickable
- "Далее" button becomes enabled
- No error messages

### Browser Console
```
[Step3Photos] Logo upload complete: { mediaId, url }
[NewPlaceWizard] Local autosave complete
```

### Network Tab
- POST /api/business/temp-media → 200 OK
- No other API calls (no DB writes)

### React DevTools (Optional)
- localDraft.logoMediaId updated
- localDraft.logoUrl updated
- mockPlace.logoImageId set
- mockPlace.images includes logo

## ✅ Success Criteria

- [x] Upload logo → Step 4 unlocks
- [x] Upload gallery → Step 4 unlocks
- [x] No photos → Step 4 locked
- [x] No page reload needed
- [x] Immediate feedback

## 🐛 If It Doesn't Work

### Check 1: Upload Success
- Did the upload complete? (check console logs)
- Is there a preview showing?
- Check Network tab for 200 response

### Check 2: State Update
- Open React DevTools
- Find NewPlaceWizard component
- Check localDraft.logoMediaId is set
- Check localDraft.logoUrl is set

### Check 3: Validation
- Check mockPlace.logoImageId
- Check mockPlace.images array length
- Should have at least 1 image

### Check 4: Browser Cache
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Clear browser cache
- Restart dev server if needed

## 📊 Before vs After

### Before ❌
- Upload logo → Step 4 still locked
- Had to reload page
- Validation too strict (required logo AND logo in images)

### After ✅
- Upload logo → Step 4 unlocks immediately
- No reload needed
- Validation flexible (logo OR gallery)

## 🎉 Expected Behavior

```
Step 1 (Profile) → Fill required fields → Step 2 unlocks
Step 2 (Location) → Select address → Step 3 unlocks
Step 3 (Photos) → Upload photo → Step 4 unlocks ✨
Step 4 (Contacts) → Fill contacts → Can submit
```

## 💡 Technical Details

### Validation Logic
```typescript
// Step 3 is valid if:
hasLogo (logoImageId exists)
  OR
hasGalleryImages (images.length > 0)
```

### State Flow
```
Upload → onUpdate → localDraft → mockPlace → validation → UI update
```

### Files Changed
- `stepValidation.ts` - Relaxed validation
- `NewPlaceWizard.tsx` - Include logo in mockPlace.images

## 🚀 Next Steps

After confirming this works:
1. Test full wizard flow end-to-end
2. Test page reload with photos
3. Test save draft with photos
4. Test submit for moderation
5. Verify temp media attached to Place

See `PLACE_WIZARD_TESTING_INSTRUCTIONS.md` for complete testing.
