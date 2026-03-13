# Sharp Build Error - Финальное решение

## Статус

✅ Sharp установлен (v0.33.5)
✅ Next.js конфигурация обновлена
✅ Кэш очищен

## Что нужно сделать

### ВАЖНО: Перезапустите dev server!

Ошибка появляется из-за кэша Turbopack. Выполните:

```bash
# 1. Остановите текущий dev server (Ctrl+C)

# 2. Очистите кэш
rm -rf .next

# 3. Перезапустите сервер
npm run dev
```

## Что было исправлено

### 1. Установлен Sharp
```bash
pnpm install sharp
```

Результат: `sharp@0.33.5` с поддержкой HEIC/HEIF

### 2. Обновлен next.config.ts

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  
  // Exclude sharp from client bundle
  serverExternalPackages: ['sharp'],
  
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
};
```

### 3. Добавлен в package.json

```json
{
  "dependencies": {
    "sharp": "^0.33.5"
  }
}
```

## Почему нужен перезапуск

Turbopack кэширует информацию о модулях. После установки новой зависимости нужно:
1. Остановить dev server
2. Очистить кэш `.next`
3. Перезапустить сервер

## Проверка после перезапуска

После перезапуска проверьте:

1. ✅ Сервер запускается без ошибок
2. ✅ Страница `/admin/media` загружается
3. ✅ Загрузка изображений работает
4. ✅ Обработка изображений работает

## Если ошибка сохраняется

### Вариант 1: Полная очистка

```bash
rm -rf .next node_modules/.cache
pnpm install
npm run dev
```

### Вариант 2: Используйте Webpack

```bash
npm run dev:webpack
```

Webpack имеет более стабильную поддержку серверных зависимостей.

## Документация

- `RESTART_DEV_SERVER.md` - инструкция по перезапуску
- `docs/SHARP_BUILD_FIX.md` - детали исправления
- `SHARP_INSTALLATION_COMPLETE.md` - полный отчет

## Итог

Все исправления применены. Нужен только перезапуск dev server для применения изменений.
