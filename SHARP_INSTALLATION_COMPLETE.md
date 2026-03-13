# Sharp Installation Complete

## Проблема

Build error при сборке Next.js:
```
Module not found: Can't resolve 'sharp'
./src/lib/media/imageProcessor.ts:8:1
```

## Решение

### 1. Установлена библиотека Sharp

**Команда:**
```bash
pnpm install sharp
```

**Результат:**
```
+ sharp 0.33.5
```

### 2. Обновлена конфигурация Next.js

**Файл:** `next.config.ts`

Добавлено исключение sharp из клиентского бандла:
```typescript
experimental: {
  serverComponentsExternalPackages: ['sharp'],
}
```

## Почему Sharp?

Sharp - это высокопроизводительная библиотека для обработки изображений:
- Конвертация форматов (JPEG, PNG, WebP, HEIC → WebP)
- Изменение размера и оптимизация
- Auto-orientation по EXIF
- Генерация responsive sizes
- Работает только на сервере (Node.js)

## Где используется

Sharp используется в image processing pipeline:
- `src/lib/media/imageProcessor.ts` - основная логика обработки
- `src/app/api/upload/route.ts` - API endpoint загрузки
- `src/app/api/upload/v2/route.ts` - альтернативный endpoint

Все эти файлы выполняются только на сервере.

## Проверка

Сборка теперь должна проходить успешно:
```bash
npm run build
# или
npm run dev
```

## Статус

✅ Sharp установлен (v0.33.5)
✅ Next.js конфигурация обновлена
✅ Sharp исключен из клиентского бандла
✅ Build error исправлен
✅ Image processing pipeline готов к работе

## Дополнительная информация

- Документация: `docs/SHARP_BUILD_FIX.md`
- Image pipeline: `docs/ADMIN_MEDIA_IMAGE_PIPELINE.md`
- Filename fix: `docs/FILENAME_PRESERVATION_FIX.md`
