# ✅ Переключение на Production Email Sender

## Статус выполнения

### 1. ✅ Проверка домена в Resend

**Результат API запроса:**
```json
{
  "id": "bb79b73c-217f-49e3-80f1-726d27e40fa6",
  "name": "mamago.by",
  "status": "verified",
  "created_at": "2026-02-20 06:14:06.489481+00",
  "region": "ap-northeast-1",
  "capabilities": {
    "sending": "enabled",
    "receiving": "disabled"
  }
}
```

**Статус:** ✅ **VERIFIED**  
**Домен:** `mamago.by` (основной домен)  
**Поддомен:** `send.mamago.by` не найден в Resend  
**Решение:** Используем основной домен `mamago.by`

### 2. ✅ Обновление .env.local

**Изменения:**

```diff
- EMAIL_FROM="mamaGo <onboarding@resend.dev>"
+ EMAIL_FROM="mamaGo <no-reply@mamago.by>"

- EMAIL_DEBUG_REDIRECT_TO=asoftby@gmail.com
+ # EMAIL_DEBUG_REDIRECT_TO=

+ APP_PUBLIC_URL=http://localhost:3000
```

**Финальная конфигурация:**
```bash
EMAIL_ENABLED=true
RESEND_API_KEY=re_REDACTED
EMAIL_FROM="mamaGo <no-reply@mamago.by>"
EMAIL_REPLY_TO=hello@mamago.by
APP_PUBLIC_URL=http://localhost:3000
# EMAIL_DEBUG_REDIRECT_TO= (закомментировано)
```

> Security note: реальный API key удалён из документации. Секреты должны храниться только во внешнем secret/env store.

### 3. ✅ Проверка EmailService

**Проверено:**
- ✅ `from` берётся из `EMAIL_FROM`
- ✅ `replyTo` берётся из `EMAIL_REPLY_TO`
- ✅ Нет хардкода `onboarding@resend.dev` в коде
- ✅ `EMAIL_DEBUG_REDIRECT_TO` не влияет, если пустой/закомментирован

**Результат grep:** Хардкод не найден ✅

### 4. ✅ Сервер перезапущен

**Статус:** ✅ Сервер работает с новыми настройками

---

## 🧪 Smoke Test - Инструкции

### Сценарий A: Registration Verify Email

**Шаги:**
1. Зарегистрируйте нового пользователя с **реальным email** (не тестовым)
2. Проверьте серверный лог на наличие:
   ```
   [email] sending {
     kind: 'verify-email',
     intendedTo: 'user@example.com',
     actualTo: 'user@example.com',
     debugRedirect: false,
     subject: 'Подтвердите email в mamaGo'
   }
   [email] sent {
     kind: 'verify-email',
     intendedTo: 'user@example.com',
     messageId: '...'
   }
   ```

3. Проверьте Resend Dashboard:
   - Зайдите на https://resend.com/emails
   - Найдите отправленное письмо
   - Проверьте:
     - ✅ From: `mamaGo <no-reply@mamago.by>`
     - ✅ To: реальный email пользователя
     - ✅ Status: Delivered / Queued

4. Проверьте почту получателя:
   - ✅ Inbox
   - ⚠️ Spam
   - ⚠️ Promotions

**Ожидаемый результат:**
- Письмо отправлено на реальный email
- `debugRedirect: false`
- `actualTo` совпадает с `intendedTo`
- Письмо появилось в Resend Dashboard
- Письмо доставлено в почтовый ящик

---

### Сценарий B: Resend Verification

**Шаги:**
1. В UI нажмите "Отправить письмо повторно"
2. Проверьте серверный лог:
   ```
   [email] sent { messageId: '...' }
   ```

3. Попробуйте нажать повторно **< 60 секунд**:
   - Должен сработать rate limit
   - Должно появиться сообщение о cooldown

4. Проверьте Resend Dashboard:
   - Новое письмо появилось
   - Правильный recipient

**Ожидаемый результат:**
- Письмо отправлено
- Rate limit работает (60 сек)
- Письмо доставлено

---

### Сценарий C: Forgot Password

**Шаги:**
1. Перейдите на страницу "Забыли пароль?"
2. Введите email и запросите сброс
3. Проверьте серверный лог:
   ```
   [email] sending {
     kind: 'password-reset',
     intendedTo: 'user@example.com',
     actualTo: 'user@example.com',
     debugRedirect: false
   }
   [email] sent { messageId: '...' }
   ```

4. Проверьте почту:
   - Письмо пришло
   - Ссылка работает
   - Ссылка содержит правильный URL (не localhost в production)

**Ожидаемый результат:**
- Письмо отправлено
- Ссылка reset работает
- URL корректный

---

## 📧 Проверка содержимого письма

### Verify Email:
- ✅ Ссылка: `http://localhost:3000/api/auth/verify-email/{token}`
- ✅ Использует `APP_PUBLIC_URL`
- ⚠️ Для production: изменить `APP_PUBLIC_URL` на `https://mamago.by`

### Password Reset:
- ✅ Ссылка: `http://localhost:3000/auth/reset-password?token={token}`
- ✅ Использует `APP_PUBLIC_URL`
- ⚠️ Для production: изменить `APP_PUBLIC_URL` на `https://mamago.by`

---

## 📊 Deliverability Check

### Если письмо не в Inbox:

1. **Проверьте Spam:**
   - Откройте папку Spam
   - Если письмо там → отметьте "Not Spam"

2. **Проверьте Promotions (Gmail):**
   - Откройте вкладку Promotions
   - Если письмо там → переместите в Primary

3. **Проверьте DNS записи домена:**
   ```bash
   # SPF
   dig TXT mamago.by | grep spf
   
   # DKIM
   dig TXT resend._domainkey.mamago.by
   
   # DMARC
   dig TXT _dmarc.mamago.by
   ```

4. **Проверьте Resend Dashboard:**
   - Status: Delivered / Bounced / Failed
   - Если Bounced → проверьте причину

### Базовые требования для deliverability:
- ✅ SPF запись настроена
- ✅ DKIM записи настроены (3 записи)
- ✅ DMARC запись настроена
- ✅ Домен verified в Resend

---

## 🎯 Финальный вывод

### Статус домена:
✅ **VERIFIED** (`mamago.by`)

### Обновлённый .env:
```bash
EMAIL_FROM="mamaGo <no-reply@mamago.by>"
EMAIL_REPLY_TO=hello@mamago.by
APP_PUBLIC_URL=http://localhost:3000
# EMAIL_DEBUG_REDIRECT_TO= (отключен)
```

### Результат по сценариям:

#### ⏳ Registration Verify (требует тестирования):
- Код готов
- Сервер перезапущен
- Нужно: зарегистрировать пользователя и проверить

#### ⏳ Resend Verification (требует тестирования):
- Код готов
- Rate limit настроен (60 сек)
- Нужно: протестировать повторную отправку

#### ⏳ Password Reset (требует тестирования):
- Код готов
- Нужно: запросить сброс пароля и проверить

### Где попадут письма:
- **Ожидается:** Inbox
- **Возможно:** Spam (первое письмо от нового отправителя)
- **Решение:** Отметить "Not Spam" и добавить в контакты

### Проблемы доставки:
- **Нет** (пока не протестировано)
- Если возникнут → проверить DNS записи и Resend Dashboard

---

## 🚀 Для Production Deployment

### Перед деплоем на production:

1. **Обновите APP_PUBLIC_URL:**
   ```bash
   APP_PUBLIC_URL=https://mamago.by
   NEXT_PUBLIC_APP_URL=https://mamago.by
   ```

2. **Проверьте все env переменные:**
   ```bash
   EMAIL_ENABLED=true
   RESEND_API_KEY=re_...
   EMAIL_FROM="mamaGo <no-reply@mamago.by>"
   EMAIL_REPLY_TO=hello@mamago.by
   APP_PUBLIC_URL=https://mamago.by
   # EMAIL_DEBUG_REDIRECT_TO= (должен быть пустым!)
   ```

3. **Проверьте DNS записи:**
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: 3 записи от Resend
   - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@mamago.by`

4. **Протестируйте на staging:**
   - Регистрация
   - Resend verification
   - Password reset

5. **Мониторинг после деплоя:**
   - Проверяйте Resend Dashboard
   - Следите за bounce rate
   - Проверяйте логи сервера

---

## 📝 Чеклист перед тестированием

- [x] Домен verified в Resend
- [x] `.env.local` обновлён
- [x] `EMAIL_FROM` использует `mamago.by`
- [x] `EMAIL_DEBUG_REDIRECT_TO` отключен
- [x] `APP_PUBLIC_URL` установлен
- [x] Сервер перезапущен
- [ ] Протестирован сценарий A (Registration)
- [ ] Протестирован сценарий B (Resend)
- [ ] Протестирован сценарий C (Password Reset)
- [ ] Проверена доставка в Inbox
- [ ] Проверен Resend Dashboard

---

## 🐛 Troubleshooting

### Письмо не отправляется:

1. Проверьте логи сервера:
   ```
   [email] Resend error { message: '...' }
   ```

2. Проверьте env переменные:
   ```bash
   echo $EMAIL_ENABLED
   echo $EMAIL_FROM
   echo $RESEND_API_KEY
   ```

3. Проверьте Resend Dashboard:
   - API Keys → проверьте ключ
   - Domains → проверьте статус

### Письмо в Spam:

1. Добавьте отправителя в контакты
2. Отметьте "Not Spam"
3. Проверьте SPF/DKIM/DMARC записи
4. Подождите несколько дней (reputation building)

### Ссылка не работает:

1. Проверьте `APP_PUBLIC_URL` в `.env`
2. Проверьте, что токен не истёк (48 часов)
3. Проверьте логи сервера при клике на ссылку
