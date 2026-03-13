# Admin Media Archive Feature - Complete

## Overview
Successfully implemented a complete archive feature for the admin Media Library that allows admins to hide images from the normal view without deleting files or breaking relations.

## Implementation Summary

### 1. Database Status Field
- Uses existing `status` field in `MediaAsset` model
- Possible values: `ACTIVE`, `ARCHIVED`, `DELETED`, `BLOCKED`
- Default: `ACTIVE`

### 2. Archive/Restore Actions
**Component**: `src/components/admin/media/MediaActions.tsx`
- Archive button (for ACTIVE files)
- Restore button (for ARCHIVED files)
- Confirmation dialogs for both actions
- Loading states during operations
- Error handling with user feedback

### 3. API Endpoints
**Archive**: `POST /api/admin/media/[id]/archive`
- Updates status to `ARCHIVED`
- Admin-only access
- Returns updated media object

**Restore**: `POST /api/admin/media/[id]/restore`
- Updates status to `ACTIVE`
- Admin-only access
- Returns updated media object

### 4. Status Filter
**Component**: `src/components/admin/media/MediaStatusFilter.tsx`
- Three filter options:
  - **Активные** (Active) - default view, shows only ACTIVE files
  - **Архивные** (Archived) - shows only ARCHIVED files
  - **Все** (All) - shows both ACTIVE and ARCHIVED files
- URL-based state management using search params
- Active filter highlighted in blue

### 5. Default Media Library View
**Page**: `src/app/admin/media/page.tsx`
- Default filter: `active` (shows only ACTIVE files)
- Query parameter: `?status=archived` or `?status=all`
- Filter integrated in page header

### 6. Visual Indicators
**Archived Files Display**:
- "Архивный" badge next to file title
- 60% opacity on entire row (`opacity-60`)
- Visible in both list view and detail page

### 7. Usage Safety
- Archive allowed regardless of usage count
- Delete permanently only allowed if `usageCount === 0`
- Warning message when file is in use
- Existing content using archived images continues to work

### 8. UI Consistency
Follows ui-lab-admin patterns:
- Border-based cards
- Consistent spacing (gap-3, p-6 md:p-4)
- Standard button styles
- Responsive design

## Files Modified

### Components
- `src/components/admin/media/MediaActions.tsx` - Archive/restore/delete actions
- `src/components/admin/media/MediaStatusFilter.tsx` - Filter component

### Pages
- `src/app/admin/media/page.tsx` - Media list with filter
- `src/app/admin/media/[id]/page.tsx` - Detail page with actions

### API Routes
- `src/app/api/admin/media/[id]/archive/route.ts` - Archive endpoint
- `src/app/api/admin/media/[id]/restore/route.ts` - Restore endpoint

### Services
- `src/server/services/media/media-query.service.ts` - Updated to support status array

## User Flow

### Archive Flow
1. Admin views media file detail page
2. Clicks "Архивировать" button
3. Confirms action in dialog
4. File status → ARCHIVED
5. File disappears from default media library view
6. File visible when "Архивные" filter selected

### Restore Flow
1. Admin selects "Архивные" filter
2. Views archived file
3. Clicks "Восстановить" button
4. File status → ACTIVE
5. File appears in default media library view

### Delete Flow
1. Only available if `usageCount === 0`
2. Requires confirmation
3. Permanently deletes file from storage and database
4. Redirects to media list

## Testing Checklist
- ✅ Archive active file
- ✅ Restore archived file
- ✅ Filter by active/archived/all
- ✅ Visual indicators (badge, opacity)
- ✅ Delete blocked when file in use
- ✅ Delete allowed when unused
- ✅ Existing content continues to work with archived files
- ✅ Mobile responsive layout
- ✅ Error handling and user feedback

## Notes
- Archive does NOT delete files from storage
- Archive does NOT break existing relations
- Archived files remain fully functional in content
- Only unused files can be permanently deleted
- All text in Russian as per project requirements
