# Email Verification Flow - Диаграмма

## Текущий flow (с найденной проблемой)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Registration                                            │
│    POST /api/auth/register                                      │
│    ↓                                                            │
│    src/app/api/auth/register/route.ts                          │
│    ✅ Creates user in DB                                        │
│    ✅ Calls sendRegistrationVerificationEmail()                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Email Verification Service                                   │
│    src/server/auth/email-verification.ts                       │
│    ↓                                                            │
│    sendRegistrationVerificationEmail(userId, email)            │
│    ✅ Generates token via issueEmailVerificationForUser()       │
│    ✅ Calls emailService.sendVerifyEmail({ to, token })         │
│    ✅ Records lastVerificationEmailSentAt                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Email Service                                                │
│    src/features/email/server/email-service.tsx                 │
│    ↓                                                            │
│    EmailService.sendVerifyEmail({ to, token })                 │
│    ↓                                                            │
│    ❌ Checks: isEmailEnabled()                                  │
│       → EMAIL_ENABLED === "true" ?                             │
│       → NO ❌                                                   │
│    ↓                                                            │
│    ⚠️  SKIPS SEND                                               │
│    📝 Logs: "send skipped (EMAIL_ENABLED is not true)"         │
│    ↓                                                            │
│    ❌ Email NOT sent                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Исправленный flow (после настройки)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Registration                                            │
│    POST /api/auth/register                                      │
│    ↓                                                            │
│    src/app/api/auth/register/route.ts                          │
│    ✅ Creates user in DB                                        │
│    📝 Logs: "registration_completed"                            │
│    ✅ Calls sendRegistrationVerificationEmail()                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Email Verification Service                                   │
│    src/server/auth/email-verification.ts                       │
│    ↓                                                            │
│    sendRegistrationVerificationEmail(userId, email)            │
│    📝 Logs: "verify_email_send_started_after_registration"      │
│    ↓                                                            │
│    ✅ Generates token via issueEmailVerificationForUser()       │
│    📝 Logs: "email_service_send_verify_called"                  │
│    ↓                                                            │
│    ✅ Calls emailService.sendVerifyEmail({ to, token })         │
│    ↓                                                            │
│    ✅ Records lastVerificationEmailSentAt                       │
│    📝 Logs: "verify_email_sent_successfully"                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Email Service                                                │
│    src/features/email/server/email-service.tsx                 │
│    ↓                                                            │
│    EmailService.sendVerifyEmail({ to, token })                 │
│    📝 Logs: "send_verify_email_invoked" + env check            │
│    ↓                                                            │
│    ✅ Checks: isEmailEnabled()                                  │
│       → EMAIL_ENABLED === "true" ?                             │
│       → YES ✅                                                  │
│    ↓                                                            │
│    ✅ Builds verifyUrl                                          │
│    📝 Logs: "sending verify email via Resend"                   │
│    ↓                                                            │
│    ✅ Calls sendViaResend()                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Resend API                                                   │
│    src/features/email/server/email-service.tsx                 │
│    ↓                                                            │
│    sendViaResend("verify-email", to, subject, react)           │
│    ↓                                                            │
│    ✅ Validates env: RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO │
│    📝 Logs: "sending" { kind, intendedTo, actualTo }            │
│    ↓                                                            │
│    ✅ Calls resend.emails.send()                                │
│    ↓                                                            │
│    ✅ Email sent successfully                                   │
│    📝 Logs: "sent" { messageId }                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. User receives email                                          │
│    ✅ Opens inbox                                               │
│    ✅ Clicks verify link                                        │
│    ✅ GET /api/auth/verify-email/:token                         │
│    ✅ Email verified                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Ключевые точки логирования

```
[auth] user registered successfully
  ↓
[auth] sendRegistrationVerificationEmail called
  ↓
[auth] calling emailService.sendVerifyEmail
  ↓
[email] sendVerifyEmail called
  ↓
[email] sending verify email via Resend
  ↓
[email] sending { kind: 'verify-email', ... }
  ↓
[email] sent { messageId: '...' }
  ↓
[auth] verification email sent successfully
```

## Точка поломки (найдена)

```
[email] sendVerifyEmail called
  ↓
❌ isEmailEnabled() returns false
  ↓
⚠️  [email] send skipped (EMAIL_ENABLED is not true)
  ↓
❌ Email NOT sent
```

## Исправление

```bash
# В .env.local
EMAIL_ENABLED=true  # ← Это исправляет проблему
RESEND_API_KEY=re_...
EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"
EMAIL_REPLY_TO=hello@mamago.by
```

## Rate Limiting (работает корректно)

```
Initial send (registration):
  ✅ NO rate limit
  ✅ Always sends (if EMAIL_ENABLED=true)

Resend (manual):
  ✅ Rate limit: 60 seconds
  ✅ Checks lastVerificationEmailSentAt
  ❌ Blocks if < 60s since last send
```

## Debug Redirect (опционально)

```bash
# В .env.local
EMAIL_DEBUG_REDIRECT_TO=test@example.com

# Результат:
intendedTo: user@example.com
actualTo: test@example.com  # ← Все письма идут сюда
```
