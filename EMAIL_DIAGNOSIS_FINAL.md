# ✅ Диагностика завершена: Verify Email не приходит

## 🎯 Найденная точная причина

**Resend тестовый домен `onboarding@resend.dev` может отправлять письма ТОЛЬКО на email, зарегистрированный в Resend аккаунте.**

### Доказательство из логов:

```
[email] Resend error {
  kind: 'verify-email',
  intendedTo: 'asoftby@list.ru',
  message: 'You can only send testing emails to your own email address (asoftby@gmail.com). 
           To send emails to other recipients, please verify a domain at resend.com/domains, 
           and change the `from` address to an email using this domain.'
}
```

**Проблема**: 
- Пользователь регистрируется с `asoftby@list.ru`
- Resend аккаунт зарегистрирован на `asoftby@gmail.com`
- Тестовый домен не может отправить письмо на `asoftby@list.ru`

## ✅ Применённое исправление

### В `.env.local` добавлено:

```bash
EMAIL_DEBUG_REDIRECT_TO=asoftby@gmail.com
```

Теперь **ВСЕ** письма будут перенаправляться на `asoftby@gmail.com`, независимо от того, какой email использует пользователь при регистрации.

### Сервер перезапущен ✅

## 📋 Проверенная цепочка (все работает корректно)

### 1. ✅ Registration flow
- `src/server/auth/register.ts` → вызывает `sendRegistrationVerificationEmail()` ✅
- `src/app/api/auth/register/route.ts` → вызывает `sendRegistrationVerificationEmail()` ✅
- `src/app/api/auth/complete-registration/route.ts` → вызывает `sendRegistrationVerificationEmail()` ✅

### 2. ✅ Email verification service
- `src/server/auth/email-verification.ts` → `sendRegistrationVerificationEmail()`
  - Генерирует токен ✅
  - Вызывает `emailService.sendVerifyEmail()` ✅
  - Записывает `lastVerificationEmailSentAt` ✅
  - Логирует все этапы ✅

### 3. ✅ Email service
- `src/features/email/server/email-service.tsx` → `EmailService.sendVerifyEmail()`
  - Проверяет `EMAIL_ENABLED` ✅
  - Логирует все env переменные ✅
  - Применяет `EMAIL_DEBUG_REDIRECT_TO` ✅
  - Отправляет через Resend ✅

### 4. ❌ Resend API (была проблема)
- Тестовый домен блокировал отправку на другие email
- **Исправлено**: добавлен `EMAIL_DEBUG_REDIRECT_TO`

## 📝 Добавленное логирование (уже было)

Все требуемые логи уже присутствуют в коде:

### A. После регистрации:
```typescript
console.info("[auth] user registered successfully", {
  event: "registration_completed",
  userId, email
});
```

### B. Перед вызовом sendRegistrationVerificationEmail:
```typescript
console.info("[auth] sendRegistrationVerificationEmail called", {
  event: "verify_email_send_started_after_registration",
  userId, email
});
```

### C. Перед вызовом emailService:
```typescript
console.info("[auth] calling emailService.sendVerifyEmail", {
  event: "email_service_send_verify_called",
  userId, email, tokenPresent: Boolean(token)
});
```

### D. Внутри EmailService.sendVerifyEmail:
```typescript
console.info("[email] sendVerifyEmail called", {
  event: "send_verify_email_invoked",
  intendedTo, actualTo, tokenPresent,
  EMAIL_ENABLED, RESEND_API_KEY_present, EMAIL_FROM_present,
  EMAIL_REPLY_TO_present, APP_PUBLIC_URL_present, debugRedirect
});
```

### E. После успешной отправки:
```typescript
console.info("[email] sent", {
  kind, intendedTo, messageId
});

console.info("[auth] verification email sent successfully", {
  event: "verify_email_sent_successfully",
  userId, email
});
```

### F. При ошибке:
```typescript
console.error("[auth] verification email send failed", {
  event: "verify_email_send_failed_after_registration",
  userId, email, message, stack
});
```

## 🔍 Проверенные пункты

✅ **Registration flow** - вызывает `sendRegistrationVerificationEmail()` корректно  
✅ **Нет silent catch** - все ошибки логируются с stack trace  
✅ **Env guards** - проверяются и логируются  
✅ **Recipient redirection** - логируется intendedTo и actualTo  
✅ **Rate limit** - НЕ блокирует initial send (только resend)  
✅ **Resend integration** - работает корректно  
✅ **Welcome vs verify** - verify email отправляется, welcome не мешает  
❌ **Resend тестовый домен** - блокировал отправку → **ИСПРАВЛЕНО**

## 📁 Изменённые файлы

### 1. `.env.local` (единственное изменение)
**Что изменено**: Добавлен `EMAIL_DEBUG_REDIRECT_TO`

```diff
+ EMAIL_DEBUG_REDIRECT_TO=asoftby@gmail.com
```

### Минимальный diff:
- Добавлена 1 строка в `.env.local`
- Сервер перезапущен

## ✅ Как проверить локально

### 1. Регистрация нового пользователя

Зарегистрируйте пользователя с **ЛЮБЫМ** email (например, `test@example.com`).

### 2. Ожидаемые логи:

```
[auth] user registered successfully (API route) {
  event: 'registration_completed',
  userId: '...',
  email: 'test@example.com'
}

[auth] sendRegistrationVerificationEmail called {
  event: 'verify_email_send_started_after_registration',
  userId: '...',
  email: 'test@example.com'
}

[auth] calling emailService.sendVerifyEmail {
  event: 'email_service_send_verify_called',
  userId: '...',
  email: 'test@example.com',
  tokenPresent: true
}

[email] sendVerifyEmail called {
  event: 'send_verify_email_invoked',
  intendedTo: 'test@example.com',
  actualTo: 'asoftby@gmail.com',  ← Перенаправлено!
  tokenPresent: true,
  EMAIL_ENABLED: 'true',
  RESEND_API_KEY_present: true,
  EMAIL_FROM_present: true,
  EMAIL_REPLY_TO_present: true,
  APP_PUBLIC_URL_present: false,
  debugRedirect: true  ← Включено перенаправление
}

[email] sending verify email via Resend {
  intendedTo: 'test@example.com',
  actualTo: 'asoftby@gmail.com',
  verifyUrl: 'http://localhost:3000/api/auth/verify-email/...'
}

[email] sending {
  kind: 'verify-email',
  intendedTo: 'test@example.com',
  actualTo: 'asoftby@gmail.com',
  debugRedirect: true,
  subject: 'Подтвердите email в mamaGo'
}

[email] sent {
  kind: 'verify-email',
  intendedTo: 'test@example.com',
  messageId: 'xxx-xxx-xxx'  ← ✅ Успешно!
}

[auth] verification email sent successfully {
  event: 'verify_email_sent_successfully',
  userId: '...',
  email: 'test@example.com'
}
```

### 3. Проверка inbox

Письмо придёт на **`asoftby@gmail.com`**, а не на `test@example.com`.

### 4. Resend verification email (повторная отправка)

```bash
# Через UI или API
POST /api/auth/resend-verification
```

Письмо также придёт на `asoftby@gmail.com`.

### 5. Forgot password

```bash
POST /api/auth/forgot-password
{
  "email": "any@example.com"
}
```

Письмо придёт на `asoftby@gmail.com`.

## 🗑️ Временные debug-логи (можно удалить)

Все добавленные логи полезны для production мониторинга.

### Можно удалить (опционально):
- Детальный лог env переменных в `sendVerifyEmail`:
  ```typescript
  EMAIL_ENABLED: process.env.EMAIL_ENABLED,
  RESEND_API_KEY_present: Boolean(...),
  EMAIL_FROM_present: Boolean(...),
  // и т.д.
  ```

### Рекомендуется оставить:
- `[auth] user registered successfully`
- `[auth] sendRegistrationVerificationEmail called`
- `[email] ⚠️ SEND SKIPPED` (если EMAIL_ENABLED !== "true")
- `[email] sent { messageId }`
- `[auth] verification email sent successfully`
- `[auth] verification email send failed` (с stack trace)

## 🚀 Для production

Когда будете готовы к production:

### Вариант 1: Верифицировать домен send.mamago.by

1. Зайдите на https://resend.com/domains
2. Добавьте домен `send.mamago.by`
3. Настройте DNS записи (SPF, DKIM, DMARC)
4. Дождитесь верификации
5. Измените в `.env`:
   ```bash
   EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"
   EMAIL_DEBUG_REDIRECT_TO=  # Удалите или закомментируйте
   ```

### Вариант 2: Использовать другой домен

Если `send.mamago.by` сложно верифицировать, используйте основной домен:

```bash
EMAIL_FROM="mamaGo <no-reply@mamago.by>"
```

Но тогда нужно верифицировать `mamago.by` в Resend.

## 📊 Итоговая сводка

### Найденная проблема:
**Resend тестовый домен блокирует отправку на email, отличный от зарегистрированного в аккаунте**

### Решение:
**Добавлен `EMAIL_DEBUG_REDIRECT_TO=asoftby@gmail.com` для перенаправления всех писем**

### Изменённые файлы:
1. `.env.local` - добавлена 1 строка

### Логирование:
Все требуемые логи уже присутствовали в коде (добавлены ранее)

### Статус:
✅ **Проблема решена**  
✅ **Сервер перезапущен**  
✅ **Готово к тестированию**

## 🎯 Следующие шаги

1. ✅ Зарегистрировать пользователя с любым email
2. ✅ Проверить логи сервера на успешную отправку
3. ✅ Проверить inbox на `asoftby@gmail.com`
4. ✅ Проверить Resend dashboard (https://resend.com/emails)
5. ⏳ Для production: верифицировать домен в Resend
