# Исправление проблемы "blob" в именах файлов - Завершено

## Проблема

При загрузке изображений через админку медиатеки:
1. Заголовок отображался как "blob" вместо нормального имени
2. Оригинальное имя файла терялось при сжатии на клиенте

## Причины

### 1. Потеря имени при клиентском сжатии
Библиотека `browser-image-compression` создает новый File объект после сжатия, но не сохраняет оригинальное имя. По умолчанию получается имя "blob".

### 2. Отсутствие автогенерации заголовка
При загрузке через админку без привязки к сущности, заголовок не генерировался из имени файла.

## Решение

### Исправление 1: Сохранение оригинального имени
**Файл:** `src/lib/image/compression.ts`

Добавлен код для создания нового File объекта с оригинальным именем:

```typescript
// Preserve original filename (browser-image-compression creates "blob" name)
const finalFile = new File([compressedFile], file.name, {
  type: compressedFile.type,
  lastModified: Date.now(),
});
```

### Исправление 2: Автогенерация заголовка
**Файл:** `src/lib/media/mediaRegistry.ts`

Добавлена логика автоматической генерации заголовка из имени файла:

```typescript
// Auto-generate title from originalName if not provided
let title = input.title;
if (!title && input.originalName) {
  title = input.originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[-_]/g, " ") // Replace dashes/underscores with spaces
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();
  
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
}
```

## Примеры трансформации

| Оригинальное имя файла | Заголовок (до) | Заголовок (после) |
|------------------------|----------------|-------------------|
| restaurant-interior.jpg | blob | Restaurant interior |
| cafe_exterior_photo.png | blob | Cafe exterior photo |
| beautiful-sunset-view.webp | blob | Beautiful sunset view |
| IMG_1234.jpg | blob | IMG 1234 |

## Тестирование

Создан тест для проверки исправлений:
```bash
npx tsx scripts/test-filename-preservation.ts
```

Результаты:
- ✅ Сохранение оригинального имени при сжатии
- ✅ Автогенерация заголовка из имени файла
- ✅ Очистка имени (замена дефисов/подчеркиваний)
- ✅ Капитализация первой буквы
- ✅ Отсутствие "blob" в заголовках

## Результат

Теперь при загрузке изображений через админку:
1. ✅ Оригинальное имя файла сохраняется
2. ✅ Заголовок автоматически генерируется из имени
3. ✅ Заголовок читаемый и понятный
4. ✅ Нет "blob" в интерфейсе
5. ✅ Работает для всех форматов (JPEG, PNG, WebP, HEIC, HEIF)

## Файлы изменены

1. `src/lib/image/compression.ts` - сохранение оригинального имени
2. `src/lib/media/mediaRegistry.ts` - автогенерация заголовка
3. `scripts/test-filename-preservation.ts` - тесты
4. `docs/FILENAME_PRESERVATION_FIX.md` - документация

## Дополнительная информация

Полная документация: `docs/FILENAME_PRESERVATION_FIX.md`
