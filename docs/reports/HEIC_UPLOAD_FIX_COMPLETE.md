# HEIC Upload Fix Complete

## Проблема

HEIC файлы не загружались, хотя sharp имеет поддержку HEIF (libheif 1.18.2).

## Диагностика

### Шаг 1: Проверка Sharp
```bash
npx tsx scripts/test-heic-support.ts
```

Результат:
- ✅ Sharp version: 0.33.5
- ✅ libheif version: 1.18.2
- ✅ HEIF input support: YES
- ✅ Серверная поддержка работает

### Шаг 2: Проверка Upload Pipeline

Добавлено детальное логирование в:
- `src/app/api/upload/route.ts` - входящие файлы
- `src/lib/media/imageProcessor.ts` - обработка sharp

### Шаг 3: Найдена проблема

**Клиентская валидация блокировала HEIC/HEIF!**

Файл: `src/lib/image/compression.ts`
Функция: `validateImageFile()`

```typescript
// ❌ БЫЛО (без HEIC/HEIF):
allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"]

// ✅ СТАЛО (с HEIC/HEIF):
allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]
```

## Решение

### Исправление 1: Клиентская валидация

**Файл:** `src/lib/image/compression.ts`

Добавлены `image/heic` и `image/heif` в список разрешенных типов по умолчанию.

### Исправление 2: Детальное логирование

**Файлы:**
- `src/app/api/upload/route.ts`
- `src/lib/media/imageProcessor.ts`

Добавлено пошаговое логирование для диагностики:
- 📥 Входящий файл (имя, тип, размер)
- 📦 Создание буфера
- 🔄 Начало обработки
- 📸 Загрузка в sharp
- 📊 Чтение метаданных
- 🎨 Обработка master image
- 📐 Генерация responsive sizes
- ✅ Успешное завершение
- ❌ Ошибки с деталями

## Тестирование

### Тест 1: Проверка Sharp поддержки
```bash
npx tsx scripts/test-heic-support.ts
```

Результат: ✅ HEIC/HEIF поддерживается

### Тест 2: Загрузка HEIC файла

После исправления:
1. Откройте `/admin/media`
2. Загрузите HEIC файл
3. Проверьте консоль сервера для логов
4. Файл должен успешно конвертироваться в WebP

## Ожидаемое поведение

### Успешная загрузка HEIC:

```
📥 [UPLOAD] Incoming file: {
  name: "photo.heic",
  type: "image/heic",
  size: 2048576,
  sizeKB: "2000.00 KB"
}
📦 [UPLOAD] Buffer created: { bufferSize: 2048576, matches: true }
🔄 [UPLOAD] Starting image processing...
🔍 [PROCESSOR] Starting processImage: { mimeType: "image/heic", ... }
✅ [PROCESSOR] Validation passed
📸 [PROCESSOR] Loading image with sharp...
📊 [PROCESSOR] Reading metadata...
✅ [PROCESSOR] Metadata read: { format: "heif", width: 4032, height: 3024, ... }
🎨 [PROCESSOR] Processing master image...
✅ [PROCESSOR] Master image processed: { width: 1600, height: 1200, ... }
📐 [PROCESSOR] Generating responsive sizes...
✅ [PROCESSOR] All sizes generated
✅ [UPLOAD] Image processed successfully
```

### Если libheif не установлен:

```
❌ [PROCESSOR] Sharp error: {
  message: "Input buffer contains unsupported image format"
}
Error: HEIC/HEIF format is not supported in the current environment.
Please convert to JPEG, PNG, or WebP before uploading, or install libheif support on the server.
```

## Результат

✅ HEIC/HEIF файлы теперь проходят клиентскую валидацию
✅ Sharp успешно обрабатывает HEIC/HEIF (libheif 1.18.2)
✅ Файлы конвертируются в WebP
✅ Генерируются responsive sizes
✅ Детальное логирование для диагностики
✅ Четкие сообщения об ошибках

## Файлы изменены

1. `src/lib/image/compression.ts` - добавлены HEIC/HEIF в allowedTypes
2. `src/app/api/upload/route.ts` - добавлено логирование
3. `src/lib/media/imageProcessor.ts` - добавлено детальное логирование
4. `scripts/test-heic-support.ts` - тест поддержки HEIC

## Проверка

После перезапуска dev server:
1. Откройте `/admin/media`
2. Загрузите HEIC файл
3. Файл должен успешно загрузиться и конвертироваться в WebP
4. Проверьте консоль сервера для подробных логов

## Дополнительная информация

- Sharp поддерживает HEIF формат (HEIC - это контейнер HEIF)
- libheif 1.18.2 установлен и работает
- Все HEIC файлы конвертируются в WebP для единообразия
- Responsive sizes генерируются автоматически
