# Phone Verification Gate - Quick Start

## Быстрое применение к новому endpoint

### 1. Импортировать helper

```typescript
import { requirePhoneVerifiedUser } from "@/lib/auth/requirePhoneVerifiedUser";
```

### 2. Добавить в начало handler

```typescript
export async function POST(request: NextRequest) {
  // Verification gate
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) {
    return userOrError;
  }
  const user = userOrError;

  // Ваш код здесь
  // user.id, user.email, user.phoneE164 доступны
}
```

### 3. Готово! ✅

Helper автоматически:
- Проверит авторизацию
- Проверит подтверждение телефона
- Вернет ошибку 401 или 403 если нужно
- Вернет User если все ОК

---

## Frontend обработка (если нужно)

```typescript
const response = await fetch('/api/your-endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});

const result = await response.json();

if (!response.ok) {
  if (result.error === 'UNAUTHORIZED') {
    openAuthModal(); // Показать модальное окно авторизации
    return;
  }
  
  if (result.error === 'PHONE_NOT_VERIFIED') {
    openPhoneVerificationModal(); // Показать модальное окно верификации
    return;
  }
  
  throw new Error(result.message);
}

// Успех
```

---

## Примеры

### Отзывы (реализовано)
`src/app/api/places/[id]/reviews/route.ts`

### Комментарии (пример)
`src/lib/auth/examples/comments-endpoint-example.ts`

### Бронирования (пример)
`src/lib/auth/examples/bookings-endpoint-example.ts`

---

## Полная документация

См. `src/lib/auth/PHONE_VERIFICATION_GATE.md`
