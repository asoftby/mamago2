# Booking User Lifecycle — Фаза 3A

**Дата:** 12 мая 2026  
**Статус:** ✅ Завершено  
**Цель:** Добавить USER booking lifecycle notifications (BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_COMPLETED, BOOKING_FEEDBACK_REQUEST)

---

## Что сделано

### 1. Prisma enum — 4 новых типа

Файл: `prisma/schema.prisma`

```prisma
enum NotificationType {
  // ... existing types ...

  /// Бизнес подтвердил заявку пользователя
  BOOKING_CONFIRMED
  /// Бизнес отменил/отклонил заявку пользователя
  BOOKING_CANCELLED
  /// Заявка завершена
  BOOKING_COMPLETED
  /// Запрос отзыва после завершения заявки
  BOOKING_FEEDBACK_REQUEST
}
```

### 2. notificationRegistry.ts — 4 новых записи

Файл: `src/lib/notifications/notificationRegistry.ts`

| Type | audience | surface | groupId | channels | importance |
|------|----------|---------|---------|----------|------------|
| BOOKING_CONFIRMED | USER | USER | user_bookings | inApp✅ email❌ telegram✅ | HIGH |
| BOOKING_CANCELLED | USER | USER | user_bookings | inApp✅ email❌ telegram✅ | HIGH |
| BOOKING_COMPLETED | USER | USER | user_bookings | inApp✅ email❌ telegram❌ | NORMAL |
| BOOKING_FEEDBACK_REQUEST | USER | USER | user_bookings | inApp✅ email❌ telegram✅ | LOW |

**href:** все ведут на `/me` (временно, до появления `/me/bookings`)

**Telegram templates:** используют динамический `{{body}}` из service

### 3. settingsDomain.ts — новая группа user-bookings

Файл: `src/lib/notifications/settingsDomain.ts`

- Добавлен `"user-bookings"` в `NotificationSettingsGroupId`
- Добавлен маппинг `"user_bookings" → "user-bookings"` в `REGISTRY_GROUP_MAPPING`
- Добавлена группа в `NOTIFICATION_SETTINGS_GROUP_DEFINITIONS`:
  ```
  id: "user-bookings"
  title: "Мои заявки"
  description: "Статусы ваших заявок на запись"
  order: 20
  surface: USER
  ```
- `getDefaultKindForEntry`: BOOKING category на USER surface → `USER_REMINDERS`

### 4. streamFilters.ts — автоматически

Файл: `src/lib/notifications/streamFilters.ts`

Новые типы автоматически попадают в `NOTIFICATION_TYPES_USER` через registry filter `surface === "USER"`. Никаких изменений не требовалось.

### 5. routing.ts — автоматически

Файл: `src/lib/notifications/routing.ts`

`resolveHref` определён в registry для каждого типа → routing работает автоматически.

### 6. TelegramTemplateRenderer.ts — автоматически

Telegram templates определены в registry с `body: "{{body}}"` — renderer использует `notification.body` как fallback. Никаких изменений не требовалось.

### 7. notification.service.ts — 4 новых helper функции

Файл: `src/server/services/notification.service.ts`

```typescript
notifyUserBookingConfirmed(params: NotifyUserBookingParams)
notifyUserBookingCancelled(params: NotifyUserBookingParams)
notifyUserBookingCompleted(params: NotifyUserBookingParams)
notifyUserBookingFeedbackRequest(params: NotifyUserBookingParams)
```

Параметры:
```typescript
interface NotifyUserBookingParams {
  userId: string;        // владелец заявки
  bookingId: string;
  publicationTitle?: string | null;  // название активности/предложения/места
}
```

### 8. bookingQuery.service.ts — триггеры подключены

Файл: `src/server/services/booking/bookingQuery.service.ts`

В `updateBookingStatus` добавлены fire-and-forget вызовы:

| Переход | Уведомление |
|---------|-------------|
| NEW → CONFIRMED | `notifyUserBookingConfirmed` |
| NEW → REJECTED | `notifyUserBookingCancelled` |
| CONFIRMED → REJECTED | `notifyUserBookingCancelled` |
| CONFIRMED → COMPLETED | `notifyUserBookingCompleted` + `notifyUserBookingFeedbackRequest` |

**Условие:** уведомления отправляются только если `booking.userId != null` (авторизованный пользователь).

**Паттерн:** fire-and-forget с `.catch()` — ошибки не ломают основной flow.

**Данные для тела:** `publicationTitle` берётся из `offer.title ?? activity.title ?? place.title`.

---

## Trigger Coverage Matrix (обновлённая)

### USER Booking Lifecycle

| Trigger | Code Path | NotificationType | Recipient | Status |
|---------|-----------|------------------|-----------|--------|
| Бизнес подтвердил заявку | `bookingQuery.service.ts:updateBookingStatus` | `BOOKING_CONFIRMED` | booking.userId | ✅ CONNECTED |
| Бизнес отклонил заявку | `bookingQuery.service.ts:updateBookingStatus` | `BOOKING_CANCELLED` | booking.userId | ✅ CONNECTED |
| Заявка завершена | `bookingQuery.service.ts:updateBookingStatus` | `BOOKING_COMPLETED` | booking.userId | ✅ CONNECTED |
| Запрос отзыва | `bookingQuery.service.ts:updateBookingStatus` | `BOOKING_FEEDBACK_REQUEST` | booking.userId | ✅ CONNECTED |

---

## TODO / Следующие шаги

### Высокий приоритет

1. **`/me/bookings` страница**
   - Когда появится страница со списком заявок пользователя, обновить `ctaAction` во всех 4 helpers с `/me` на `/me/bookings`
   - Для detail page: `/me/bookings/${bookingId}`
   - Обновить `resolveHref` в registry аналогично

2. **`/me/bookings/:id` с формой отзыва**
   - Когда появится feedback flow, обновить `notifyUserBookingFeedbackRequest`:
     - `ctaAction: /me/bookings/${bookingId}?feedback=1`
     - `ctaLabel: "Оставить отзыв"`

### Средний приоритет

3. **BOOKING_FEEDBACK_REQUEST timing**
   - Сейчас отправляется сразу после COMPLETED
   - В будущем можно добавить задержку (например, через 2 часа) через scheduled job
   - Deduplication: проверить, что не отправляется повторно

4. **Анонимные заявки**
   - Заявки без `userId` (гости) не получают уведомлений
   - Рассмотреть email-уведомления для гостей (по `customerEmail`)

---

## Ручное тестирование

### Тест 1: BOOKING_CONFIRMED

1. Создать заявку от авторизованного пользователя
2. В бизнес-кабинете нажать "Подтвердить"
3. Проверить notification feed пользователя
4. Ожидаемый результат:
   ```
   Заявка подтверждена
   «Название» подтверждена. Ждём вас!
   [Мои заявки] → /me
   ```

### Тест 2: BOOKING_CANCELLED

1. Создать заявку от авторизованного пользователя
2. В бизнес-кабинете нажать "Отклонить"
3. Проверить notification feed пользователя
4. Ожидаемый результат:
   ```
   Заявка отклонена
   «Название» была отклонена. Вы можете подать новую заявку.
   [Мои заявки] → /me
   ```

### Тест 3: BOOKING_COMPLETED + BOOKING_FEEDBACK_REQUEST

1. Подтвердить заявку (NEW → CONFIRMED)
2. Завершить заявку (CONFIRMED → COMPLETED)
3. Проверить notification feed пользователя — должно быть 2 уведомления:
   - `BOOKING_COMPLETED`: "Заявка завершена"
   - `BOOKING_FEEDBACK_REQUEST`: "Как прошло?"

### SQL для проверки

```sql
-- Проверить созданные уведомления
SELECT type, title, body, "createdAt"
FROM "Notification"
WHERE "userId" = '<user_id>'
  AND type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'BOOKING_FEEDBACK_REQUEST')
ORDER BY "createdAt" DESC;

-- Проверить delivery
SELECT nd.channel, nd.status, n.type
FROM "NotificationDelivery" nd
JOIN "Notification" n ON n.id = nd."notificationId"
WHERE n.type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'BOOKING_FEEDBACK_REQUEST')
ORDER BY nd."createdAt" DESC;
```

---

## TypeScript

```
pnpm tsc --noEmit
```

**Результат:** 1 ошибка в `bookingActivity.service.ts:49` — известная, несвязанная, существовала до этих изменений. Новых ошибок нет.

---

**Статус:** ✅ Production Ready  
**Дата:** 12 мая 2026
