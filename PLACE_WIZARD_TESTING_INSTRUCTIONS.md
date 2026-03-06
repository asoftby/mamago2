# Place Wizard Testing Instructions

## Status: ✅ Ready for Testing

The dev server has been restarted with the fresh Prisma client that includes the TempMedia model. The temp media API should now work correctly.

## Quick Test Flow

### 1. Open the Wizard
Navigate to: http://localhost:3002/business/places/new

**Expected:**
- Page loads without errors
- wizardSessionId generated and stored in localStorage
- No DB writes (check Network tab)

### 2. Test Step 1 - Profile
- Fill in title, category, short description
- Type in description field

**Expected:**
- No DB writes (check Network tab)
- localStorage updates automatically (check Application tab)
- Key: `placeWizard:{userId}:{wizardSessionId}`

### 3. Test Step 2 - Location
- Click "Выбрать на карте"
- Select an address (e.g., Minsk)
- Confirm selection

**Expected:**
- No DB writes
- localStorage updates with coordinates
- cityId resolved automatically

### 4. Test Step 3 - Logo Upload (CRITICAL TEST)
- Navigate to Step 3
- Click or drag & drop a logo image

**Expected:**
- ✅ Upload succeeds (no "Internal server error")
- POST /api/business/temp-media returns 200
- Preview shows immediately
- localStorage updates with logoMediaId and logoUrl
- Check Network tab: should see successful POST to /api/business/temp-media

**If it fails:**
- Check browser console for errors
- Check server terminal (terminal 24) for detailed error logs
- Verify TempMedia table exists in Prisma Studio

### 5. Test Step 3 - Gallery Upload
- Upload 2-3 gallery images

**Expected:**
- All uploads succeed
- Multiple previews show
- localStorage updates with galleryMediaIds array

### 6. Test Page Reload
- Refresh the page (F5)

**Expected:**
- Draft restored from localStorage
- All fields populated
- Logo and gallery previews still visible
- No DB writes

### 7. Test Save Draft
- Click "Сохранить черновик" button

**Expected:**
- POST /api/business/places with status=DRAFT
- Place created in database
- Temp media attached to Place
- Place.logoImageId set
- Geo enrichment runs (cityId, district, metro)
- localStorage cleared
- Temp media session deleted
- Navigate to edit page

**Verify in database:**
- Place record exists with status=DRAFT
- PlaceImage records exist linked to Place
- TempMedia records marked as ATTACHED or DELETED

### 8. Test Discard Flow
- Open new wizard: /business/places/new
- Fill some fields
- Upload a logo
- Click X button (top right)

**Expected:**
- Confirmation dialog shows
- Click "Закрыть без сохранения"
- DELETE /api/business/temp-media/session/{sessionId}
- localStorage cleared
- Navigate to /business/places
- No Place created in database

## Debugging Tips

### Check Server Logs
Terminal 24 is running the dev server. Watch for:
```
[temp-media] POST request: { userId, wizardSessionId, kind, hasUrl }
[temp-media] Created temp media: {id}
```

### Check localStorage
Browser DevTools → Application → Local Storage → http://localhost:3002

Keys to check:
- `placeWizardSessionId:{userId}` - Session ID
- `placeWizard:{userId}:{wizardSessionId}` - Draft data

### Check Network Tab
Filter by:
- `/api/business/temp-media` - Should see POSTs for uploads
- `/api/business/places` - Should ONLY see POST on final save
- No PATCH requests during typing

### Check Database
Prisma Studio is running (terminal 9): http://localhost:5555

Tables to check:
- TempMedia - Should see TEMP records during wizard
- Place - Should be empty until save
- PlaceImage - Should be empty until save

## Success Criteria

✅ Logo upload works without "Internal server error"
✅ Gallery upload works
✅ No DB writes until final save
✅ localStorage autosave works
✅ Page reload restores draft
✅ Save creates Place + attaches media
✅ Discard deletes temp media + clears localStorage

## Known Issues

None currently. If you encounter any errors, check:
1. Server terminal (terminal 24) for detailed logs
2. Browser console for client-side errors
3. Network tab for failed API calls
4. Prisma Studio for database state

## Next Steps After Testing

Once all tests pass:
1. Mark implementation as complete
2. Document any edge cases found
3. Consider applying same pattern to Activity wizard
4. Consider applying same pattern to Offer wizard
5. Plan background cleanup job for old temp media (future)
