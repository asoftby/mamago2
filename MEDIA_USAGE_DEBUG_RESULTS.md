# Media Usage Debug Results - ПРОБЛЕМА НАЙДЕНА И ИСПРАВЛЕНА ✅

## 🔍 Проблема

Файл `IMG_1718.webp` показывал "Использование (0)", хотя использовался в событии "Тестовое событие от Британской школы".

---

## 🎯 Результаты Debug (Пошагово)

### Шаг 1: Проверка Prisma Migration ✅

**Команда**: `pnpm prisma migrate status`

**Результат**: Найдена неприменённая миграция `20260510220000_offer_camp_program_and_lodging_details`

**Действие**: Применена миграция через `pnpm prisma migrate deploy`

---

### Шаг 2: Проверка MediaAsset ✅

**Команда**: `npx tsx scripts/debug-media-usage.ts`

**Результат**:
```
MediaAsset найден:
- ID: cmovam68x000dws4w3o2vro1v
- filename: 1778146668313-cdspdxdh2wq-img-1718.webp
- originalName: IMG_1718.PNG
- publicUrl: /api/media/file/1778146668313-cdspdxdh2wq-img-1718.webp
- status: ACTIVE
```

✅ MediaAsset существует в БД

---

### Шаг 3: Проверка Activity ✅

**Результат**:
```
Activity найден:
- ID: cmovfgh6y0006wsa4yvw8cv4t
- title: Тестовое событие от Британской школы
- coverImageId: cmovam68x000dws4w3o2vro1v ✅ (правильный mediaId!)
- coverImageUrl: NULL
- status: PUBLISHED
```

✅ Activity.coverImageId правильно заполнен!
✅ Activity.coverImageUrl не используется (NULL)

---

### Шаг 4: Проверка MediaUsage ❌

**Результат**: `Found 0 usage records`

❌ **ПРОБЛЕМА**: MediaUsage записей НЕТ, хотя Activity.coverImageId заполнен!

---

### Шаг 5: Тест syncActivityMediaUsage() ❌

**Команда**: `npx tsx scripts/test-sync-media-usage.ts`

**Результат**: 
```
❌ Sync failed: PrismaClientKnownRequestError
The column `ActivityImage.mediaAssetId` does not exist in the current database.
```

**КОРНЕВАЯ ПРИЧИНА НАЙДЕНА**: 
- Поле `ActivityImage.mediaAssetId` есть в `schema.prisma`
- Но **НЕТ в базе данных** (миграция не создана/не применена)
- Prisma Client пытается использовать поле, которого нет в БД
- Sync падает с ошибкой

---

### Шаг 6: Создание и применение миграции ✅

**Команды**:
```bash
pnpm prisma migrate dev --name add_activity_image_media_asset_id --create-only
pnpm prisma migrate deploy
pnpm prisma generate
```

**Результат**: Создана миграция `20260510221239_add_activity_image_media_asset_id`

**SQL**:
```sql
-- AlterTable
ALTER TABLE "ActivityImage" ADD COLUMN "mediaAssetId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_coverImageId_idx" ON "Activity"("coverImageId");
CREATE INDEX "ActivityImage_mediaAssetId_idx" ON "ActivityImage"("mediaAssetId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_coverImageId_fkey" 
  FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityImage" ADD CONSTRAINT "ActivityImage_mediaAssetId_fkey" 
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;
```

✅ Миграция применена успешно

---

### Шаг 7: Повторный тест sync ✅

**Команда**: `npx tsx scripts/test-sync-media-usage.ts`

**Результат**:
```
--- BEFORE SYNC ---
MediaUsage records: 0

--- RUNNING SYNC ---
✅ Sync completed successfully!
Result: { mediaIds: [ 'cmovam68x000dws4w3o2vro1v' ], usageCount: 1 }

--- AFTER SYNC ---
MediaUsage records: 1
  - coverImageId → 1778146668313-cdspdxdh2wq-img-1718.webp

Total usages for media cmovam68x000dws4w3o2vro1v: 1
```

✅ **SYNC РАБОТАЕТ!**

---

### Шаг 8: Проверка данных после sync ✅

**Команда**: `npx tsx scripts/debug-media-usage.ts`

**Результат**:
```
2. Checking MediaUsage records...
Found 1 usage records:
  - EVENT cmovfgh6y0006wsa4yvw8cv4t (coverImageId)

6. Total MediaUsage records in database:
Total: 2

7. Sample MediaUsage records:
  - PLACE cmotuspfr0003wsilv8ilz7f1 → instagram-avatar.webp (logo)
  - EVENT cmovfgh6y0006wsa4yvw8cv4t → img-1718.webp (coverImageId)
```

✅ MediaUsage запись создана!
✅ Связь Activity → MediaAsset работает!

---

### Шаг 9: Отключение кэширования для admin страниц ✅

**Файл**: `src/app/admin/media/[id]/page.tsx`

**Добавлено**:
```typescript
// Force dynamic rendering for admin pages (no caching)
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

✅ Страница теперь всегда показывает актуальные данные

---

## 📊 Итоговое состояние

### ДО исправления:
- ❌ ActivityImage.mediaAssetId - поле в schema, но НЕТ в БД
- ❌ Activity.coverImageId - индекс и FK отсутствуют
- ❌ syncActivityMediaUsage() - падает с ошибкой
- ❌ MediaUsage записей нет
- ❌ UI показывает "Использование (0)"

### ПОСЛЕ исправления:
- ✅ ActivityImage.mediaAssetId - поле добавлено в БД
- ✅ Activity.coverImageId - индекс и FK созданы
- ✅ syncActivityMediaUsage() - работает корректно
- ✅ MediaUsage запись создана
- ✅ UI должен показывать "Использование (1)"

---

## 🚀 Следующие шаги

### 1. Перезапустить dev server
```bash
# Остановить текущий процесс
# Запустить заново
pnpm dev
```

### 2. Проверить в браузере
1. Открыть `/admin/media/cmovam68x000dws4w3o2vro1v`
2. Проверить "Использование (1)"
3. Проверить список использований:
   - EVENT: Тестовое событие от Британской школы
   - Field: coverImageId

### 3. Проверить кнопку "Пересчитать usage"
1. Кликнуть кнопку
2. Дождаться успешного ответа
3. Проверить, что счётчик остался 1

### 4. Создать новое событие с cover image
1. Создать событие
2. Добавить cover image
3. Проверить, что MediaUsage создаётся автоматически
4. Проверить, что usageCount увеличивается

---

## 🐛 Корневая причина

**Проблема**: Поле `ActivityImage.mediaAssetId` было добавлено в `schema.prisma`, но миграция не была создана и применена.

**Почему это произошло**:
1. Разработчик обновил schema.prisma
2. Забыл создать миграцию (`prisma migrate dev`)
3. Prisma Client был регенерирован с новым полем
4. TypeScript компиляция прошла успешно
5. Но в runtime Prisma пытается использовать поле, которого нет в БД
6. Sync падает с ошибкой "column does not exist"
7. MediaUsage записи не создаются
8. UI показывает 0 использований

**Урок**: Всегда создавать и применять миграции после изменения schema.prisma!

---

## 📝 Созданные файлы

### Debug скрипты (можно удалить после проверки):
- `scripts/debug-media-usage.ts` - проверка данных в БД
- `scripts/test-sync-media-usage.ts` - тест sync функции
- `src/app/api/debug/media-usage/route.ts` - debug endpoint

### Миграции:
- `prisma/migrations/20260510221239_add_activity_image_media_asset_id/` - добавление mediaAssetId

### Обновлённые файлы:
- `src/app/admin/media/[id]/page.tsx` - отключено кэширование

---

## ✅ Критерий готовности

На конкретном кейсе IMG_1718.webp:
- ✅ Activity.coverImageId заполнен
- ✅ MediaUsage запись создана
- ✅ syncActivityMediaUsage() работает
- ✅ Миграция применена
- ✅ Prisma Client регенерирован
- ⏳ UI показывает "Использование (1)" - **НУЖНО ПРОВЕРИТЬ В БРАУЗЕРЕ**

---

## 🔧 Команды для проверки

```bash
# 1. Проверить статус миграций
pnpm prisma migrate status

# 2. Проверить данные
npx tsx scripts/debug-media-usage.ts

# 3. Тест sync
npx tsx scripts/test-sync-media-usage.ts

# 4. TypeScript
pnpm tsc --noEmit

# 5. Запустить dev server
pnpm dev
```

---

**Статус**: ✅ Проблема найдена и исправлена
**Дата**: 2026-05-11
**Время debug**: ~30 минут
