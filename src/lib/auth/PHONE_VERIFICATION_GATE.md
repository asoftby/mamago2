# Phone Verification Gate для UGC

## Контекст

По требованиям законодательства РБ для пользовательского контента (UGC) требуется верификация по телефону.

## Логика

- User может зарегистрироваться **без телефона**
- Телефон **не требуется** при обычной регистрации
- Телефон **требуется** перед UGC-действиями

## UGC-действия (требуют подтвержденный телефон)

1. ✅ Оставить отзыв о месте
2. ⏳ Оставить комментарий
3. ⏳ Написать бизнесу
4. ⏳ Отправить заявку/бронь
5. ⏳ Пожаловаться

## Поля в User модели

```prisma
model User {
  // ...
  phoneE164       String?   @unique  // Телефон в формате E.164 (+375291234567)
  phoneVerifiedAt DateTime?          // Дата подтверждения телефона
  // ...
}
```

## Helper: requirePhoneVerifiedUser()

### Расположение
`src/lib/auth/requirePhoneVerifiedUser.ts`

### Что проверяет
1. Пользователь авторизован (`getCurrentUser()`)
2. Телефон подтвержден (`user.phoneVerifiedAt !== null`)

### Возвращает
- `User` - если все проверки пройдены
- `NextResponse` - если проверка не пройдена (401 или 403)

### Коды ошибок

#### UNAUTHORIZED (401)
```json
{
  "error": "UNAUTHORIZED",
  "message": "Please log in to continue"
}
```

#### PHONE_NOT_VERIFIED (403)
```json
{
  "error": "PHONE_NOT_VERIFIED",
  "message": "Please verify your phone number to continue",
  "details": "Phone verification is required for user-generated content according to local regulations"
}
```

## Использование

### В API Route Handler

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requirePhoneVerifiedUser } from "@/lib/auth/requirePhoneVerifiedUser";

export async function POST(request: NextRequest) {
  // Verification gate
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) {
    return userOrError; // Вернуть ошибку 401 или 403
  }
  const user = userOrError;

  // Продолжить обработку с верифицированным пользователем
  // user.id, user.email, user.phoneE164, user.phoneVerifiedAt доступны
  
  // ... ваша логика
}
```

### Примеры для разных endpoints

#### 1. Отзывы о местах (✅ реализовано)

```typescript
// src/app/api/places/[id]/reviews/route.ts
export async function POST(request: NextRequest, context: RouteContext) {
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const user = userOrError;

  // Создать отзыв
  const review = await prisma.placeReview.create({
    data: {
      placeId: placeId,
      source: "MAMAGO",
      authorName: user.displayName || user.email,
      // ...
    },
  });
  
  return NextResponse.json({ success: true, data: review });
}
```

#### 2. Комментарии (⏳ будущее)

```typescript
// src/app/api/articles/[id]/comments/route.ts
export async function POST(request: NextRequest, context: RouteContext) {
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const user = userOrError;

  const { text } = await request.json();
  
  const comment = await prisma.comment.create({
    data: {
      articleId: articleId,
      userId: user.id,
      text: text,
      status: "PENDING", // Модерация
    },
  });
  
  return NextResponse.json({ success: true, data: comment });
}
```

#### 3. Сообщения бизнесу (⏳ будущее)

```typescript
// src/app/api/businesses/[id]/messages/route.ts
export async function POST(request: NextRequest, context: RouteContext) {
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const user = userOrError;

  const { subject, message } = await request.json();
  
  const businessMessage = await prisma.businessMessage.create({
    data: {
      businessId: businessId,
      userId: user.id,
      subject: subject,
      message: message,
      contactPhone: user.phoneE164, // Используем подтвержденный телефон
    },
  });
  
  return NextResponse.json({ success: true, data: businessMessage });
}
```

#### 4. Заявки/Бронирования (⏳ будущее)

```typescript
// src/app/api/bookings/route.ts
export async function POST(request: NextRequest) {
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const user = userOrError;

  const { activityId, date, timeSlot, participants } = await request.json();
  
  const booking = await prisma.booking.create({
    data: {
      activityId: activityId,
      userId: user.id,
      date: date,
      timeSlot: timeSlot,
      participants: participants,
      contactPhone: user.phoneE164, // Используем подтвержденный телефон
      status: "PENDING",
    },
  });
  
  return NextResponse.json({ success: true, data: booking });
}
```

#### 5. Жалобы (⏳ будущее)

```typescript
// src/app/api/reports/route.ts
export async function POST(request: NextRequest) {
  const userOrError = await requirePhoneVerifiedUser();
  if (userOrError instanceof NextResponse) return userOrError;
  const user = userOrError;

  const { entityType, entityId, reason, description } = await request.json();
  
  const report = await prisma.report.create({
    data: {
      entityType: entityType,
      entityId: entityId,
      userId: user.id,
      reason: reason,
      description: description,
      status: "PENDING",
    },
  });
  
  return NextResponse.json({ success: true, data: report });
}
```

## Frontend Integration

### Обработка ошибок на клиенте

```typescript
try {
  const response = await fetch('/api/places/123/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 5, text: 'Great place!' }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.error === 'UNAUTHORIZED') {
      // Открыть модальное окно авторизации
      openAuthModal();
      return;
    }
    
    if (data.error === 'PHONE_NOT_VERIFIED') {
      // Открыть модальное окно подтверждения телефона
      openPhoneVerificationModal();
      return;
    }
    
    throw new Error(data.message);
  }

  // Успех
  showSuccessMessage();
} catch (error) {
  showErrorMessage(error.message);
}
```

### Компоненты для verification flow

1. **AuthModal** - `src/components/auth/DefaultAuthModal.tsx`
   - Используется для авторизации
   - После успеха автоматически повторяет действие

2. **PhoneVerificationModal** - `src/components/place/PhoneVerificationModal.tsx`
   - Используется для подтверждения телефона
   - Двухшаговый процесс: ввод номера → ввод OTP
   - После успеха автоматически повторяет действие

## Phone Verification Flow

### 1. Отправка OTP
```
POST /api/settings/phone/send-otp
Body: { phone: "+375291234567" }

Response: {
  success: true,
  phoneE164: "+375291234567",
  resendAfterSec: 60
}
```

### 2. Проверка OTP
```
POST /api/settings/phone/verify
Body: { phone: "+375291234567", code: "1234" }

Response: {
  success: true,
  phoneE164: "+375291234567"
}
```

После успешной проверки:
- `user.phoneE164` = "+375291234567"
- `user.phoneVerifiedAt` = текущая дата/время

## Безопасность

### Rate Limiting
- OTP отправка: максимум 1 раз в 60 секунд
- OTP проверка: максимум 3 попытки, затем блокировка
- Блокировка: эскалация (1 мин → 5 мин → 15 мин → support)

### Валидация
- Телефон должен быть в формате E.164
- OTP код: 4 цифры
- Время жизни OTP: 10 минут

### Хранение
- OTP коды хранятся в `PhoneOtp` таблице
- Хешируются перед сохранением
- Автоматически удаляются после истечения

## Тестирование

### Unit Tests
```typescript
describe('requirePhoneVerifiedUser', () => {
  it('should return 401 if user not authenticated', async () => {
    // Mock getCurrentUser to return null
    const result = await requirePhoneVerifiedUser();
    expect(result).toBeInstanceOf(NextResponse);
    expect(result.status).toBe(401);
  });

  it('should return 403 if phone not verified', async () => {
    // Mock getCurrentUser to return user without phoneVerifiedAt
    const result = await requirePhoneVerifiedUser();
    expect(result).toBeInstanceOf(NextResponse);
    expect(result.status).toBe(403);
  });

  it('should return user if phone verified', async () => {
    // Mock getCurrentUser to return user with phoneVerifiedAt
    const result = await requirePhoneVerifiedUser();
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result.phoneVerifiedAt).toBeTruthy();
  });
});
```

### Integration Tests
```typescript
describe('POST /api/places/[id]/reviews', () => {
  it('should require authentication', async () => {
    const response = await fetch('/api/places/123/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 5, text: 'Great!' }),
    });
    expect(response.status).toBe(401);
  });

  it('should require phone verification', async () => {
    // Login as user without phone verification
    const response = await fetch('/api/places/123/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 5, text: 'Great!' }),
    });
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('PHONE_NOT_VERIFIED');
  });

  it('should create review if phone verified', async () => {
    // Login as user with phone verification
    const response = await fetch('/api/places/123/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: 5, text: 'Great!' }),
    });
    expect(response.status).toBe(200);
  });
});
```

## Миграция существующих пользователей

Пользователи, зарегистрированные до внедрения phone verification:
- Могут продолжать использовать приложение
- При первой попытке UGC-действия увидят phone verification modal
- После подтверждения телефона получат полный доступ

## Мониторинг

### Метрики для отслеживания
- Количество попыток UGC без phone verification
- Conversion rate: phone verification modal → verified
- Время до завершения phone verification
- Количество неудачных OTP попыток
- Количество блокировок

### Логирование
```typescript
console.log('[ugc-action] Phone verification required', {
  userId: user.id,
  action: 'create_review',
  hasPhone: !!user.phoneE164,
  phoneVerified: !!user.phoneVerifiedAt,
});
```

## FAQ

### Q: Почему не требуем телефон при регистрации?
A: Чтобы снизить барьер входа. Пользователь может зарегистрироваться быстро, а телефон подтвердить только когда захочет оставить контент.

### Q: Что если пользователь не хочет подтверждать телефон?
A: Он может продолжать использовать приложение для просмотра контента, но не сможет создавать UGC.

### Q: Можно ли изменить телефон после подтверждения?
A: Да, в настройках профиля. При изменении потребуется новое подтверждение.

### Q: Что если телефон уже используется другим пользователем?
A: Поле `phoneE164` имеет `@unique` constraint. API вернет ошибку "Phone already in use".

### Q: Нужно ли повторно подтверждать телефон?
A: Нет, подтверждение действует бессрочно (пока пользователь не изменит номер).

## Roadmap

- [x] Создать helper `requirePhoneVerifiedUser()`
- [x] Применить в API отзывов
- [ ] Применить в API комментариев
- [ ] Применить в API сообщений бизнесу
- [ ] Применить в API бронирований
- [ ] Применить в API жалоб
- [ ] Добавить аналитику conversion rate
- [ ] Добавить A/B тесты разных текстов в modal
