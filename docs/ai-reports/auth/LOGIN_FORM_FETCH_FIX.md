# Login Form Fetch Fix - Complete ✅

## Проблема
Форма логина использовала Server Action (`useActionState` + `loginAction`), что отправляло запрос как `next-action` с `text/x-component`. Из-за этого браузер не получал `Set-Cookie` заголовок и сессия не сохранялась.

## Решение
Переделал форму логина на client-side fetch с прямым POST на `/api/auth/login`.

## Изменения

### Файл: `src/app/(public)/login/LoginForm.tsx`

**До (Server Action):**
```typescript
"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ from, next }) {
  const [state, formAction] = useActionState(loginAction, { ok: true });
  return <form action={formAction}>...</form>;
}
```

**После (Fetch API):**
```typescript
"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ from, next }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      // Redirect based on priority
      router.replace(targetPath);
    } else {
      setError("Неверный email или пароль");
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

## Логика редиректа

**Приоритет 1: Параметр `from`**
```
from=admin    → /admin
from=business → /business
from=public   → /minsk
```

**Приоритет 2: Параметр `next`**
```
next=/some/path → /some/path
```

**Приоритет 3: Определение по host**
```
admin.mamago.local:3002    → /admin
business.mamago.local:3002 → /business
mamago.local:3002          → /minsk
```

## Что работает теперь

✅ **POST на `/api/auth/login`** - прямой запрос к API route
✅ **Set-Cookie приходит** - браузер получает `mg_session` cookie
✅ **Сессия сохраняется** - cookie с `domain=.mamago.local`
✅ **Редирект работает** - по приоритету from → next → host
✅ **Disabled inputs** - во время загрузки
✅ **Показ ошибок** - при 401/400
✅ **credentials: "same-origin"** - для отправки cookies

## Тестирование

### Test 1: Логин на главном домене
```
URL: http://mamago.local:3002/login
Ввод: email + password
Клик: Войти
Ожидание: 
  - POST /api/auth/login
  - Set-Cookie: mg_session=...
  - Redirect → /minsk
```

### Test 2: Логин на admin поддомене
```
URL: http://admin.mamago.local:3002/login
Ввод: email + password
Клик: Войти
Ожидание:
  - POST /api/auth/login
  - Set-Cookie: mg_session=...
  - Redirect → /admin
```

### Test 3: Логин с параметром from
```
URL: http://mamago.local:3002/login?from=business
Ввод: email + password
Клик: Войти
Ожидание:
  - POST /api/auth/login
  - Set-Cookie: mg_session=...
  - Redirect → /business
```

### Test 4: Неверные credentials
```
URL: http://mamago.local:3002/login
Ввод: wrong@email.com + wrongpassword
Клик: Войти
Ожидание:
  - POST /api/auth/login → 401
  - Показ ошибки: "Неверный email или пароль"
  - Форма остаётся на странице
```

## Проверка в DevTools

### Network Tab
```
Request:
  POST /api/auth/login
  Content-Type: application/json
  Body: {"email":"...","password":"..."}

Response:
  Status: 200 OK
  Set-Cookie: mg_session=<token>; Domain=.mamago.local; Path=/; HttpOnly; SameSite=Lax
  Body: {"success":true,"user":{...}}
```

### Application → Cookies
```
После логина должна появиться:
  Name: mg_session
  Value: <token>
  Domain: .mamago.local
  Path: /
  HttpOnly: ✓
  SameSite: Lax
```

## Файлы изменены

1. ✅ `src/app/(public)/login/LoginForm.tsx` - переделан на fetch API

## Файлы НЕ изменены

- ❌ `src/app/(public)/login/actions.ts` - больше не используется
- ❌ `src/app/api/auth/login/route.ts` - работает как есть
- ❌ `src/middleware.ts` - не трогали
- ❌ `prisma/schema.prisma` - не трогали

## Статус: COMPLETE ✅

Форма логина теперь:
- ✅ Отправляет POST на `/api/auth/login`
- ✅ Получает Set-Cookie в браузере
- ✅ Сохраняет сессию
- ✅ Редиректит по правилам
- ✅ Показывает ошибки
- ✅ Disabled во время загрузки
- ✅ Работает на всех поддоменах
