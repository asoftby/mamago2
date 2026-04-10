# Диагностика и исправление: Verify Email не отправляется после регистрации

## Найденная проблема

**Причина**: `EMAIL_ENABLED` не установлен в `true` в `.env` файлах, поэтому все письма пропускаются.

### Доказательство из логов сервера:

```
[email] send skipped (EMAIL_ENABLED is not true) {
  kind: 'verify-email',
  intendedTo: 'asoftby@list.ru',
  actualTo: 'asoftby@list.ru',
  debugRedirect: false,
  verifyUrl: 'http://localhost:3000/api/auth/verify-email/94227189-b360-4755-8aa4-9efe20e6445e',
  subject: 'Подтвердите email в mamaGo'
}
```

## Цепочка отправки verify email

### 1. Registration flow
- `src/app/api/auth/register/route.ts` → создаёт пользователя
- `src/server/auth/register.ts` → создаёт пользователя (альтернативный путь)
- `src/app/api/auth/complete-registration/route.ts` → завершает регистрацию

### 2. Email verification flow
- `src/server/auth/email-verification.ts` → `sendRegistrationVerificationEmail()`
  - Генерирует токен через `issueEmailVerificationForUser()`
  - Вызывает `emailService.sendVerifyEmail()`
  - Записывает `lastVerificationEmailSentAt`

### 3. Email service
- `src/features/email/server/email-service.tsx` → `EmailService.sendVerifyEmail()`
  - **Проверяет `EMAIL_ENABLED === "true"`** ← ЗДЕСЬ ПРОБЛЕМА
  - Если не true → пропускает отправку с логом
  - Если true → отправляет через Resend

## Исправление

### Шаг 1: Добавить переменные окружения

Добавьте в `.env.local` (или `.env`):

```bash
# Email delivery (Resend)
EMAIL_ENABLED=true
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"
EMAIL_REPLY_TO=hello@mamago.by

# Optional: redirect all emails to test address in development
# EMAIL_DEBUG_REDIRECT_TO=your-test-email@example.com
```

### Шаг 2: Получить Resend API Key

1. Зайдите на https://resend.com/
2. Создайте аккаунт или войдите
3. Перейдите в API Keys
4. Создайте новый API key
5. Скопируйте и вставьте в `RESEND_API_KEY`

### Шаг 3: Верифицировать домен в Resend

1. В Resend перейдите в Domains
2. Добавьте домен `send.mamago.by` (или ваш домен)
3. Добавьте DNS записи (SPF, DKIM, DMARC)
4. Дождитесь верификации

### Шаг 4: Перезапустить сервер

```bash
# Остановить текущий сервер (Ctrl+C)
pnpm dev
```

## Добавленное логирование

### В `src/server/auth/email-verification.ts`:

```typescript
// При вызове sendRegistrationVerificationEmail
console.info("[auth] sendRegistrationVerificationEmail called", {
  event: "verify_email_send_started_after_registration",
  userId,
  email,
});

// Перед вызовом emailService
console.info("[auth] calling emailService.sendVerifyEmail", {
  event: "email_service_send_verify_called",
  userId,
  email,
  tokenPresent: Boolean(issued.token),
});

// После успешной отправки
console.info("[auth] verification email sent successfully", {
  event: "verify_email_sent_successfully",
  userId,
  email,
});

// При ошибке
console.error("[auth] verification email send failed", {
  event: "verify_email_send_failed_after_registration",
  userId,
  email,
  message,
  stack,
});
```

### В `src/features/email/server/email-service.tsx`:

```typescript
// При вызове sendVerifyEmail
console.info("[email] sendVerifyEmail called", {
  event: "send_verify_email_invoked",
  intendedTo: params.to,
  actualTo,
  tokenPresent: Boolean(params.token),
  EMAIL_ENABLED: process.env.EMAIL_ENABLED,
  RESEND_API_KEY_present: Boolean(process.env.RESEND_API_KEY?.trim()),
  EMAIL_FROM_present: Boolean(process.env.EMAIL_FROM?.trim()),
  EMAIL_REPLY_TO_present: Boolean(process.env.EMAIL_REPLY_TO?.trim()),
  APP_PUBLIC_URL_present: Boolean(process.env.APP_PUBLIC_URL?.trim()),
  debugRedirect: Boolean(debugTo),
});

// Если EMAIL_ENABLED !== "true"
console.warn("[email] ⚠️ SEND SKIPPED: EMAIL_ENABLED is not 'true'", {
  kind: "verify-email",
  intendedTo: params.to,
  actualTo,
  debugRedirect: Boolean(debugTo),
  verifyUrl: verifyUrl ?? "(задайте APP_PUBLIC_URL для полной ссылки)",
  subject: EMAIL_SUBJECTS.verifyEmail,
  hint: "Set EMAIL_ENABLED=true in .env to enable email delivery",
});
```

### В `src/server/auth/register.ts` и `src/app/api/auth/register/route.ts`:

```typescript
// После создания пользователя
console.info("[auth] user registered successfully", {
  event: "registration_completed",
  userId: user.id,
  email: user.email,
});
```

## Изменённые файлы

1. ✅ `src/server/auth/email-verification.ts` - улучшенное логирование
2. ✅ `src/features/email/server/email-service.tsx` - улучшенное логирование + явное предупреждение
3. ✅ `src/server/auth/register.ts` - лог после регистрации
4. ✅ `src/app/api/auth/register/route.ts` - лог после регистрации

## Как проверить локально

### 1. Регистрация нового пользователя

```bash
# В браузере или через curl
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Ожидаемые логи в консоли сервера:**

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
  actualTo: 'test@example.com',
  tokenPresent: true,
  EMAIL_ENABLED: 'true',
  RESEND_API_KEY_present: true,
  EMAIL_FROM_present: true,
  EMAIL_REPLY_TO_present: true,
  APP_PUBLIC_URL_present: true,
  debugRedirect: false
}
[email] sending verify email via Resend {
  intendedTo: 'test@example.com',
  actualTo: 'test@example.com',
  verifyUrl: 'http://localhost:3000/api/auth/verify-email/...'
}
[email] sending {
  kind: 'verify-email',
  intendedTo: 'test@example.com',
  actualTo: 'test@example.com',
  debugRedirect: false,
  subject: 'Подтвердите email в mamaGo'
}
[email] sent {
  kind: 'verify-email',
  intendedTo: 'test@example.com',
  messageId: 'xxx-xxx-xxx'
}
[auth] verification email sent successfully {
  event: 'verify_email_sent_successfully',
  userId: '...',
  email: 'test@example.com'
}
```

### 2. Resend verification email

```bash
# Через API (требуется авторизация)
curl -X POST http://localhost:3000/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{}'
```

### 3. Forgot password

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Временные debug-логи (можно удалить после проверки)

Все добавленные `console.info` и `console.warn` логи полезны для production мониторинга, но если нужно убрать детальность:

### Можно удалить:
- Детальный лог env переменных в `sendVerifyEmail` (строка с `EMAIL_ENABLED`, `RESEND_API_KEY_present` и т.д.)
- Можно оставить только ключевые события: `registration_completed`, `verify_email_sent_successfully`, `verify_email_send_failed`

### Рекомендуется оставить:
- `[email] ⚠️ SEND SKIPPED` - важное предупреждение для диагностики
- `[auth] verification email send failed` - критичная ошибка
- `[email] sent` - подтверждение успешной отправки

## Rate limiting

**Важно**: Initial письмо после регистрации НЕ блокируется rate limit.

Rate limit (`VERIFICATION_EMAIL_RESEND_COOLDOWN_MS = 60_000`) применяется только к:
- `resendVerificationEmailForUser()` - повторная отправка

Первичная отправка через `sendRegistrationVerificationEmail()` всегда проходит (если email не верифицирован).

## Recipient redirection (для тестирования)

Если установлен `EMAIL_DEBUG_REDIRECT_TO`, все письма будут отправляться на этот адрес:

```bash
# В .env.local
EMAIL_DEBUG_REDIRECT_TO=your-test-email@example.com
```

Это полезно для тестирования без спама на реальные адреса.

## Проверка в Resend Dashboard

После отправки письма:
1. Зайдите в https://resend.com/emails
2. Найдите отправленное письмо
3. Проверьте статус (Delivered / Bounced / etc.)
4. Посмотрите детали (recipient, subject, timestamp)

## Итоговая диагностика

### ✅ Проверено:
1. Registration flow вызывает `sendRegistrationVerificationEmail` ✅
2. `sendRegistrationVerificationEmail` вызывает `emailService.sendVerifyEmail` ✅
3. Нет silent catch без логов ✅
4. Rate limit не блокирует initial send ✅
5. Welcome email не заменяет verify email ✅

### ❌ Найденная проблема:
- `EMAIL_ENABLED` не установлен в `true` → все письма пропускаются

### ✅ Исправление:
- Добавлены улучшенные логи для диагностики
- Добавлено явное предупреждение при `EMAIL_ENABLED !== "true"`
- Документированы все необходимые env переменные
- Инструкции по настройке Resend

## Следующие шаги

1. Добавить переменные в `.env.local`
2. Получить Resend API key
3. Верифицировать домен в Resend
4. Перезапустить сервер
5. Зарегистрировать тестового пользователя
6. Проверить логи
7. Проверить inbox
8. Проверить Resend dashboard
