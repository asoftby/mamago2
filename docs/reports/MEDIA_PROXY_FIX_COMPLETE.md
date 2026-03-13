# Media Proxy Fix Complete

## Problem
Files saved with `.blob` extension caused browsers to download instead of display when clicking "Открыть в новой вкладке" in the media library detail page.

## Root Cause
Physical files have `.blob` extension, but browsers use file extension to determine how to handle files. Even though metadata in database was correct (extension: "webp", mimeType: "image/webp"), the browser saw `.blob` and triggered download.

## Solution
Implemented media proxy route at `/api/media/[filename]` that:
1. Looks up media asset by filename in database
2. Reads the physical file from disk
3. Serves it with correct `Content-Type` header from database metadata
4. Adds cache headers for performance

## Changes Made

### 1. Media Proxy Route (Already Complete)
- `src/app/api/media/[filename]/route.ts`
- Serves files with correct Content-Type headers
- Handles cache control and content length
- Returns 404 if file not found

### 2. Updated Detail Page
- `src/app/admin/media/[id]/page.tsx`
- Changed "Открыть в новой вкладке" link from `media.publicUrl` to `/api/media/${media.filename}`
- Changed "Public URL" field link to use proxy route

### 3. Updated MediaPreview Component
- `src/components/admin/media/MediaPreview.tsx`
- Changed image src from `publicUrl` to `/api/media/${filename}`
- Removed dependency on publicUrl for IMAGE kind

## Testing

### Test Script
Created `scripts/test-media-proxy.ts` to demonstrate the fix.

### Verification
```bash
# Direct URL (downloads)
curl -I http://localhost:3000/uploads/1773167003936-gjc7nhipxyj.blob
# → No Content-Type header, browser downloads

# Proxy URL (displays)
curl -I http://localhost:3000/api/media/1773167003936-gjc7nhipxyj.blob
# → Content-Type: image/webp, browser displays
```

## Result
✅ Clicking "Открыть в новой вкладке" now displays images in browser instead of downloading
✅ MediaPreview components show images correctly
✅ No changes needed to physical files or database
✅ Backward compatible - works with both old (.blob) and new files

## Performance
- Proxy route includes cache headers: `public, max-age=31536000, immutable`
- Browser will cache responses for 1 year
- Minimal overhead after first request

## Future Improvements (Optional)
If desired, could rename physical files from `.blob` to correct extension:
- Would eliminate need for proxy route
- But current solution works perfectly and is simpler
- Physical file extension is implementation detail, not user-facing
