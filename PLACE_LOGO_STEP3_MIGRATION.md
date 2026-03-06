# Place Logo Upload - Migration to Step 3

## Status: ✅ COMPLETE

## Summary
Успешно перенесли загрузку логотипа из шага 1 "Профиль места" в шаг 3 "Фотографии" с полной интеграцией API и валидацией.

## Changes Made

### 1. Step1Profile.tsx - Удалено поле логотипа
**File**: `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx`

**Removed**:
- Импорт `LogoUpload` компонента
- State `logoFile`
- Функция `handleLogoSelect`
- Секция UI "Логотип *" с drag&drop зоной

**Result**: Шаг 1 теперь содержит только основную информацию (название, категория, описание, теги).

### 2. Step3Photos.tsx - Добавлена загрузка логотипа
**File**: `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`

**Added**:
- Импорт `PlaceLogoUpload` компонента
- State `hasLogo` для отслеживания наличия логотипа
- Функция `handleLogoUploadComplete` для обработки успешной загрузки
- Валидация `canProceed` - блокирует кнопку "Далее" если нет логотипа
- Полноценный UI с drag&drop зоной вместо заглушки "TODO"
- Сообщение об ошибке если логотип не загружен

**Replaced**:
```tsx
// Before (TODO placeholder)
<p className="text-muted-foreground">Загрузка логотипа (TODO)</p>

// After (Full implementation)
<PlaceLogoUpload
  placeId={place.id}
  currentLogoUrl={logoImage?.url}
  onUploadComplete={handleLogoUploadComplete}
/>
```

### 3. PlaceLogoUpload.tsx - Новый компонент
**File**: `src/components/business/place/PlaceLogoUpload.tsx` (CREATED)

**Features**:
- ✅ Drag & drop поддержка
- ✅ Click to upload
- ✅ Валидация типа файла (image/png, image/jpeg, image/webp)
- ✅ Валидация размера (до 5MB)
- ✅ Компрессия изображения через `useImageUpload` hook
- ✅ Загрузка в CDN через `/api/upload`
- ✅ Сохранение в БД через `/api/business/places/[id]/images`
- ✅ Preview загруженного логотипа
- ✅ Кнопка удаления (X)
- ✅ Loading состояние с spinner
- ✅ Toast уведомления (success/error)
- ✅ Hover эффекты
- ✅ Drag over визуальная индикация

**API Integration**:
```typescript
// 1. Upload to CDN
const uploadedImage = await uploadImage(file);

// 2. Save to Place
POST /api/business/places/${placeId}/images
Body: {
  url: string,
  width: number,
  height: number,
  blurhash: string,
  kind: "LOGO",
  sortOrder: 0
}

// 3. Update place.logoImageId automatically (handled by API)
```

### 4. LogoUpload.tsx - Удален
**File**: `src/components/business/LogoUpload.tsx` (DELETED)

**Reason**: Старый компонент больше не используется. Заменен на `PlaceLogoUpload.tsx` с полной интеграцией API.

## Validation Logic

### Step 1 (Profile)
- ❌ Логотип НЕ проверяется
- ✅ Можно перейти на шаг 2 без логотипа
- Required fields: `title`, `category`, `shortDesc`

### Step 3 (Photos)
- ✅ Логотип ОБЯЗАТЕЛЕН
- ❌ Кнопка "Далее" disabled если нет логотипа
- ✅ Показывается сообщение "Загрузите логотип для продолжения"
- ✅ Если логотип уже загружен (из БД), показывается preview

## User Flow

### Scenario 1: New Place (No Logo)
1. User fills Step 1 (Profile) → Click "Далее"
2. User fills Step 2 (Location) → Click "Далее"
3. User arrives at Step 3 (Photos)
4. Sees empty logo upload zone with hint
5. Uploads logo (drag or click)
6. Sees loading spinner
7. Sees preview after upload
8. Button "Далее" becomes enabled
9. Can proceed to Step 4

### Scenario 2: Existing Place (Has Logo)
1. User opens place for editing
2. Navigates to Step 3
3. Sees existing logo preview
4. Can replace logo by clicking or dragging
5. Can remove logo with X button
6. Button "Далее" is enabled (logo exists)

### Scenario 3: Upload Error
1. User tries to upload invalid file
2. Sees toast error: "Пожалуйста, выберите изображение"
3. Or: "Размер файла не должен превышать 5MB"
4. Upload zone returns to empty state
5. User can retry

## Technical Details

### Image Processing
- Max size: 5MB (original file)
- Compression: via `useImageUpload` hook
- Max dimensions: 1024x1024
- Quality: 0.9
- Formats: PNG, JPEG, WebP
- Blurhash: Generated automatically

### API Endpoints Used
- `POST /api/upload` - Upload to CDN
- `POST /api/business/places/[id]/images` - Save image metadata
- Automatic update of `place.logoImageId` by API

### State Management
- Local state in Step3Photos: `hasLogo`
- Optimistic update via `onUpdate({ logoImageId })`
- Preview state in PlaceLogoUpload component
- No global state needed

### Error Handling
- File type validation (client-side)
- File size validation (client-side)
- Upload errors (network, server)
- Toast notifications for all errors
- Graceful fallback to empty state

## UI/UX Improvements

### Visual Design
- Consistent with existing drag&drop zones
- Pulsing border on drag over
- Smooth transitions
- Loading spinner during upload
- Preview with remove button
- Hover effects

### Accessibility
- Click to upload (keyboard accessible)
- Clear error messages
- Visual feedback for all states
- ARIA labels (implicit via semantic HTML)

### Mobile Support
- Touch-friendly click area
- Responsive layout
- Works on iOS/Android

## Testing Checklist

- [x] Step 1 has no logo field
- [x] Step 3 has logo upload zone
- [x] Drag & drop works
- [x] Click to upload works
- [x] File type validation works
- [x] File size validation works
- [x] Upload to CDN works
- [x] Save to DB works
- [x] Preview shows after upload
- [x] Remove button works
- [x] Loading state shows
- [x] Toast notifications work
- [x] Button "Далее" disabled without logo
- [x] Button "Далее" enabled with logo
- [x] Existing logo shows on edit
- [x] Can replace existing logo
- [x] No TypeScript errors
- [x] No console errors

## Files Changed

### Modified
1. `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx`
   - Removed logo upload section
   - Removed LogoUpload import
   - Removed logoFile state
   - Removed handleLogoSelect function

2. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
   - Added PlaceLogoUpload component
   - Added hasLogo state
   - Added handleLogoUploadComplete function
   - Added validation logic (canProceed)
   - Added error message for missing logo
   - Replaced TODO placeholder with real implementation

### Created
3. `src/components/business/place/PlaceLogoUpload.tsx`
   - New component with full API integration
   - Drag & drop support
   - Image compression
   - CDN upload
   - Database save
   - Preview & remove
   - Loading states
   - Error handling

### Deleted
4. `src/components/business/LogoUpload.tsx`
   - Old component (no longer used)

## Dependencies

### Existing (Reused)
- `@/hooks/useImageUpload` - Image compression & upload
- `@/lib/image/compression` - Image processing
- `sonner` - Toast notifications
- `lucide-react` - Icons

### API Endpoints (Existing)
- `POST /api/upload` - CDN upload
- `POST /api/business/places/[id]/images` - Save image metadata

## Notes

- Logo is now required ONLY on Step 3 (not Step 1)
- Validation moved from Step 1 to Step 3
- Single source of truth: `place.logoImageId`
- No duplicate fields in form schema
- Reuses existing image upload infrastructure
- Consistent with Activity image upload UX
- Gallery upload (TODO) remains unchanged

## Next Steps (Optional)

1. Implement gallery upload in Step 3
2. Add image cropping/editing
3. Add multiple logo variants (light/dark)
4. Add logo guidelines/recommendations
5. Add bulk image upload for gallery
