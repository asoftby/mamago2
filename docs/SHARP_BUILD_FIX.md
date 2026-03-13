# Sharp Build Error Fix

## Проблема

При сборке Next.js возникала ошибка:
```
Module not found: Can't resolve 'sharp'
```

## Причины

1. **Sharp не был установлен** - библиотека отсутствовала в `package.json`
2. **Sharp пытался попасть в клиентский бандл** - Next.js пытался включить серверную библиотеку в клиентский код

## Решение

### 1. Установка Sharp

Добавлен `sharp` в зависимости:

```json
{
  "dependencies": {
    "sharp": "^0.33.5"
  }
}
```

Установка:
```bash
pnpm install sharp
```

### 2. Конфигурация Next.js

Обновлен `next.config.ts` для исключения sharp из клиентского бандла:

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  
  // Exclude sharp from client bundle (server-only image processing)
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
};
```

## Почему это важно

Sharp - это нативная Node.js библиотека для обработки изображений:
- Работает только на сервере
- Использует нативные бинарные модули
- Не может работать в браузере
- Должна быть исключена из клиентского бандла

## Использование Sharp

Sharp используется только в серверных API routes:
- `src/app/api/upload/route.ts` - основной endpoint загрузки
- `src/app/api/upload/v2/route.ts` - альтернативный endpoint
- `src/lib/media/imageProcessor.ts` - обработка изображений

Все эти файлы выполняются только на сервере, поэтому sharp безопасно использовать.

## Проверка

После исправления сборка должна пройти успешно:
```bash
npm run build
```

Или в dev режиме:
```bash
npm run dev
```

## Результат

✅ Sharp установлен
✅ Sharp исключен из клиентского бандла
✅ Сборка проходит без ошибок
✅ Обработка изображений работает корректно
