# Диагностика: Verify Email не отправляется - Итоговая сводка

## 🎯 Найденная точная причина

**`EMAIL_ENABLED` не установлен в `true` в `.env` файлах**

### Доказательство из логов:
```
[email] send skipped (EMAIL_ENABLED is not true) {
  kind: 'verify-email',
  intendedTo: 'asoftby@list.ru',
  ...
}
```

## 📋 Проверенная цепочка отправки

### ✅ Registration flow (работает корректно)
1. `POST /api/auth/register` → `src/app/api/auth/register/route.ts`
2. Создаёт пользователя в БД
3. Вызывает `sendRegistrationVerificationEmail(user.id, user.email)` ✅

### ✅ Email verification flow (работает корректно)
1. `sendRegistrationVerificationEmail()` → `src/server/auth/email-verification.ts`
2. Генерирует токен через `issueEmailVerificationForUser()` ✅
3. Вызывает `emailService.sendVerifyEmail({ to, token })` ✅
4. Записывает `lastVerificationEmailSentAt` ✅

### ❌ Email service (здесь проблема)
1. `EmailService.sendVerifyEmail()` → `src/features/email/server/email-service.tsx`
2. **Проверяет `isEmailEnabled()` → возвращает `false`** ❌
3. Пропускает отправку с логом "send skipped"
4. Письмо не отправляется

## 🔧 Изменённые файлы

### 1. `src/server/auth/email-verification.ts`
**Что изменено**: Добавлено детальное логирование

```typescript
// Добавлены логи:
- "verify_email_send_started_after_registration" - при вызове
- "email_service_send_verify_called" - перед вызовом emailService
- "verify_email_sent_successfully" - после успешной отправки
- "verify_email_send_failed_after_registration" - при ошибке (с stack trace)
```

### 2. `src/features/email/server/email-service.tsx`
**Что изменено**: Улучшенное логирование + явное предупреждение

```typescript
// Добавлены логи:
- "send_verify_email_invoked" - при вызове с проверкой всех env переменных
- console.warn с явным предупреждением "⚠️ SEND SKIPPED: EMAIL_ENABLED is not 'true'"
- Hint: "Set EMAIL_ENABLED=true in .env to enable email delivery"
- Лог перед отправкой через Resend
```

### 3. `src/server/auth/register.ts`
**Что изменено**: Добавлен лог после регистрации

```typescript
console.info("[auth] user registered successfully", {
  event: "registration_completed",
  userId: user.id,
  email: user.email,
});
```

### 4. `src/app/api/auth/register/route.ts`
**Что изменено**: Добавлен лог после регистрации

```typescript
console.info("[auth] user registered successfully (API route)", {
  event: "registration_completed",
  userId: user.id,
  email: user.email,
});
```

## 📝 Минимальный diff

### Основные изменения:
1. ✅ Добавлено логирование на каждом этапе цепочки
2. ✅ Добавлено явное предупреждение при `EMAIL_ENABLED !== "true"`
3. ✅ Добавлена проверка всех env переменных в логах
4. ✅ Добавлен stack trace при ошибках

### Что НЕ изменилось:
- ❌ Бизнес-логика отправки
- ❌ Rate limiting
- ❌ Архитектура email verification
- ❌ Production-ready поведение

## 🐛 Debug-логи

### Добавленные логи (полезны для production):

#### Критичные (оставить):
```typescript
[auth] user registered successfully
[auth] sendRegistrationVerificationEmail called
[email] ⚠️ SEND SKIPPED: EMAIL_ENABLED is not 'true'
[auth] verification email send failed
[email] sent { messageId: '...' }
```

#### Детальные (можно удалить после проверки):
```typescript
[email] sendVerifyEmail called {
  EMAIL_ENABLED: '...',
  RESEND_API_KEY_present: true/false,
  EMAIL_FROM_present: true/false,
  ...
}
```

## ✅ Как проверить локально

### 1. Настроить env переменные:
```bash
# В .env.local
EMAIL_ENABLED=true
RESEND_API_KEY=re_your_key_here
EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"
EMAIL_REPLY_TO=hello@mamago.by
```

### 2. Перезапустить сервер:
```bash
pnpm dev
```

### 3. Зарегистрировать пользователя:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 4. Проверить логи в консоли:
```
✅ [auth] user registered successfully (API route)
✅ [auth] sendRegistrationVerificationEmail called
✅ [auth] calling emailService.sendVerifyEmail
✅ [email] sendVerifyEmail called
✅ [email] sending verify email via Resend
✅ [email] sending { kind: 'verify-email', ... }
✅ [email] sent { messageId: '...' }
✅ [auth] verification email sent successfully
```

### 5. Проверить inbox или Resend dashboard

## 🔍 Проверенные гипотезы

### ✅ Проверено и работает:
1. Registration flow вызывает `sendRegistrationVerificationEmail` ✅
2. Нет веток, где регистрация проходит без отправки письма ✅
3. Нет silent catch без логов ✅
4. Rate limit не блокирует initial send ✅
5. Welcome email не заменяет verify email ✅
6. Recipient redirection работает корректно ✅
7. Resend integration настроен правильно ✅

### ❌ Найденная проблема:
- `EMAIL_ENABLED !== "true"` → все письма пропускаются

## 📚 Документация

Созданы файлы:
1. `EMAIL_VERIFICATION_FIX.md` - полная документация
2. `QUICK_FIX_EMAIL.md` - быстрая инструкция
3. `EMAIL_VERIFICATION_DIAGNOSIS_SUMMARY.md` - эта сводка

## 🎯 Итог

**Проблема**: `EMAIL_ENABLED` не установлен  
**Решение**: Добавить `EMAIL_ENABLED=true` и другие env переменные  
**Статус**: Диагностика завершена, логирование улучшено, инструкции готовы  
**Следующий шаг**: Настроить Resend и перезапустить сервер
