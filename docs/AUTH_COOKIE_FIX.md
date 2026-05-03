# Исправление 401 Unauthorized для httpOnly Cookie Auth

## Проблема
Все защищённые API endpoints возвращали 401 Unauthorized:
- `/api/auth/me`
- `/api/children`
- `/api/notifications`
- `/api/save/plan`
- `/api/save/idea`

Это ломало:
- "Мой план"
- Добавление маршрутов
- Профиль пользователя
- Рейтинг маршрутов

## Корневая причина
Клиентские fetch запросы НЕ отправляли httpOnly cookies, потому что не было `credentials: "include"`.

## Решение

### 1. Создан глобальный fetch wrapper
**Файл:** `src/lib/api/fetch.ts`

```typescript
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include", // ← КРИТИЧНО: всегда включаем cookies
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}
```

### 2. Обновлены компоненты
Все компоненты, которые делают API запросы, теперь используют `apiFetch`:

- `src/components/routes/RouteRatingBlock.tsx` - рейтинг маршрутов
- `src/components/routes/RouteCard.tsx` - сохранение маршрутов
- `src/components/onboarding/SaveRouteOnboarding.tsx` - добавление в план

### 3. Создан debug endpoint
**Файл:** `src/app/api/debug/cookies/route.ts`

Для проверки cookies:
```
GET http://mamago.local:3000/api/debug/cookies
```

Возвращает все cookies, которые видит сервер.

## Как использовать apiFetch

### Вместо:
```typescript
const res = await fetch("/api/save/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

### Используйте:
```typescript
import { apiFetch } from "@/lib/api/fetch";

const res = await apiFetch("/api/save/plan", {
  method: "POST",
  body: JSON.stringify(data),
});
```

### Или удобные методы:
```typescript
import { apiPost, apiGet, apiPatch, apiDelete } from "@/lib/api/fetch";

// GET
const res = await apiGet("/api/auth/me");

// POST
const res = await apiPost("/api/save/plan", { routeId, date });

// PATCH
const res = await apiPatch("/api/children/123", { name: "Новое имя" });

// DELETE
const res = await apiDelete("/api/children/123");
```

## Проверка работы

1. **Откройте debug endpoint:**
   ```
   http://mamago.local:3000/api/debug/cookies
   ```
   Должны видеть cookies с session/token

2. **Сделайте логин**

3. **Проверьте:**
   - `/api/auth/me` → 200 OK
   - `/api/children` → 200 OK
   - Добавление маршрута в план → работает
   - Рейтинг маршрутов → работает

## Важные моменты

### ✅ Что сделано
- Глобальный fetch wrapper с `credentials: "include"`
- Обновлены критические компоненты
- Debug endpoint для проверки cookies
- Документация

### ⚠️ Что ещё нужно сделать
Обновить ВСЕ остальные fetch вызовы в проекте:
- `src/components/event-page/EventPageView.tsx`
- `src/components/children/AddParticipantModal.tsx`
- `src/components/site/header/PlanWidget.tsx`
- `src/components/site/header/NotificationsDropdown.tsx`
- И другие...

**Поиск:** `grep -r "fetch(" src/components --include="*.tsx" | grep -v "apiFetch"`

### 🔒 Безопасность
- httpOnly cookies НЕ доступны из JavaScript (защита от XSS)
- `credentials: "include"` отправляет cookies только на тот же origin
- `sameSite: "lax"` защищает от CSRF

## Тестирование

```bash
# Проверить все fetch вызовы
grep -r "fetch(" src/components --include="*.tsx" | wc -l

# Найти fetch без credentials
grep -r "fetch(" src/components --include="*.tsx" | grep -v "credentials" | grep -v "apiFetch"
```

## Ссылки
- [MDN: fetch credentials](https://developer.mozilla.org/en-US/docs/Web/API/fetch#credentials)
- [Next.js: httpOnly cookies](https://nextjs.org/docs/app/building-your-application/authentication)
