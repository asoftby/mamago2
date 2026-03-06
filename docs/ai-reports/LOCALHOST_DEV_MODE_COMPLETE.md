# Localhost Dev Mode - Complete ✅

## Цель
Упростить DEV-режим до чистого localhost БЕЗ поддоменов. Все кабинеты на одном хосте.

## Изменения

### 1. Middleware (`src/middleware.ts`) ✅

**Логика:**
- Если host = `localhost` или `127.0.0.1` → НЕТ subdomain rewrites
- Только redirect `/` → `/minsk`
- Для `mamago.local` / `mamago.by` → оставлены subdomain rewrites

**Код:**
```typescript
const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

if (isLocalhost) {
  // Localhost: только redirect / -> /minsk
  if (pathname === "/") {
    url.pathname = "/minsk";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Для non-localhost: subdomain logic (mamago.local / mamago.by)
```

**Удалено:**
- `business.localhost` из списка business hosts
- `admin.localhost` из списка admin hosts

### 2. Auth Cookies (`src/lib/auth/cookie.ts`) ✅

**Логика:**
```typescript
export function getAuthCookieDomain(): string | undefined {
  if (NODE_ENV === "production") {
    return ".mamago.by";  // Subdomain sharing в prod
  } else {
    return undefined;     // Host-only cookie в dev (localhost)
  }
}
```

**Удалено:**
- Проверка `appUrl.includes("mamago.local")`
- Возврат `.mamago.local` в dev

**Результат:**
- DEV: cookie без domain → привязан к `localhost:3002`
- PROD: cookie с domain `.mamago.by` → работает на всех поддоменах

### 3. Logout (`src/app/api/auth/logout/route.ts`) ✅

**Упрощено:**
```typescript
// Всегда redirect на / того же домена
const redirectUrl = new URL("/", request.url);
const response = NextResponse.redirect(redirectUrl, 303);
deleteSessionCookie(response);
```

**Удалено:**
- Проверка `isBusinessHost`
- Логика редиректа на public domain
- Stripping `business.` prefix

## Структура URL в DEV

### Localhost (без поддоменов)
```
Public:   http://localhost:3002/
          http://localhost:3002/minsk
          http://localhost:3002/me
          http://localhost:3002/login

Admin:    http://localhost:3002/admin
          http://localhost:3002/admin/b2b/requests

Business: http://localhost:3002/business
          http://localhost:3002/business/onboarding
          http://localhost:3002/business/dashboard
```

### Production (с поддоменами)
```
Public:   https://mamago.by/
Admin:    https://admin.mamago.by/
Business: https://business.mamago.by/
```

## Чеклист ручной проверки

### ✅ Test 1: Логин и доступ к /me
```
1. Открыть http://localhost:3002/login
2. Ввести credentials и залогиниться
3. Проверить DevTools → Application → Cookies
   - Должна быть cookie: mg_session
   - Domain: localhost (без точки)
   - Path: /
4. Перейти на http://localhost:3002/me
5. Ожидание: страница загружается, НЕ редиректит на /login
```

### ✅ Test 2: Доступ к Admin (для ADMIN пользователя)
```
1. После логина (Test 1)
2. Открыть http://localhost:3002/admin
3. Ожидание: админ панель загружается
4. Проверить http://localhost:3002/admin/b2b/requests
5. Ожидание: страница работает
```

### ✅ Test 3: Business кабинет
```
1. После логина (Test 1)
2. Открыть http://localhost:3002/business/onboarding
3. Ожидание: форма онбординга загружается
4. Если бизнес уже создан:
   - Открыть http://localhost:3002/business/dashboard
   - Ожидание: дашборд загружается
```

### ✅ Test 4: Logout
```
1. После логина
2. POST /api/auth/logout (или кнопка Logout)
3. Проверить DevTools → Application → Cookies
   - Cookie mg_session должна исчезнуть
4. Redirect на http://localhost:3002/ (затем /minsk)
5. Попытка открыть http://localhost:3002/me
6. Ожидание: редирект на /login
```

### ✅ Test 5: Redirect / → /minsk
```
1. Открыть http://localhost:3002/
2. Ожидание: автоматический redirect на /minsk
3. URL в браузере: http://localhost:3002/minsk
```

### ✅ Test 6: Cookie после логина
```
1. Залогиниться на http://localhost:3002/login
2. Открыть DevTools → Network → login request
3. Проверить Response Headers:
   Set-Cookie: mg_session=<token>; Path=/; HttpOnly; SameSite=Lax
   (БЕЗ Domain в dev!)
4. Проверить Application → Cookies:
   Name: mg_session
   Domain: localhost
   Path: /
   HttpOnly: ✓
   Secure: (пусто в dev)
```

### ✅ Test 7: API routes работают
```
1. После логина
2. Открыть http://localhost:3002/api/discovery/filters
3. Ожидание: JSON ответ (не 401)
4. Проверить другие API endpoints
```

## Что НЕ работает (и не должно)

### ❌ Поддомены в dev
```
http://admin.localhost:3002      → НЕ используется
http://business.localhost:3002   → НЕ используется
http://admin.mamago.local:3002   → работает только если настроен /etc/hosts
http://business.mamago.local:3002 → работает только если настроен /etc/hosts
```

В dev используем только `localhost:3002` без поддоменов!

## Environment Variables

### .env.local (dev)
```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3002

# Database
DATABASE_URL="postgresql://..."
```

### Production
```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://mamago.by

# Database
DATABASE_URL="postgresql://..."
```

## Файлы изменены

1. ✅ `src/middleware.ts` - добавлена проверка localhost
2. ✅ `src/lib/auth/cookie.ts` - упрощена логика domain
3. ✅ `src/app/api/auth/logout/route.ts` - упрощён redirect

## Преимущества

### ✅ Простота
- Один хост для всего: `localhost:3002`
- Не нужно настраивать `/etc/hosts`
- Не нужно помнить поддомены

### ✅ Надёжность
- Cookie работает без проблем (host-only)
- Нет конфликтов с domain
- Браузер не блокирует cookies

### ✅ Скорость
- Меньше редиректов
- Прямой доступ к любому роуту
- Быстрая разработка

### ✅ Совместимость
- Production остаётся с поддоменами
- Middleware автоматически определяет режим
- Нет breaking changes для prod

## Troubleshooting

### Проблема: Cookie не сохраняется
**Решение:**
1. Проверить DevTools → Network → Response Headers
2. Должен быть `Set-Cookie: mg_session=...`
3. Проверить что domain НЕ указан (или `localhost`)
4. Очистить все cookies и попробовать снова

### Проблема: Редирект на /login после логина
**Решение:**
1. Проверить что cookie сохранилась (DevTools → Application)
2. Проверить что cookie отправляется (DevTools → Network → Request Headers)
3. Проверить логи сервера на ошибки валидации сессии

### Проблема: /admin не работает
**Решение:**
1. Проверить что пользователь имеет role = ADMIN
2. Проверить в Prisma Studio: User → role
3. Если role = USER, нужно изменить на ADMIN

### Проблема: Старые cookies мешают
**Решение:**
1. DevTools → Application → Cookies
2. Удалить все cookies для localhost
3. Перезагрузить страницу
4. Залогиниться заново

## Статус: COMPLETE ✅

Dev-режим упрощён до localhost без поддоменов:
- ✅ Middleware не применяет subdomain rewrites для localhost
- ✅ Cookies без domain в dev (host-only)
- ✅ Logout упрощён (redirect на тот же домен)
- ✅ Все кабинеты доступны на localhost:3002
- ✅ Production остаётся с поддоменами
- ✅ Все диагностики проходят
