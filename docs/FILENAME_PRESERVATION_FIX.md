# Filename Preservation Fix

## Проблема

При загрузке изображений через админку появлялись две проблемы:

1. **"blob" в заголовках** - вместо нормального имени файла отображалось "blob"
2. **Потеря оригинального имени** - библиотека `browser-image-compression` создавала файл с именем "blob"

## Причина

### Проблема 1: Потеря имени при сжатии

Библиотека `browser-image-compression` создает новый `File` объект после сжатия, но не сохраняет оригинальное имя файла. По умолчанию новый файл получает имя "blob".

### Проблема 2: Отсутствие автогенерации заголовка

При загрузке через админку без привязки к сущности (Place, Event и т.д.), заголовок не генерировался автоматически из имени файла.

## Решение

### Исправление 1: Сохранение имени при сжатии

**Файл:** `src/lib/image/compression.ts`

```typescript
// Preserve original filename (browser-image-compression creates "blob" name)
const finalFile = new File([compressedFile], file.name, {
  type: compressedFile.type,
  lastModified: Date.now(),
});
```

Создаем новый `File` объект с оригинальным именем после сжатия.


### Исправление 2: Автогенерация заголовка

**Файл:** `src/lib/media/mediaRegistry.ts`

```typescript
// Auto-generate title from originalName if not provided
let title = input.title;
if (!title && input.originalName) {
  // Remove extension and clean up filename
  title = input.originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim();
  
  // Capitalize first letter
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
}
```

Автоматически генерируем читаемый заголовок из имени файла:
- Удаляем расширение
- Заменяем дефисы и подчеркивания на пробелы
- Нормализуем множественные пробелы
- Делаем первую букву заглавной

## Примеры

### До исправления
- Имя файла: `restaurant-interior.jpg`
- Заголовок: `blob`

### После исправления
- Имя файла: `restaurant-interior.jpg`
- Заголовок: `Restaurant interior`

## Тестирование

Запустите тест:

```bash
npx tsx scripts/test-filename-preservation.ts
```

Тест проверяет:
- ✅ Сохранение оригинального имени при сжатии
- ✅ Автогенерацию заголовка из имени файла
- ✅ Очистку имени (удаление дефисов, подчеркиваний)
- ✅ Капитализацию первой буквы
- ✅ Отсутствие "blob" в заголовках

## Результат

Теперь при загрузке изображений:
1. Оригинальное имя файла сохраняется
2. Заголовок автоматически генерируется из имени файла
3. Заголовок читаемый и понятный
4. Нет "blob" в интерфейсе
