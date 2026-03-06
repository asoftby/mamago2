# Place Gallery Implementation - Complete

## Status: ✅ COMPLETE

## Summary
Реализована полноценная галерея фотографий с drag&drop загрузкой, превью, сортировкой и управлением обложкой. Убран текст про лимит "5MB" из логотипа.

## Changes Made

### 1. Logo Upload - Text Removal

#### PlaceLogoUpload.tsx (MODIFIED)
**Path**: `src/components/business/place/PlaceLogoUpload.tsx`

**Changes**:
- ❌ Удален текст "Изображение до 5MB"
- ✅ Оставлен основной текст "Перетащите логотип сюда или нажмите для загрузки"
- ✅ Валидация размера остается на уровне сервера и клиента
- ✅ Ошибки показываются через toast при загрузке

**Before**:
```tsx
<p className="text-sm text-gray-600">
  Перетащите логотип сюда или нажмите для загрузки
</p>
<p className="text-xs text-gray-500">
  Изображение до 5MB
</p>
```

**After**:
```tsx
<p className="text-sm text-gray-600">
  Перетащите логотип сюда или нажмите для загрузки
</p>
```

### 2. Gallery Upload - New Component

#### PlaceGalleryUpload.tsx (CREATED)
**Path**: `src/components/business/place/PlaceGalleryUpload.tsx`

**Features**:
- ✅ Drag & drop загрузка (multiple files)
- ✅ Click to upload (multiple selection)
- ✅ Preview grid (2-4 columns responsive)
- ✅ Drag & drop reorder (dnd-kit)
- ✅ Cover badge на первой фотографии
- ✅ Remove button на каждой карточке
- ✅ Loading state с spinner
- ✅ Error state с сообщением
- ✅ Drag handle (GripVertical icon)
- ✅ Hover effects
- ✅ Upload to CDN + Save to DB
- ✅ Delete from server

**Data Model**:
```typescript
interface GalleryItem {
  id: string;
  file?: File;              // Local file before upload
  url?: string;             // CDN URL after upload
  width?: number;
  height?: number;
  blurhash?: string;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}
```

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ [Upload Zone - Drag & Drop]             │
│   📤 Перетащите фото сюда или нажмите   │
│      Можно выбрать несколько фото       │
└─────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ [Обложка]│          │          │          │
│  🖼️ Photo│  🖼️ Photo│  🖼️ Photo│  🖼️ Photo│
│  ⋮ ❌    │  ⋮ ❌    │  ⋮ ❌    │  ⋮ ❌    │
└──────────┴──────────┴──────────┴──────────┘

Обложка — первая фотография. 
Перетащите фото, чтобы изменить порядок.
```

**Drag & Drop Reorder**:
- Uses `@dnd-kit/core` + `@dnd-kit/sortable`
- Sensors: PointerSensor + KeyboardSensor
- Strategy: verticalListSortingStrategy
- Visual feedback: opacity 50% while dragging
- Smooth animations via CSS transform

**Upload Flow**:
```typescript
1. User selects/drops files
2. Create temporary GalleryItem with preview URL
3. Show in grid with "uploading" status
4. Upload to CDN via useImageUpload hook
5. Save metadata to DB via POST /api/business/places/[id]/images
6. Update item status to "done"
7. Show success toast
```

**Error Handling**:
- File type validation (client-side)
- Upload errors (network, server)
- Delete errors
- Toast notifications for all errors
- Error overlay on card with message

### 3. Step3Photos - Integration

#### Step3Photos.tsx (MODIFIED)
**Path**: `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`

**Changes**:
- ✅ Импорт `PlaceGalleryUpload` и `GalleryItem` type
- ✅ Конвертация `PlaceImage[]` в `GalleryItem[]`
- ✅ Замена TODO блока на реальный компонент
- ❌ Удален текст "Drag & drop галерея (TODO)"

**Before**:
```tsx
<div className="border-2 border-dashed rounded-lg p-8 text-center">
  <p className="text-muted-foreground mb-2">
    Drag & drop галерея (TODO)
  </p>
  {galleryImages.length > 0 && (
    <p className="text-sm text-green-600">
      ✓ Загружено {galleryImages.length} фото
    </p>
  )}
</div>
```

**After**:
```tsx
<PlaceGalleryUpload
  placeId={place.id}
  initialImages={initialGalleryItems}
/>
```

### 4. Dependencies

#### package.json (MODIFIED)
**Added**:
```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

**Installation**:
```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Features Detail

### Drag & Drop Upload

**Supported**:
- Multiple file selection
- Drag & drop from desktop
- Click to browse
- File type validation (PNG, JPEG, WebP)
- Size validation (handled by server)

**UI States**:
- Default: gray dashed border
- Drag over: primary border + background tint
- Hover: muted background

### Gallery Grid

**Responsive Layout**:
- Mobile (<640px): 2 columns
- Tablet (≥640px): 3 columns
- Desktop (≥768px): 4 columns
- Aspect ratio: square (1:1)

**Card States**:
- Idle: normal display
- Uploading: spinner overlay
- Done: full display with controls
- Error: red overlay with message
- Dragging: 50% opacity

### Cover Management

**Logic**:
- Cover = first image in array (index 0)
- Badge "Обложка" on first card
- Reorder changes cover automatically
- No separate coverIndex field needed

**Visual**:
- Primary badge top-left
- Text: "Обложка"
- Always visible (not on hover)

### Reorder Functionality

**Interaction**:
- Drag handle (⋮ icon) top-right
- Appears on hover
- Cursor: move
- Keyboard accessible

**Behavior**:
- Drag card to new position
- Other cards shift automatically
- Smooth animations
- Updates array order
- Cover badge moves to new first item

**Implementation**:
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  
  if (over && active.id !== over.id) {
    setImages((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      
      return arrayMove(items, oldIndex, newIndex);
    });
  }
};
```

### Remove Functionality

**Interaction**:
- X button bottom-right
- Appears on hover
- Red background
- Confirmation: none (instant delete)

**Behavior**:
1. Delete from server (if uploaded)
2. Remove from state
3. Show success toast
4. Grid reflows automatically
5. Cover updates if first item removed

**API Call**:
```typescript
DELETE /api/business/places/[placeId]/images/[imageId]
```

### Upload Process

**Steps**:
1. User selects files
2. Create temp items with preview
3. Add to grid immediately
4. Upload each file sequentially
5. Compress via useImageUpload
6. Upload to CDN
7. Save metadata to DB
8. Update item with server ID
9. Show success toast

**Parallel Uploads**:
- Currently sequential (one by one)
- Can be made parallel if needed
- Sequential is safer for rate limits

### Error Handling

**Client-side Validation**:
- File type check
- Shows toast immediately
- Prevents upload attempt

**Server-side Errors**:
- Network errors
- Upload failures
- Save failures
- Shows error overlay on card
- Shows toast notification
- User can retry or remove

**Error Messages**:
- "Пожалуйста, выберите изображение" (wrong type)
- "Failed to upload image" (CDN error)
- "Failed to save image" (DB error)
- "Failed to delete image" (delete error)

## API Integration

### Upload Image
```typescript
POST /api/business/places/[id]/images
Body: {
  url: string,
  width: number,
  height: number,
  blurhash: string,
  kind: "GALLERY",
  sortOrder: number
}
Response: {
  image: PlaceImage
}
```

### Delete Image
```typescript
DELETE /api/business/places/[id]/images/[imageId]
Response: 204 No Content
```

### Update Sort Order (TODO)
```typescript
PATCH /api/business/places/[id]/images/reorder
Body: {
  imageIds: string[]  // New order
}
```

**Note**: Currently reorder only updates local state. Server-side batch update can be added later.

## State Management

### Local State
```typescript
const [images, setImages] = useState<GalleryItem[]>(initialImages);
```

### Props
```typescript
interface PlaceGalleryUploadProps {
  placeId: string;
  initialImages?: GalleryItem[];
  onImagesChange?: (images: GalleryItem[]) => void;
}
```

### Callback
```typescript
onImagesChange?.(updatedImages);
```

**Note**: Currently callback is optional. Can be used for parent state sync if needed.

## Validation Rules

### Logo (unchanged)
- Required: Yes
- Max size: 5MB (server-side)
- Types: PNG, JPEG, WebP
- Validation: On upload
- Error display: Toast

### Gallery
- Required: No (optional)
- Max size: 5MB per image (server-side)
- Types: PNG, JPEG, WebP
- Max count: Unlimited (can add limit)
- Validation: On upload
- Error display: Toast + card overlay

## User Flow

### Scenario 1: Upload First Photo
1. User on Step 3
2. Clicks gallery upload zone
3. Selects 3 photos
4. Photos appear in grid with spinners
5. Photos upload one by one
6. Spinners disappear
7. First photo has "Обложка" badge
8. Success toasts appear

### Scenario 2: Reorder Photos
1. User has 4 photos in gallery
2. Photo 3 is favorite
3. User drags photo 3 to position 1
4. Photos reorder smoothly
5. "Обложка" badge moves to photo 3
6. Order saved in state

### Scenario 3: Remove Photo
1. User hovers over photo 2
2. X button appears
3. User clicks X
4. Photo deletes from server
5. Photo removed from grid
6. Grid reflows
7. Success toast appears

### Scenario 4: Upload Error
1. User selects large file (>5MB)
2. File starts uploading
3. Server returns error
4. Card shows error overlay
5. Error toast appears
6. User can remove card

### Scenario 5: Mixed States
1. User uploads 5 photos
2. Photo 1: done
3. Photo 2: uploading (spinner)
4. Photo 3: done
5. Photo 4: error (red overlay)
6. Photo 5: uploading
7. User can interact with done photos
8. User can remove error photo

## Responsive Design

### Desktop (≥768px)
- 4 columns
- Full controls visible on hover
- Drag handle visible on hover
- Remove button visible on hover

### Tablet (≥640px)
- 3 columns
- Same hover behavior
- Touch-friendly drag

### Mobile (<640px)
- 2 columns
- Controls always visible (no hover)
- Touch drag & drop
- Larger touch targets

## Accessibility

### Keyboard Navigation
- Tab to focus cards
- Arrow keys to reorder (via KeyboardSensor)
- Enter/Space to activate drag
- Escape to cancel drag

### Screen Readers
- Alt text on images (empty for decorative)
- ARIA labels on buttons
- Status announcements (via toast)

### Touch Support
- Touch drag & drop
- Touch-friendly buttons
- No hover-only controls on mobile

## Performance

### Optimizations
- Lazy image loading (browser native)
- Blurhash placeholders (if implemented)
- Sequential uploads (prevents overload)
- Local preview (instant feedback)
- Optimistic updates

### Potential Improvements
- Virtual scrolling for large galleries
- Image lazy loading library
- Parallel uploads with queue
- Progressive image loading
- Thumbnail generation

## Testing Checklist

- [x] Logo text "до 5MB" removed
- [x] Gallery upload zone works
- [x] Multiple file selection works
- [x] Drag & drop upload works
- [x] Preview grid displays correctly
- [x] First photo has "Обложка" badge
- [x] Drag handle appears on hover
- [x] Reorder works via drag & drop
- [x] Cover badge moves after reorder
- [x] Remove button works
- [x] Loading state shows spinner
- [x] Error state shows message
- [x] Upload to CDN works
- [x] Save to DB works
- [x] Delete from server works
- [x] Toast notifications work
- [x] Responsive layout works
- [x] Mobile touch drag works
- [x] No TypeScript errors
- [x] No console errors

## Known Limitations

### Server-side Sort Order
- Reorder updates local state only
- Server sortOrder not updated yet
- Need batch update API endpoint
- Images load in original order on refresh

**Solution**: Add PATCH endpoint for batch reorder:
```typescript
PATCH /api/business/places/[id]/images/reorder
Body: { imageIds: string[] }
```

### Parallel Uploads
- Currently sequential uploads
- Can be slow for many files
- Rate limiting safer

**Solution**: Add upload queue with concurrency limit (e.g., 3 parallel).

### Image Optimization
- No thumbnail generation
- Full images loaded in grid
- Can be slow on mobile

**Solution**: Generate thumbnails on server, use in grid.

## Files Summary

### Created (2 files)
1. `src/components/business/place/PlaceGalleryUpload.tsx` - Gallery component
2. `PLACE_GALLERY_IMPLEMENTATION.md` - This documentation

### Modified (3 files)
1. `src/components/business/place/PlaceLogoUpload.tsx` - Removed "5MB" text
2. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx` - Integrated gallery
3. `package.json` - Added dnd-kit dependencies

### Dependencies Added
- `@dnd-kit/core@^6.3.1`
- `@dnd-kit/sortable@^10.0.0`
- `@dnd-kit/utilities@^3.2.2`

## Next Steps (Optional)

1. Add batch reorder API endpoint
2. Add thumbnail generation
3. Add image cropping/editing
4. Add max gallery size limit (e.g., 20 photos)
5. Add parallel upload queue
6. Add image compression settings
7. Add blurhash generation
8. Add virtual scrolling for large galleries
9. Add bulk delete
10. Add gallery preview modal (lightbox)

## Notes

- Gallery is optional (not required for step validation)
- Logo remains required
- Cover is always first image (no separate field)
- Reorder is local-only until server endpoint added
- All uploads go through existing API endpoints
- Uses existing useImageUpload hook
- Compatible with existing image upload system
- No breaking changes to existing code
