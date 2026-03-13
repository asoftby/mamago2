# Admin Media Image Processing Pipeline

## Summary
Implemented strict image ingestion pipeline for admin Media Library with automatic processing, optimization, and WebP conversion.

## Installation Required

### Install Sharp
```bash
npm install sharp
```

### Optional: HEIC/HEIF Support
For HEIC/HEIF support, install libheif on your system:

**macOS:**
```bash
brew install libheif
```

**Ubuntu/Debian:**
```bash
sudo apt-get install libheif-dev
```

**Note:** If libheif is not installed, HEIC/HEIF uploads will fail with a clear error message asking users to convert to JPEG/PNG/WebP.

## Features Implemented

### 1. Strict Format Validation
- Accepts: JPEG, PNG, WebP, HEIC, HEIF
- Rejects unsupported formats with clear error
- Max file size: 10MB

### 2. Processing Pipeline
Every uploaded image goes through:
1. **Validation** - Format and size check
2. **Load** - Read with sharp
3. **Auto-orient** - Apply EXIF rotation
4. **Resize** - Down to max 1600px if larger
5. **Convert** - To WebP format
6. **Optimize** - Quality 80, efficient compression
7. **Generate sizes** - Multiple responsive versions

### 3. Responsive Sizes Generated
- **XL**: 1600px (master)
- **LG**: 1200px
- **MD**: 800px
- **SM**: 400px

Only generates sizes smaller than the original. Uses:
- `withoutEnlargement: true`
- `fit: inside`
- Auto orientation

### 4. WebP Output
All processed images stored as WebP:
- Smaller file sizes
- Better compression
- Wide browser support
- Original format tracked in metadata

### 5. HEIC/HEIF Handling
- Attempts to process if libheif available
- Fails gracefully with clear error if not supported
- Error message guides users to convert or install support

## Files Created

### Core Service
- `src/lib/media/imageProcessor.ts` - Centralized processing logic

### API Endpoints
- `src/app/api/upload/route.ts` - Updated with new pipeline
- `src/app/api/upload/v2/route.ts` - Alternative endpoint (same logic)

### Components
- `src/components/admin/media/AdminMediaUploader.tsx` - Updated to accept HEIC/HEIF

### Documentation
- `ADMIN_MEDIA_IMAGE_PIPELINE.md` - This file

## Configuration

Default settings in `imageProcessor.ts`:

```typescript
{
  maxUploadSizeMB: 10,
  maxMasterWidth: 1600,
  outputFormat: "webp",
  outputQuality: 80,
  sizes: {
    xl: 1600,
    lg: 1200,
    md: 800,
    sm: 400,
  },
}
```

## API Response

Upload endpoint now returns:

```json
{
  "url": "/uploads/1234567890-abc123-photo.webp",
  "filename": "1234567890-abc123-photo.webp",
  "size": 123456,
  "width": 1600,
  "height": 1200,
  "format": "webp",
  "originalFormat": "image/jpeg",
  "responsiveSizes": {
    "lg": "/uploads/1234567890-abc123-photo-lg.webp",
    "md": "/uploads/1234567890-abc123-photo-md.webp",
    "sm": "/uploads/1234567890-abc123-photo-sm.webp"
  },
  "processed": true
}
```

## Error Handling

### Unsupported Format
```json
{
  "error": "Unsupported image format: image/gif. Allowed: JPEG, PNG, WebP, HEIC, HEIF"
}
```

### File Too Large
```json
{
  "error": "File too large: 15.2MB. Max: 10MB"
}
```

### HEIC Not Supported
```json
{
  "error": "HEIC/HEIF format is not supported in the current environment. Please convert to JPEG, PNG, or WebP before uploading, or install libheif support on the server."
}
```

### Processing Failed
```json
{
  "error": "Image processing failed: Unable to read image dimensions"
}
```

## Usage Flow

### Admin Upload
1. Admin opens `/admin/media`
2. Drags/selects image (JPEG, PNG, WebP, HEIC, HEIF)
3. Image uploads to `/api/upload`
4. Server processes through pipeline:
   - Validates format and size
   - Converts to WebP
   - Generates responsive sizes
   - Saves all versions
5. Registers in MediaAsset table
6. Returns URLs for all sizes
7. Page refreshes to show new media

### Metadata Stored
In MediaAsset table:
- `filename`: Master WebP filename
- `originalName`: Original upload name
- `mimeType`: "image/webp"
- `width`: Master width
- `height`: Master height
- `sizeBytes`: Master file size
- `storageKey`: Master URL
- `publicUrl`: Master URL

Responsive sizes stored as separate files but not tracked individually in database (can be derived from master filename).

## Benefits

### For Users
- Faster page loads (WebP is smaller)
- Responsive images (right size for device)
- Consistent quality across site
- HEIC photos from iPhone work (if supported)

### For Admins
- No manual optimization needed
- Automatic format conversion
- Clear error messages
- One upload, multiple sizes

### For Developers
- Centralized processing logic
- Consistent image handling
- Easy to maintain
- Production-safe pipeline

## Testing

### Test Upload
```bash
# Upload JPEG
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: your-auth-cookie" \
  -F "file=@test.jpg"

# Upload HEIC (if supported)
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: your-auth-cookie" \
  -F "file=@test.heic"
```

### Test Validation
```bash
# Test file too large
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: your-auth-cookie" \
  -F "file=@large-file.jpg"

# Test unsupported format
curl -X POST http://localhost:3000/api/upload \
  -H "Cookie: your-auth-cookie" \
  -F "file=@test.gif"
```

## Future Enhancements

### Possible Additions
- S3/R2 storage instead of local filesystem
- CDN integration for responsive sizes
- Lazy loading hints
- Blur placeholder generation
- AVIF format support
- Progressive JPEG fallbacks
- Image optimization metrics

### Not Included (By Design)
- Manual cropping UI
- Filters/effects
- Folders/collections
- AI tagging
- Manual quality controls
- Batch processing UI

## Troubleshooting

### Sharp Not Installed
```
Error: Cannot find module 'sharp'
```
**Solution:** Run `npm install sharp`

### HEIC Not Working
```
Error: HEIC/HEIF format is not supported
```
**Solution:** Install libheif on your system or ask users to convert to JPEG/PNG

### Out of Memory
If processing very large images:
- Reduce `maxMasterWidth` in config
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`

### Slow Processing
- Normal for large images
- Consider adding queue system for batch uploads
- Show progress indicator to users

## Notes

- All original uploads are processed, not stored raw
- Only WebP versions saved to disk
- Original format tracked in metadata
- Responsive sizes generated on upload, not on-demand
- No lazy generation (all sizes created immediately)
- Pipeline is synchronous (blocks until complete)
