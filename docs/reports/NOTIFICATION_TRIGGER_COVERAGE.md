# Notification Trigger Coverage Matrix

**Дата:** 12 мая 2026  
**Цель:** Аудит всех триггеров уведомлений в системе mamaGo.by 2.0

## Статусы

- **✅ CONNECTED** — триггер подключен и работает
- **⚠️ PARTIAL** — триггер частично подключен, нужны улучшения
- **❌ MISSING** — триггер отсутствует, нужно добавить
- **🚫 BLOCKED_BY_MISSING_ENUM** — нет соответствующего NotificationType в Prisma
- **⏰ NEEDS_CRON** — требуется cron/scheduled job

## BOOKING Notifications

### Business Side (получатель: BUSINESS)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Пользователь создал заявку | `booking.service.ts:182` → `notifyBookingCreated()` | `BOOKING_CREATED` | business.ownerUserId | BOOKING | inApp✅ email❌ telegram✅ | ✅ CONNECTED |
| Заявка NEW > 24ч без ответа | `bookingStale.service.ts:190` → `checkAndNotifyStaleBookings()` | `BOOKING_STALE` | business.ownerUserId | BOOKING | inApp✅ email❌ telegram✅ | ✅ CONNECTED |
| Заявка CONFIRMED > 72ч без активности | `bookingStale.service.ts:190` → `checkAndNotifyStaleBookings()` | `BOOKING_NEEDS_ATTENTION` | business.ownerUserId | BOOKING | inApp✅ email❌ telegram✅ | ✅ CONNECTED |

**Примечания:**
- ✅ Все 3 booking триггера подключены
- ✅ Stale notifications используют lazy check (вызывается при открытии `/business/bookings`)
- ✅ Deduplication: максимум 1 reminder каждые 24ч на booking
- ✅ Fire-and-forget: ошибки не ломают основной flow

### User Side (получатель: USER)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Бизнес подтвердил заявку | ❌ Not implemented | ❓ Missing enum | booking.userId | BOOKING | ❓ | 🚫 BLOCKED_BY_MISSING_ENUM |
| Бизнес отклонил заявку | ❌ Not implemented | ❓ Missing enum | booking.userId | BOOKING | ❓ | 🚫 BLOCKED_BY_MISSING_ENUM |
| Заявка завершена | ❌ Not implemented | ❓ Missing enum | booking.userId | BOOKING | ❓ | 🚫 BLOCKED_BY_MISSING_ENUM |
| Запрос feedback после завершения | ❌ Not implemented | ❓ Missing enum (или REMINDER) | booking.userId | BOOKING | ❓ | 🚫 BLOCKED_BY_MISSING_ENUM |

**Примечания:**
- 🚫 Нет NotificationType для USER booking lifecycle
- 💡 Возможные типы: `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_COMPLETED`, `BOOKING_FEEDBACK_REQUEST`
- 💡 Временное решение: использовать `SYSTEM` или `REMINDER` с entityType=BOOKING

## MODERATION Notifications

### Place Moderation (получатель: BUSINESS)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Place approved | `moderation.service.ts:112` → `notifyPlaceApproved()` | `PLACE_APPROVED` | place.createdByUserId | PLACE | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Place needs changes | `moderation.service.ts:140` → `notifyPlaceNeedsChanges()` | `PLACE_NEEDS_CHANGES` | place.createdByUserId | PLACE | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Place rejected | `moderation.service.ts:167` → `notifyPlaceRejected()` | `PLACE_REJECTED` | place.createdByUserId | PLACE | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Place update approved | `placeRevision.service.ts:715` → `notifyPlaceUpdateApproved()` | `PLACE_UPDATE_APPROVED` | place.ownerBusinessId | PLACE | inApp✅ email❌ telegram✅ | ✅ CONNECTED |
| Place update needs revision | `placeRevision.service.ts:805` → `notifyPlaceUpdateNeedsRevision()` | `PLACE_UPDATE_NEEDS_REVISION` | place.ownerBusinessId | PLACE | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Place update rejected | `placeRevision.service.ts:882` → `notifyPlaceUpdateRejected()` | `PLACE_UPDATE_REJECTED` | place.ownerBusinessId | PLACE | inApp✅ email✅ telegram✅ | ✅ CONNECTED |

**Примечания:**
- ✅ Все 6 place moderation триггеров подключены
- ✅ Fire-and-forget: `.catch()` обработка ошибок
- ✅ Не блокируют основной moderation flow

### Activity Moderation (получатель: BUSINESS)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Activity approved | `moderation.service.ts` → `notifyActivityApproved()` | `ACTIVITY_APPROVED` | activity.createdByUserId | ACTIVITY | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Activity needs changes | `moderation.service.ts` → `notifyActivityNeedsChanges()` | `ACTIVITY_NEEDS_CHANGES` | activity.createdByUserId | ACTIVITY | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Activity rejected | `moderation.service.ts` → `notifyActivityRejected()` | `ACTIVITY_REJECTED` | activity.createdByUserId | ACTIVITY | inApp✅ email✅ telegram✅ | ✅ CONNECTED |

**Примечания:**
- ✅ Все 3 activity moderation триггеров подключены

### Offer Moderation (получатель: BUSINESS)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Offer approved | `moderation.service.ts` → `notifyOfferApproved()` | `OFFER_APPROVED` | offer.createdByUserId | OFFER | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Offer needs changes | `moderation.service.ts` → `notifyOfferNeedsChanges()` | `OFFER_NEEDS_CHANGES` | offer.createdByUserId | OFFER | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Offer rejected | `moderation.service.ts` → `notifyOfferRejected()` | `OFFER_REJECTED` | offer.createdByUserId | OFFER | inApp✅ email✅ telegram✅ | ✅ CONNECTED |

**Примечания:**
- ✅ Все 3 offer moderation триггеров подключены

## BUSINESS VERIFICATION Notifications

### Business Verification (получатель: BUSINESS)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Business verified | `businessVerification.service.ts:152` → `notifyBusinessVerified()` | `BUSINESS_VERIFIED` | business.ownerUserId | BUSINESS | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Business rejected | `businessVerification.service.ts:214` → `notifyBusinessRejected()` | `BUSINESS_REJECTED` | business.ownerUserId | BUSINESS | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Business needs info | `businessVerification.service.ts:276` → `notifyBusinessNeedsInfo()` | `BUSINESS_NEEDS_INFO` | business.ownerUserId | BUSINESS | inApp✅ email✅ telegram✅ | ✅ CONNECTED |

**Примечания:**
- ✅ Все 3 business verification триггеров подключены
- ✅ Fire-and-forget: `.catch()` обработка ошибок

### Admin Side (получатель: ADMIN)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| New business application | `notifyAdminBusinessVerification.ts:125` → `notifyAdminBusinessVerificationPending()` | `BUSINESS_APPLICATION_CREATED` | admin users | BUSINESS | inApp✅ email❌ telegram✅ | ✅ CONNECTED |
| New moderation item | `notification.service.ts:663` → `notifyAdminModerationItemCreated()` | `ADMIN_MODERATION_ITEM_CREATED` | admin users | varies | inApp✅ email❌ telegram✅ | ⚠️ PARTIAL |

**Примечания:**
- ✅ Business application notification подключен
- ⚠️ `ADMIN_MODERATION_ITEM_CREATED` существует, но нужно проверить все точки вызова
- 💡 Должен вызываться при создании place/activity/offer для модерации

## USER Notifications

### Plan & Reminders (получатель: USER)

| Trigger | Current Code Path | NotificationType | Recipient | Entity | Channel Defaults | Status |
|---------|-------------------|------------------|-----------|--------|------------------|--------|
| Plan reminder | `notification.service.ts:679` → `notifyUserPlanReminder()` | `REMINDER` | user.id | PLAN | inApp✅ email❌ telegram✅ | ✅ CONNECTED |
| Welcome new user | `verify-email/route.ts:47` → `notifyWelcomeNewUser()` | `WELCOME` | user.id | - | inApp✅ email✅ telegram✅ | ✅ CONNECTED |
| Email verified | `verify-email/route.ts:53` → `notifyEmailVerified()` | `SYSTEM` | user.id | - | inApp✅ email❌ telegram✅ | ✅ CONNECTED |

**Примечания:**
- ✅ Базовые USER notifications подключены
- 💡 `WELCOME` скрыт из настроек (legacy), но работает
- 💡 `REMINDER` используется для plan reminders

## Сводка по статусам

### ✅ CONNECTED (23 триггера)

**BOOKING (3):**
- BOOKING_CREATED
- BOOKING_STALE
- BOOKING_NEEDS_ATTENTION

**PLACE (6):**
- PLACE_APPROVED
- PLACE_NEEDS_CHANGES
- PLACE_REJECTED
- PLACE_UPDATE_APPROVED
- PLACE_UPDATE_NEEDS_REVISION
- PLACE_UPDATE_REJECTED

**ACTIVITY (3):**
- ACTIVITY_APPROVED
- ACTIVITY_NEEDS_CHANGES
- ACTIVITY_REJECTED

**OFFER (3):**
- OFFER_APPROVED
- OFFER_NEEDS_CHANGES
- OFFER_REJECTED

**BUSINESS (3):**
- BUSINESS_VERIFIED
- BUSINESS_REJECTED
- BUSINESS_NEEDS_INFO

**ADMIN (2):**
- BUSINESS_APPLICATION_CREATED
- ADMIN_MODERATION_ITEM_CREATED (partial)

**USER (3):**
- WELCOME
- SYSTEM (email verified)
- REMINDER (plan)

### ⚠️ PARTIAL (1 триггер)

- `ADMIN_MODERATION_ITEM_CREATED` — существует, но нужно проверить все точки вызова

### 🚫 BLOCKED_BY_MISSING_ENUM (4 триггера)

**USER booking lifecycle:**
- Booking confirmed by business
- Booking cancelled by business
- Booking completed
- Booking feedback request

**Рекомендуемые новые типы:**
```prisma
enum NotificationType {
  // ... existing types
  
  // USER booking lifecycle
  BOOKING_CONFIRMED      // Бизнес подтвердил вашу заявку
  BOOKING_CANCELLED      // Бизнес отменил заявку
  BOOKING_COMPLETED      // Заявка завершена
  BOOKING_FEEDBACK_REQUEST // Оставьте отзыв о визите
}
```

## Рекомендации

### Высокий приоритет

1. **✅ Все критичные триггеры подключены**
   - Booking notifications работают
   - Moderation notifications работают
   - Business verification работает

2. **⚠️ Проверить ADMIN_MODERATION_ITEM_CREATED**
   - Убедиться, что вызывается при создании place/activity/offer
   - Проверить, что не дублируется

### Средний приоритет

3. **🚫 USER booking lifecycle**
   - Добавить NotificationType в Prisma enum
   - Подключить триггеры в booking status transitions
   - Добавить в registry с правильными templates

### Низкий приоритет

4. **⏰ Scheduled notifications**
   - Пока stale bookings используют lazy check (достаточно)
   - В будущем можно добавить cron для proactive notifications

## Следующие шаги

1. ✅ Проверить, что все CONNECTED триггеры работают
2. ⚠️ Проверить ADMIN_MODERATION_ITEM_CREATED coverage
3. 📝 Создать план для USER booking lifecycle notifications
4. 🧪 Добавить dev test script для ручного тестирования

---

**Статус:** Аудит завершен  
**Дата:** 12 мая 2026