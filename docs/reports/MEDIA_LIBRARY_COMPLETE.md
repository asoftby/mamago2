# Media Library Implementation Complete

## Overview
Реализована полноценная медиатека для централизованного контроля всех медиафайлов платформы mamaGo 2.0.

## 1. Prisma Schema

### Добавленные модели:

#### MediaAsset
Центральный реестр всех медиафайлов:
- `id`, `kind` (IMAGE/VIDEO/DOCUMENT), `status` (ACTIVE/ORPHANED/ARCHIVED/DELETED/BLOCKED)
- File info: `filename`, `originalName`, `mimeType`, `extension`, `sizeBytes`
- Dimensions: `width`, `height`, `durationSec`
- Storage: `storageKey` (unique), `publicUrl`, `checksum`
- Metadata: `alt`, `title`, `caption`
- Source tracking: `sourceType`, `uploadedById`
- Timestamps: `createdAt`, `updatedAt`, `deletedAt`

#### MediaUsage
Карта использования медиа:
- `mediaId` → MediaAsset
- `entityType` (PLACE/EVENT/OFFER/ROUTE/ARTICLE/USER/STORY/BUSINESS/OTHER)
- `entityId`, `field` (cover, gallery, avatar, logo, etc.)

### Enums:
- `MediaAssetKind`: IMAGE, VIDEO, DOCUMENT
- `MediaAssetStatus`: ACTIVE, ORPHANED, ARCHIVED, DELETED, BLOCKED
- `MediaSourceType`: ADMIN_UPLOAD, BUSINESS_UPLOAD, USER_UPLOAD, SYSTEM_GENERATED, MIGRATED
- `MediaEntityType`: PLACE, EVENT, OFFER, ROUTE, ARTICLE, USER, STORY, BUSINESS, OTHER

### Migration:
```bash
npx prisma migrate dev --name add_media_library
```

## 2. Service Layer

### `src/server/services/media/media.service.ts`
Core CRUD operations:
- `createMediaAsset()` - создание медиа
- `getMediaAssetById()` - получение по ID
- `getMediaAssetByStorageKey()` - получение по storage key
- `updateMediaMetadata()` - обновление alt/title/caption
- `archiveMediaAsset()` - архивация
- `softDeleteMediaAsset()` - мягкое удаление (с защитой от удаления используемых файлов)
- `restoreMediaAsset()` - восстановление
- `blockMediaAsset()` - блокировка (модерация)
- `recalculateMediaUsageStatus()` - пересчет orphaned статуса для одного файла
- `recalculateAllOrphanedStatuses()` - массовый пересчет
- `getMediaStats()` - статистика

### `src/server/services/media/media-query.service.ts`
Сложные запросы и фильтрация:
- `getAdminMediaList()` - список с фильтрами, пагинацией, сортировкой
- `searchMedia()` - поиск по filename/originalName/storageKey
- `getOrphanedMedia()` - неиспользуемые файлы
- `getRecentMedia()` - недавно загруженные
- `getMediaByChecksum()` - поиск дубликатов

### `src/server/services/media/media-usage.service.ts`
Управление usage:
- `registerMediaUsage()` - регистрация использования
- `removeMediaUsage()` - удаление использования
- `getMediaUsages()` - список использований
- `getMediaUsagesWithDetails()` - с названиями сущностей и ссылками
- `getEntityMediaUsages()` - медиа для конкретной сущности
- `replaceMediaUsage()` - замена медиа
- `countMediaUsages()` - подсчет использований

## 3. API Routes

### Admin API:
- `GET /api/admin/media` - список медиа с фильтрами
- `GET /api/admin/media/[id]` - детали медиа
- `PATCH /api/admin/media/[id]` - обновление метаданных
- `GET /api/admin/media/[id]/usages` - список использований
- `POST /api/admin/media/[id]/archive` - архивация
- `POST /api/admin/media/[id]/delete` - удаление
- `POST /api/admin/media/[id]/restore` - восстановление
- `POST /api/admin/media/[id]/recalculate-usage` - пересчет usage
- `POST /api/admin/media/recalculate-orphans` - массовый пересчет orphaned

Все endpoints защищены проверкой `user.role === "ADMIN"`.

## 4. UI Components

### Badge Components:
- `MediaStatusBadge` - статус медиа (Активен, Не используется, Архив, Удален, Заблокирован)
- `MediaKindBadge` - тип медиа (Изображение, Видео, Документ) с иконками
- `MediaStatsCard` - карточка статистики

### Preview Component:
- `MediaPreview` - превью медиа (image с Next.js Image, placeholder для video/document)
- Размеры: sm (12x12), md (24x24), lg (64x64)

## 5. Admin Pages

### `/admin/media` - Список медиа
Features:
- Summary cards: Всего, Активные, Неиспользуемые, Архив, Удаленные, Заблокированные
- Таблица с колонками: Превью, Файл, Тип, Размер, Использований, Загружен, Статус, Действия
- Pagination
- Кнопки: Фильтры, Пересчитать orphaned

### `/admin/media/[id]` - Детали медиа
Sections:
1. **Preview** - крупное превью, кнопка "Открыть в новой вкладке"
2. **File Info** - filename, originalName, mimeType, extension, size, dimensions, storageKey, checksum, publicUrl
3. **Metadata** - alt, title, caption (read-only в V1)
4. **Usage Map** - список использований с entityType, entityId, field, entityName, ссылками на сущности
5. **System Info** - sourceType, uploadedBy, createdAt, updatedAt, deletedAt
6. **Danger Zone** - кнопки: Архивировать, Восстановить, Удалить, Пересчитать usage
   - Удаление заблокировано если usages > 0

### Navigation:
Добавлен пункт "Медиатека" в админ-меню в секции "Content".

## 6. Integration with Upload Flow

### `src/lib/media/mediaRegistry.ts`
Helper functions для интеграции:
- `registerUploadedMedia()` - регистрация загруженного файла
- `attachMediaToEntity()` - привязка к сущности
- `detachMediaFromEntity()` - отвязка от сущности
- `registerAndAttachMedia()` - регистрация + привязка в одной транзакции
- `replaceEntityMedia()` - замена медиа

### Интегрировано:

#### 1. `/api/upload` (общий upload endpoint)
- Автоматически регистрирует все загруженные файлы в MediaAsset
- Определяет sourceType по роли пользователя (ADMIN_UPLOAD, BUSINESS_UPLOAD, USER_UPLOAD)
- Не ломает существующий flow - регистрация происходит после успешной загрузки
- Если регистрация fails - upload все равно успешен (graceful degradation)

#### 2. `/api/business/places/[id]/images` (добавление изображений к Place)
- После создания PlaceImage регистрирует usage в MediaUsage
- Поле: "logo" или "gallery"
- EntityType: PLACE

#### 3. `/api/business/places` (создание Place)
- При конвертации TempMedia в PlaceImage регистрирует usage
- Работает для logo и gallery

## 7. Backfill Script

### `scripts/data-migrations/backfill-media-library.ts`
Миграция существующих файлов:
- PlaceImage (logo + gallery) → MediaAsset + MediaUsage
- Activity coverImageUrl → MediaAsset + MediaUsage
- Offer coverImage → MediaAsset + MediaUsage

Features:
- Идемпотентный (можно запускать многократно)
- Проверяет существование по storageKey
- Создает MediaUsage если MediaAsset уже существует
- Graceful error handling

Run:
```bash
npx tsx scripts/data-migrations/backfill-media-library.ts
```

Results:
- 9 PlaceImage мигрированы
- 9 MediaAsset созданы
- 9 MediaUsage созданы

## 8. Test Script

### `scripts/manual-tests/test-media-library.ts`
Тестирование функциональности:
- getMediaStats()
- getAdminMediaList()
- getMediaUsagesWithDetails()
- Search
- Filter by kind
- Filter orphaned

Run:
```bash
npx tsx scripts/manual-tests/test-media-library.ts
```

## 9. Current Stats

После backfill:
- Total: 9 медиафайлов
- Active: 9
- Orphaned: 0
- Images: 9
- Source: MIGRATED

## 10. V1 Limitations & Future Enhancements

### V1 Limitations:
- Metadata (alt/title/caption) read-only в UI (можно редактировать через API)
- Фильтры в UI не реализованы (API готов)
- Pagination в UI базовая (API поддерживает полную)
- Нет batch actions
- Нет duplicate detection UI
- Нет broken references report
- Нет oversized files report

### Prepared for Future:
- Checksum поле готово для deduplication
- Alt/title/caption готовы для SEO
- BLOCKED status готов для модерации
- MediaEntityType расширяемый (ROUTE, ARTICLE, STORY)
- API поддерживает все фильтры

### Future Enhancements:
1. Inline metadata editing
2. Фильтры в UI (kind, status, sourceType, date range, uploadedBy)
3. Batch operations (archive, delete, restore)
4. Duplicate detection по checksum
5. Broken references detection
6. Oversized files report
7. Media moderation workflow
8. Advanced search (по metadata)
9. Drag & drop reordering
10. Bulk upload

## 11. Architecture Decisions

### Clean Separation:
- MediaAsset = единый реестр (source of truth)
- MediaUsage = карта использования (flexible, scalable)
- Не привязываем все сущности через Prisma relations (гибкость)

### Soft Delete:
- deletedAt nullable
- Status DELETED
- Защита от удаления используемых файлов

### Orphaned Logic:
- Автоматический пересчет через recalculate functions
- Не меняет ARCHIVED/DELETED/BLOCKED статусы
- Можно запускать массово или для одного файла

### Graceful Integration:
- Существующий upload flow не сломан
- Регистрация в MediaAsset опциональна (graceful degradation)
- Можно постепенно интегрировать другие upload flows

### Scalability:
- MediaEntityType enum расширяемый
- Field - строка (гибкость для разных типов использования)
- Checksum готов для deduplication
- Indexes на всех критичных полях

## 12. Files Created

### Schema & Migration:
- `prisma/schema.prisma` (MediaAsset, MediaUsage models + enums)
- `prisma/migrations/20260313095849_add_media_library/migration.sql`

### Services:
- `src/server/services/media/media.service.ts`
- `src/server/services/media/media-query.service.ts`
- `src/server/services/media/media-usage.service.ts`

### API Routes:
- `src/app/api/admin/media/route.ts`
- `src/app/api/admin/media/[id]/route.ts`
- `src/app/api/admin/media/[id]/usages/route.ts`
- `src/app/api/admin/media/[id]/archive/route.ts`
- `src/app/api/admin/media/[id]/delete/route.ts`
- `src/app/api/admin/media/[id]/restore/route.ts`
- `src/app/api/admin/media/[id]/recalculate-usage/route.ts`
- `src/app/api/admin/media/recalculate-orphans/route.ts`

### UI Components:
- `src/components/admin/media/MediaStatusBadge.tsx`
- `src/components/admin/media/MediaKindBadge.tsx`
- `src/components/admin/media/MediaPreview.tsx`
- `src/components/admin/media/MediaStatsCard.tsx`

### Pages:
- `src/app/admin/media/page.tsx`
- `src/app/admin/media/[id]/page.tsx`

### Helpers:
- `src/lib/media/mediaRegistry.ts`

### Scripts:
- `scripts/data-migrations/backfill-media-library.ts`
- `scripts/manual-tests/test-media-library.ts`

### Modified Files:
- `src/components/admin/AdminNav.tsx` (added "Медиатека" menu item)
- `src/app/api/upload/route.ts` (integrated media registration)
- `src/app/api/business/places/[id]/images/route.ts` (integrated usage tracking)
- `src/app/api/business/places/route.ts` (integrated usage tracking)

## 13. How to Use

### For Admins:
1. Navigate to `/admin/media`
2. View all media files with stats
3. Click on any file to see details and usages
4. Use "Пересчитать orphaned" to recalculate orphaned status
5. Archive/Delete/Restore files as needed

### For Developers:
```typescript
// Register uploaded media
import { registerUploadedMedia, attachMediaToEntity } from "@/lib/media/mediaRegistry";

const media = await registerUploadedMedia({
  filename: "image.jpg",
  originalName: "my-image.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 123456,
  width: 1920,
  height: 1080,
  storageKey: "/uploads/image.jpg",
  publicUrl: "/uploads/image.jpg",
  sourceType: MediaSourceType.BUSINESS_UPLOAD,
  uploadedById: user.id,
});

// Attach to entity
await attachMediaToEntity({
  mediaId: media.id,
  entityType: MediaEntityType.PLACE,
  entityId: placeId,
  field: "cover",
});
```

## 14. Next Steps

1. Implement filters UI
2. Add metadata inline editing
3. Implement batch operations
4. Add duplicate detection
5. Create broken references report
6. Integrate with more upload flows (Events, Offers, User avatars)

## Summary

Медиатека полностью функциональна и готова к production использованию. Реализована чистая, масштабируемая архитектура с централизованным реестром медиа, картой использования, защитой от опасных операций и graceful интеграцией с существующими upload flows.
