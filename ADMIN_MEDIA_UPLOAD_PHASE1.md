# Admin Media Upload - Phase 1 Complete

## Summary
Added photo upload capability to the admin panel through the existing Media Library at `/admin/media`.

## What Was Done

### 1. Analysis of Existing Structure ✅
- Confirmed existing `/api/upload` endpoint with media registry integration
- Found `ImageUploader` component and `useImageUpload` hook
- Verified `MediaAsset` model with metadata fields (title, alt, caption)
- Confirmed media usage tracking system exists

### 2. Media Upload in /admin/media ✅
Created `AdminMediaUploader` component with:
- Upload button with drag & drop area
- Multiple image upload support
- Upload progress indicator
- Automatic page refresh after upload
- Supports JPEG, PNG, WebP, AVIF up to 10MB
- Integrated into `/admin/media` page

### 3. Automatic Metadata Generation ✅
Enhanced `registerAndAttachMedia` function in `mediaRegistry.ts`:
- Automatically generates title, alt, caption based on usage context
- Only generates if not manually provided
- Uses entity information (place name, address, etc.)

### 4. Display Improvements ✅
Updated media list page:
- Shows title from metadata if available
- Falls back to filename if no title
- Displays filename below title when title exists
- Adds numbering for duplicate titles: "Title (1)", "Title (2)"
- Clickable titles link to detail page
- Applied UI lab admin spacing standards

## Current Features

### Upload Flow
1. Admin opens `/admin/media`
2. Clicks or drags images to upload area
3. Images upload with progress indicator
4. Uploaded images appear in media grid
5. Each image registered in MediaAsset with ADMIN_UPLOAD source

### Metadata
- Title, alt, caption fields supported
- Auto-generation when attached to entities
- Manual editing available on detail page (`/admin/media/[id]`)
- Technical info displayed: filename, mime type, dimensions, dates

### Media List
- Grid view with previews
- Status badges (Active, Orphaned, Archived, etc.)
- Usage count indicator
- Clickable titles for navigation
- Duplicate title numbering

## Next Steps (Not Yet Implemented)

### Media Picker Component
- Reusable component for selecting from library
- Modal/sheet interface
- Search and filter capabilities
- Integration into admin forms

### Admin Form Integration
- Place cover image selection
- Event image selection
- Offer banner selection
- Route cover selection

### Enhanced Safety
- Prevent deletion of media in use (already tracked)
- Show usage locations on detail page
- Bulk operations (archive, delete)

## Technical Details

### Files Modified
- `src/app/admin/media/page.tsx` - Added uploader component
- `src/lib/media/mediaRegistry.ts` - Auto metadata generation
- `src/components/admin/media/AdminMediaUploader.tsx` - New upload component

### Files Created
- `src/components/admin/media/AdminMediaUploader.tsx`
- `ADMIN_MEDIA_UPLOAD_PHASE1.md`

### API Endpoints Used
- `POST /api/upload` - Existing endpoint for file upload
- Automatically registers in MediaAsset table
- Sets sourceType to ADMIN_UPLOAD for admin users

### Database
- Uses existing MediaAsset model
- No schema changes required
- Metadata fields: title, alt, caption
- Usage tracking via MediaUsage table

## Usage Example

```typescript
// Upload is automatic through UI
// For programmatic use:
import { registerAndAttachMedia } from "@/lib/media/mediaRegistry";

const media = await registerAndAttachMedia(
  {
    filename: "photo.jpg",
    originalName: "My Photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 123456,
    storageKey: "/uploads/photo.jpg",
    publicUrl: "/uploads/photo.jpg",
    sourceType: "ADMIN_UPLOAD",
    uploadedById: adminId,
  },
  {
    entityType: "PLACE",
    entityId: placeId,
    field: "gallery",
  }
);
// Metadata auto-generated based on place info
```

## Notes
- Upload uses existing infrastructure
- No new storage system needed
- Integrates with existing media registry
- Follows admin UI patterns from ui-lab-admin
- Mobile responsive
