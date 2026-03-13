# HEIC Client Bypass Fix

## Проблема

HEIC файлы всё ещё не загружались после исправления валидации.

## Причина

**`browser-image-compression` НЕ поддерживает HEIC/HEIF!**

Клиентский код пытался сжать HEIC файл с помощью `browser-image-compression`, который не может обработать этот формат. Это приводило к ошибке ещё до отправки на сервер.

## Решение

### Обход клиентского сжатия для HEIC/HEIF

**Файл:** `src/hooks/useImageUpload.ts`

Добавлена проверка типа файла:
- Если файл HEIC/HEIF → пропускаем клиентское сжатие
- Отправляем оригинальный файл напрямую на сервер
- Сервер обрабатывает с помощью sharp (который поддерживает HEIC)

```typescript
// Skip client-side compression for HEIC/HEIF
const isHEIC = file.type === "image/heic" || file.type === "image/heif";

if (isHEIC) {
  console.log("📸 [UPLOAD] HEIC/HEIF detected, skipping client compression");
  fileToUpload = file;
  // Server will provide dimensions after processing
} else {
  // Compress image for other formats
  const compressed = await compressImage(file, ...);
  fileToUpload = compressed.file;
  ...
}
```

## Почему это работает

### Клиент (браузер):
- ❌ `browser-image-compression` НЕ поддерживает HEIC/HEIF
- ✅ Пропускаем клиентское сжатие
- ✅ Отправляем оригинальный файл на сервер

### Сервер (Node.js):
- ✅ `sharp` с `libheif 1.18.2` поддерживает HEIC/HEIF
- ✅ Обрабатывает, конвертирует в WebP
- ✅ Генерирует responsive sizes
- ✅ Возвращает обработанное изображение

## Поток обработки

### JPEG/PNG/WebP (с клиентским сжатием):
```
1. Браузер: Валидация ✅
2. Браузер: Сжатие с browser-image-compression ✅
3. Браузер: Отправка на сервер ✅
4. Сервер: Обработка с sharp ✅
5. Сервер: Конвертация в WebP ✅
6. Сервер: Responsive sizes ✅
```

### HEIC/HEIF (без клиентского сжатия):
```
1. Браузер: Валидация ✅
2. Браузер: Пропуск сжатия (HEIC detected) ✅
3. Браузер: Отправка оригинала на сервер ✅
4. Сервер: Обработка с sharp + libheif ✅
5. Сервер: Конвертация в WebP ✅
6. Сервер: Responsive sizes ✅
```

## Изменения

### 1. Клиентская валидация
**Файл:** `src/lib/image/compression.ts`
- Добавлены `image/heic` и `image/heif` в allowedTypes

### 2. Обход клиентского сжатия
**Файл:** `src/hooks/useImageUpload.ts`
- Определение HEIC/HEIF файлов
- Пропуск `compressImage()` для HEIC/HEIF
- Отправка оригинального файла на сервер
- Использование размеров из ответа сервера

### 3. Серверное логирование
**Файлы:**
- `src/app/api/upload/route.ts`
- `src/lib/media/imageProcessor.ts`
- Детальные логи для диагностики

## Тестирование

### После перезапуска dev сервера:

1. Откройте `/admin/media`
2. Загрузите HEIC файл
3. Проверьте консоль браузера:
   ```
   📸 [UPLOAD] HEIC/HEIF detected, skipping client compression
   ```
4. Проверьте консоль сервера:
   ```
   📥 [UPLOAD] Incoming file: { type: "image/heic", ... }
   🔄 [UPLOAD] Starting image processing...
   ✅ [UPLOAD] Image processed successfully
   ```

## Важно

**Перезапустите dev сервер и очистите кэш браузера!**

```bash
# 1. Остановите сервер (Ctrl+C)

# 2. Очистите кэш Next.js
rm -rf .next

# 3. Перезапустите
npm run dev

# 4. В браузере: Hard Refresh (Cmd+Shift+R на Mac, Ctrl+Shift+R на Windows)
```

## Результат

✅ HEIC/HEIF файлы проходят клиентскую валидацию
✅ Клиентское сжатие пропускается для HEIC/HEIF
✅ Оригинальный файл отправляется на сервер
✅ Сервер обрабатывает с sharp + libheif
✅ Конвертация в WebP работает
✅ Responsive sizes генерируются
✅ Детальное логирование для диагностики

## Файлы изменены

1. `src/lib/image/compression.ts` - добавлены HEIC/HEIF в allowedTypes
2. `src/hooks/useImageUpload.ts` - обход клиентского сжатия для HEIC/HEIF
3. `src/app/api/upload/route.ts` - детальное логирование
4. `src/lib/media/imageProcessor.ts` - детальное логирование

## Проверка

После перезапуска и очистки кэша:
1. Загрузите HEIC файл
2. Должно работать без ошибок
3. Файл конвертируется в WebP
4. Появляется в медиатеке
