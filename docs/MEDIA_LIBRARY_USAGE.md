# Media Library Usage Guide

## Quick Start

### 1. Access Media Library
Navigate to: `https://admin.mamago.by/media`

### 2. View Media Stats
Dashboard shows:
- Total files
- Active files
- Orphaned (unused) files
- Archived files
- Deleted files
- Blocked files

### 3. Browse Media
Table displays:
- Preview thumbnail
- Filename and original name
- Type (Image/Video/Document)
- File size and dimensions
- Usage count
- Uploader and upload date
- Status
- Actions

### 4. View Media Details
Click "Детали" to see:
- Large preview
- Complete file information
- Metadata (alt, title, caption)
- Usage map (where file is used)
- System information
- Management actions

### 5. Manage Media

#### Archive
- Moves file to archived state
- File remains accessible but marked as archived

#### Delete
- Soft delete (file not physically removed)
- **Blocked if file has active usages**
- Shows warning with usage count

#### Restore
- Restores archived or deleted files
- Automatically recalculates status (ACTIVE if used, ORPHANED if not)

#### Recalculate Usage
- Recalculates orphaned status for single file
- Updates status based on current usages

#### Recalculate All Orphans
- Bulk operation for all files
- Updates orphaned status across entire library

## For Developers

### Register Media on Upload

```typescript
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import { MediaSourceType } from "@prisma/client";

const media = await registerUploadedMedia({
  filename: "photo.jpg",
  originalName: "my-photo.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 123456,
  width: 1920,
  height: 1080,
  storageKey: "/uploads/photo.jpg",
  publicUrl: "/uploads/photo.jpg",
  sourceType: MediaSourceType.BUSINESS_UPLOAD,
  uploadedById: user.id,
});
```

### Track Media Usage

```typescript
import { attachMediaToEntity } from "@/lib/media/mediaRegistry";
import { MediaEntityType } from "@prisma/client";

await attachMediaToEntity({
  mediaId: media.id,
  entityType: MediaEntityType.PLACE,
  entityId: placeId,
  field: "cover",
});
```

### Remove Media Usage

```typescript
import { detachMediaFromEntity } from "@/lib/media/mediaRegistry";
import { MediaEntityType } from "@prisma/client";

await detachMediaFromEntity(
  mediaId,
  MediaEntityType.PLACE,
  placeId,
  "cover"
);
```

### Replace Media

```typescript
import { replaceEntityMedia } from "@/lib/media/mediaRegistry";
import { MediaSourceType, MediaEntityType } from "@prisma/client";

await replaceEntityMedia(
  oldMediaStorageKey,
  {
    filename: "new-photo.jpg",
    originalName: "new-photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 234567,
    storageKey: "/uploads/new-photo.jpg",
    publicUrl: "/uploads/new-photo.jpg",
    sourceType: MediaSourceType.BUSINESS_UPLOAD,
    uploadedById: user.id,
  },
  MediaEntityType.PLACE,
  placeId,
  "cover"
);
```

## API Reference

### List Media
```
GET /api/admin/media?kind=IMAGE&status=ACTIVE&page=1&limit=50
```

Query params:
- `kind`: IMAGE | VIDEO | DOCUMENT
- `status`: ACTIVE | ORPHANED | ARCHIVED | DELETED | BLOCKED
- `sourceType`: ADMIN_UPLOAD | BUSINESS_UPLOAD | USER_UPLOAD | SYSTEM_GENERATED | MIGRATED
- `uploadedById`: User ID
- `isOrphaned`: true | false
- `search`: Search query
- `dateFrom`: ISO date
- `dateTo`: ISO date
- `page`: Page number
- `limit`: Items per page
- `sortField`: createdAt | updatedAt | filename | sizeBytes
- `sortOrder`: asc | desc
- `includeStats`: true | false

### Get Media Details
```
GET /api/admin/media/[id]
```

### Update Metadata
```
PATCH /api/admin/media/[id]
Body: { alt?, title?, caption? }
```

### Get Usages
```
GET /api/admin/media/[id]/usages
```

### Archive
```
POST /api/admin/media/[id]/archive
```

### Delete
```
POST /api/admin/media/[id]/delete
Body: { force?: boolean }
```

### Restore
```
POST /api/admin/media/[id]/restore
```

### Recalculate Usage
```
POST /api/admin/media/[id]/recalculate-usage
```

### Recalculate All Orphans
```
POST /api/admin/media/recalculate-orphans
```

## Maintenance

### Run Backfill
After adding new media sources:
```bash
npx tsx scripts/backfill-media-library.ts
```

### Test Media Library
```bash
npx tsx scripts/manual-tests/test-media-library.ts
```

### Recalculate Orphaned Status
From admin UI or via API:
```bash
curl -X POST https://admin.mamago.by/api/admin/media/recalculate-orphans
```

## Security

- All admin endpoints require `user.role === "ADMIN"`
- Soft delete prevents data loss
- Usage protection prevents breaking references
- Graceful degradation if media registration fails
- No direct file deletion (only status change)

## Performance

- Indexed fields: kind, status, sourceType, createdAt, uploadedById, checksum
- Pagination support
- Efficient queries with proper includes
- Batch operations ready for future implementation
