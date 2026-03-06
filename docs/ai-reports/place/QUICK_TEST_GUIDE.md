# Quick Test Guide - Place Wizard Local Autosave

## 🚀 Ready to Test!

**URL:** http://localhost:3002/business/places/new

## ⚡ Quick Test (2 minutes)

### 1. Open Wizard
- Navigate to http://localhost:3002/business/places/new
- ✅ Page loads without errors

### 2. Fill Step 1
- Title: "Test Place"
- Category: Select any
- Short description: "Test description"
- ✅ No DB writes (check Network tab)

### 3. Upload Logo (CRITICAL TEST)
- Navigate to Step 3
- Drag & drop or click to upload an image
- ✅ **Should succeed** (no "Internal server error")
- ✅ Preview shows immediately

### 4. Refresh Page
- Press F5
- ✅ Draft restored
- ✅ Logo still visible

### 5. Save Draft
- Click "Сохранить черновик"
- ✅ Place created
- ✅ Navigate to edit page

## 🔍 What to Check

### Browser Console
- No errors during upload
- See: `[PlaceLogoUploadTemp] Upload complete: {id}`

### Network Tab
- POST /api/business/temp-media → 200 OK
- POST /api/business/places → 200 OK (only on save)

### Server Terminal (24)
```
[temp-media] POST request: { userId, wizardSessionId, kind, hasUrl }
[temp-media] Created temp media: {id}
```

### localStorage (Application Tab)
Keys:
- `placeWizardSessionId:{userId}` - Session ID
- `placeWizard:{userId}:{wizardSessionId}` - Draft data

## ✅ Success Criteria

- [x] Logo upload works (no error)
- [x] Preview shows immediately
- [x] No DB writes until save
- [x] Page reload restores draft
- [x] Save creates Place + attaches media

## ❌ If Upload Fails

1. Check browser console for error message
2. Check terminal 24 for server logs
3. Look for detailed error with stack trace
4. Verify TempMedia table in Prisma Studio (http://localhost:5555)

## 📚 Full Testing Guide

See `PLACE_WIZARD_TESTING_INSTRUCTIONS.md` for complete checklist including:
- Gallery upload
- Discard flow
- Submit for moderation
- Database verification

## 🎯 Key Achievement

**Before:** Every keystroke could create DB records
**After:** Zero DB writes until explicit save

This is a major UX and performance improvement!
