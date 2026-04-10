# Исправление: Домен не верифицирован в Resend

## Проблема

Письма не отправляются из-за ошибки:

```
[email] Resend error {
  message: 'The send.mamago.by domain is not verified. 
           Please, add and verify your domain on https://resend.com/domains'
}
```

## Причина

Домен `send.mamago.by` используется в `EMAIL_FROM`, но не верифицирован в Resend.

## Решение 1: Использовать тестовый домен Resend (быстро, для разработки)

### ✅ Уже применено в `.env.local`:

```bash
EMAIL_FROM="mamaGo <onboarding@resend.dev>"
```

**Преимущества:**
- ✅ Работает сразу, без настройки DNS
- ✅ Идеально для разработки и тестирования
- ✅ Не требует верификации домена

**Ограничения:**
- ⚠️ Можно отправлять только на email, который зарегистрирован в Resend
- ⚠️ Не подходит для production

### Как тестировать:

1. Зарегистрируйте пользователя с email, который совпадает с вашим Resend аккаунтом
2. Или используйте `EMAIL_DEBUG_REDIRECT_TO`:

```bash
# В .env.local
EMAIL_DEBUG_REDIRECT_TO=your-resend-account-email@example.com
```

3. Перезапустите сервер (уже сделано)
4. Зарегистрируйте пользователя
5. Проверьте inbox

## Решение 2: Верифицировать домен в Resend (для production)

### Шаг 1: Добавить домен в Resend

1. Зайдите на https://resend.com/domains
2. Нажмите "Add Domain"
3. Введите `send.mamago.by`
4. Нажмите "Add"

### Шаг 2: Настроить DNS записи

Resend покажет DNS записи, которые нужно добавить:

#### SPF запись:
```
Type: TXT
Name: send.mamago.by
Value: v=spf1 include:_spf.resend.com ~all
```

#### DKIM записи (3 записи):
```
Type: TXT
Name: resend._domainkey.send.mamago.by
Value: [значение из Resend]

Type: TXT
Name: resend2._domainkey.send.mamago.by
Value: [значение из Resend]

Type: TXT
Name: resend3._domainkey.send.mamago.by
Value: [значение из Resend]
```

#### DMARC запись (опционально, но рекомендуется):
```
Type: TXT
Name: _dmarc.send.mamago.by
Value: v=DMARC1; p=none; rua=mailto:dmarc@mamago.by
```

### Шаг 3: Добавить записи в DNS провайдере

1. Зайдите в панель управления DNS вашего домена (например, Cloudflare, AWS Route53, etc.)
2. Добавьте все записи из Resend
3. Сохраните изменения

### Шаг 4: Дождаться верификации

- DNS изменения могут занять от нескольких минут до 48 часов
- Resend автоматически проверит записи
- Статус домена изменится на "Verified"

### Шаг 5: Обновить .env.local

После верификации домена:

```bash
EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"
```

### Шаг 6: Перезапустить сервер

```bash
pnpm dev
```

## Проверка отправки

### Ожидаемые логи (успешная отправка):

```
[auth] user registered successfully
[auth] sendRegistrationVerificationEmail called
[email] sendVerifyEmail called {
  EMAIL_ENABLED: 'true',
  RESEND_API_KEY_present: true,
  EMAIL_FROM_present: true,
  ...
}
[email] sending verify email via Resend
[email] sending {
  kind: 'verify-email',
  intendedTo: 'user@example.com',
  actualTo: 'user@example.com',
  subject: 'Подтвердите email в mamaGo'
}
[email] sent {
  kind: 'verify-email',
  intendedTo: 'user@example.com',
  messageId: 'xxx-xxx-xxx'  ← Успешно!
}
[auth] verification email sent successfully
```

### Если ошибка:

```
[email] Resend error {
  kind: 'verify-email',
  intendedTo: 'user@example.com',
  message: '...'  ← Текст ошибки
}
[auth] verification email send failed
```

## Проверка в Resend Dashboard

1. Зайдите на https://resend.com/emails
2. Найдите отправленное письмо
3. Проверьте статус:
   - ✅ **Delivered** - письмо доставлено
   - ⚠️ **Bounced** - адрес не существует
   - ⏳ **Queued** - в очереди на отправку
   - ❌ **Failed** - ошибка отправки

## Альтернатива: Использовать другой email провайдер

Если не хотите настраивать DNS для `send.mamago.by`, можете:

1. Использовать основной домен `mamago.by` (если он уже верифицирован)
2. Использовать другой поддомен, который легче верифицировать
3. Использовать сторонний email сервис (SendGrid, Mailgun, etc.)

### Пример с основным доменом:

```bash
EMAIL_FROM="mamaGo <no-reply@mamago.by>"
```

Но тогда нужно верифицировать `mamago.by` в Resend.

## Текущий статус

✅ **Применено**: Используется тестовый домен `onboarding@resend.dev`  
✅ **Сервер**: Перезапущен с новыми настройками  
⏳ **Следующий шаг**: Зарегистрировать пользователя и проверить отправку  

## Рекомендации

### Для разработки:
- ✅ Используйте `onboarding@resend.dev`
- ✅ Используйте `EMAIL_DEBUG_REDIRECT_TO` для перенаправления на свой email

### Для production:
- ✅ Верифицируйте `send.mamago.by` в Resend
- ✅ Настройте SPF, DKIM, DMARC записи
- ✅ Используйте `EMAIL_FROM="mamaGo <no-reply@send.mamago.by>"`

## Troubleshooting

### Письма не приходят с onboarding@resend.dev

**Причина**: Resend отправляет с тестового домена только на email, зарегистрированный в аккаунте.

**Решение**: Используйте `EMAIL_DEBUG_REDIRECT_TO`:

```bash
EMAIL_DEBUG_REDIRECT_TO=your-resend-account-email@example.com
```

### DNS записи не применяются

**Причина**: DNS изменения могут занять до 48 часов.

**Решение**: 
1. Проверьте записи через `dig` или `nslookup`
2. Подождите несколько часов
3. Проверьте статус в Resend Dashboard

### Письма попадают в спам

**Причина**: Отсутствуют DMARC/SPF/DKIM записи.

**Решение**: Добавьте все рекомендуемые DNS записи из Resend.
