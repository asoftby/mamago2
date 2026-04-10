# 🚀 Быстрое исправление: Email не отправляется

## Проблема
После регистрации verify email не приходит.

## Причины (обе исправлены)

1. ✅ `EMAIL_ENABLED` не был установлен в `true`
2. ✅ Домен `send.mamago.by` не верифицирован в Resend

## Быстрое решение (уже применено)

### В `.env.local` установлено:

```bash
EMAIL_ENABLED=true
RESEND_API_KEY=re_c5XCxVwh_JuQ3utb6FHecwzFkmiFoYF1b
# Используется тестовый домен Resend для разработки
EMAIL_FROM="mamaGo <onboarding@resend.dev>"
EMAIL_REPLY_TO=hello@mamago.by
```

### ⚠️ Важно для тестирования

Тестовый домен `onboarding@resend.dev` отправляет письма **только на email, зарегистрированный в Resend**.

**Решение**: Добавьте в `.env.local`:

```bash
EMAIL_DEBUG_REDIRECT_TO=your-resend-account-email@example.com
```

Все письма будут приходить на этот адрес.

## Проверка

Зарегистрируйте тестового пользователя и проверьте логи:

```
✅ [auth] user registered successfully
✅ [auth] sendRegistrationVerificationEmail called
✅ [email] sendVerifyEmail called
✅ [email] sent { messageId: '...' }
✅ [auth] verification email sent successfully
```

## Для production

Верифицируйте домен `send.mamago.by` в Resend:

1. https://resend.com/domains → Add Domain
2. Добавьте DNS записи (SPF, DKIM, DMARC)
3. Дождитесь верификации
4. Измените `EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"`

Подробнее: `RESEND_DOMAIN_FIX.md`

---

Подробная документация: `EMAIL_VERIFICATION_FIX.md`
