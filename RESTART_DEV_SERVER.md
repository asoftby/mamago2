# Перезапуск Dev Server после установки Sharp

## Проблема

После установки `sharp` и обновления конфигурации Next.js, ошибка всё ещё появляется из-за кэша Turbopack.

## Решение

### 1. Остановите текущий dev server

Нажмите `Ctrl+C` в терминале, где запущен `npm run dev`

### 2. Очистите кэш Next.js

```bash
rm -rf .next
```

Или:
```bash
find .next -type f -delete
```

### 3. Перезапустите dev server

```bash
npm run dev
```

Или с Turbopack:
```bash
npm run dev:turbo
```

## Что было сделано

1. ✅ Установлен `sharp` через pnpm
2. ✅ Обновлен `next.config.ts`:
   - Добавлен `serverExternalPackages: ['sharp']`
   - Добавлен `experimental.serverComponentsExternalPackages: ['sharp']`
3. ✅ Очищен кэш `.next`

## Проверка

После перезапуска сервера ошибка должна исчезнуть. Проверьте:

1. Сервер запускается без ошибок
2. Страница `/admin/media` загружается
3. Загрузка изображений работает

## Если ошибка всё ещё появляется

Попробуйте:

```bash
# Полная очистка
rm -rf .next node_modules/.cache

# Переустановка зависимостей
pnpm install

# Перезапуск
npm run dev
```

## Альтернатива: Webpack вместо Turbopack

Если проблема сохраняется с Turbopack, используйте Webpack:

```bash
npm run dev:webpack
```

Webpack имеет более стабильную поддержку серверных зависимостей.
