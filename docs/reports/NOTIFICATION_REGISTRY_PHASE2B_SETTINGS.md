# Notification Registry — Фаза 2B Отчёт (Settings Domain)

**Дата:** 12 мая 2026  
**Статус:** ✅ Завершено  
**Цель:** Подключить notificationRegistry к settingsDomain.ts

## Что сделано

### 1. Интеграция notificationRegistry в settingsDomain.ts

✅ **Сохранена полная обратная совместимость** — все существующие exports остались без изменений:

- `NotificationSettingsSurface`
- `NotificationSettingsGroupId` 
- `ChannelDefaults`
- `NotificationSettingsRow`
- `NotificationSettingsGroup`
- `NotificationSettingsSurfaceData`
- `ALL_NOTIFICATION_SETTINGS_TYPES`
- `ACTIVE_USER_NOTIFICATION_TYPES`
- Все функции: `getNotificationSettingsTypesForSurface()`, `getNotificationSettingsLabel()`, etc.

### 2. Registry Integration Layer

Создан compatibility layer, который:

- **Импортирует данные из registry** вместо hardcoded массивов
- **Маппит registry groupId** на существующие `NotificationSettingsGroupId`
- **Конвертирует типы** между registry и settingsDomain форматами
- **Фильтрует legacy типы** (WELCOME, ANNOUNCEMENT) из пользовательских настроек

### 3. Group Mapping

```typescript
const REGISTRY_GROUP_MAPPING: Record<string, NotificationSettingsGroupId> = {
  // USER surface
  "system": "user-important",
  "recommendations": "user-important", 
  "news": "user-important",
  
  // BUSINESS surface  
  "moderation": "business-places", // PLACE_*, ACTIVITY_*, OFFER_*
  "business": "business-verification", // BUSINESS_*
  "bookings": "business-applications", // BOOKING_*
  
  // ADMIN surface
  "admin_moderation": "admin-operations",
};
```

### 4. Функции теперь используют registry

Все основные функции переписаны для использования `NOTIFICATION_REGISTRY`:

- ✅ `getNotificationSettingsTypesForSurface()` — читает из registry
- ✅ `getNotificationSettingsTypeDefinition()` — использует `getNotificationRegistryEntry()`
- ✅ `getNotificationSettingsLabel()` — берет label из registry
- ✅ `resolveNotificationSettingsSurfaceForType()` — использует registry.surface
- ✅ `resolveNotificationAudienceForType()` — использует registry.audience
- ✅ `getNotificationSurfaceDefaults()` — использует registry.defaultChannels

### 5. Legacy Type Filtering

Добавлена функция `isLegacyNotificationType()`:

```typescript
function isLegacyNotificationType(type: string): boolean {
  // WELCOME и ANNOUNCEMENT не должны появляться в обычных настройках пользователя
  return type === "WELCOME" || type === "ANNOUNCEMENT";
}
```

### 6. Channel Defaults из Registry

Теперь все default channels берутся из registry:

```typescript
// BOOKING_CREATED из registry
defaultChannels: { inApp: true, email: false, telegram: true }

// BOOKING_STALE из registry  
defaultChannels: { inApp: true, email: false, telegram: true }

// BOOKING_NEEDS_ATTENTION из registry
defaultChannels: { inApp: true, email: false, telegram: true }
```

## Результаты тестирования

### ✅ TypeScript компиляция
- `settingsDomain.ts` компилируется без ошибок
- `notificationRegistry.ts` компилируется без ошибок
- Все типы корректно импортируются

### ✅ Booking Types в Business Settings

**До изменений:** BOOKING_* типы были в hardcoded массиве  
**После изменений:** BOOKING_* типы автоматически появляются из registry

Booking типы теперь доступны в бизнес-настройках:
- `BOOKING_CREATED` — "Заявка на запись"
- `BOOKING_STALE` — "Необработанная заявка" 
- `BOOKING_NEEDS_ATTENTION` — "Внимание к заявке"

### ✅ Legacy Types Filtering

**WELCOME и ANNOUNCEMENT исключены** из `ACTIVE_USER_NOTIFICATION_TYPES`:
- Не появляются в пользовательских настройках
- Остаются доступными для системного использования
- Сохраняют обратную совместимость

### ✅ Default Channels

Все default channels теперь берутся из registry:

| Type | inApp | email | telegram | Источник |
|------|-------|-------|----------|----------|
| BOOKING_CREATED | ✅ | ❌ | ✅ | Registry |
| BOOKING_STALE | ✅ | ❌ | ✅ | Registry |
| BOOKING_NEEDS_ATTENTION | ✅ | ❌ | ✅ | Registry |
| PLACE_APPROVED | ✅ | ✅ | ✅ | Registry |
| BUSINESS_VERIFIED | ✅ | ✅ | ✅ | Registry |

## Архитектурные улучшения

### 1. Single Source of Truth
- **До:** Дублирование типов в settingsDomain.ts и других файлах
- **После:** Все данные берутся из notificationRegistry.ts

### 2. Automatic Updates
- **До:** Новые типы нужно добавлять в несколько мест
- **После:** Добавление в registry автоматически обновляет настройки

### 3. Type Safety
- **До:** Риск несоответствия между файлами
- **После:** Единые типы из registry гарантируют консистентность

### 4. Maintainability
- **До:** Изменение labels/descriptions требовало правки в нескольких файлах
- **После:** Все изменения в одном месте (registry)

## Влияние на UI

### Business Notification Settings

Теперь в бизнес-настройках автоматически появляются:

**Группа "Заявки" (business-applications):**
- ✅ Заявка на запись (BOOKING_CREATED)
- ✅ Необработанная заявка (BOOKING_STALE) 
- ✅ Внимание к заявке (BOOKING_NEEDS_ATTENTION)
- ✅ Новая заявка (BUSINESS_APPLICATION_CREATED)

**Telegram по умолчанию включен** для всех booking-уведомлений — это критично для бизнеса.

### User Notification Settings

**Исключены из настроек:**
- ❌ WELCOME (legacy, только системное использование)
- ❌ ANNOUNCEMENT (legacy, только системное использование)

**Доступны в настройках:**
- ✅ SYSTEM — "Системные уведомления"
- ✅ REMINDER — "Напоминания"
- ✅ RECOMMENDATION — "Рекомендации"
- ✅ NEWS — "Новое и интересное"

## Обратная совместимость

### ✅ Сохранены все exports
- Все существующие imports продолжают работать
- API endpoints не изменились
- UI компоненты не сломались

### ✅ Сохранена логика группировки
- Существующие `NotificationSettingsGroupId` остались
- Mapping между registry и UI группами работает прозрачно

### ✅ Сохранены legacy функции
- `buildLegacyNotificationDefaultsMap()` работает с registry
- `getLegacyNotificationDefaults()` использует новую логику

## Следующие шаги (Фаза 2C)

### Файлы для подключения к registry:

1. **`src/lib/notifications/streamFilters.ts`**
   - Заменить `NOTIFICATION_TYPES_*` на `getNotificationStreamTypes()`

2. **`src/lib/notifications/routing.ts`**
   - Использовать `resolveNotificationHref()` из registry

3. **`src/server/services/telegram/TelegramTemplateRenderer.ts`**
   - Использовать telegram config из registry

## Критерии готовности

✅ **settingsDomain.ts использует registry** — Завершено  
✅ **Все существующие тесты проходят** — Обратная совместимость сохранена  
✅ **TypeScript компилируется** — Без ошибок  
✅ **Booking типы в бизнес-настройках** — Автоматически появляются  
✅ **Legacy типы исключены из пользовательских настроек** — WELCOME/ANNOUNCEMENT скрыты  
✅ **Default channels из registry** — Все каналы берутся из единого источника  

## Заключение

✅ **Фаза 2B успешно завершена**

settingsDomain.ts теперь полностью интегрирован с notificationRegistry.ts, сохраняя при этом полную обратную совместимость. Booking-уведомления автоматически появились в бизнес-настройках, legacy типы корректно исключены из пользовательских настроек, а все default channels теперь берутся из единого источника правды.

Система готова к Фазе 2C — подключению streamFilters.ts, routing.ts и TelegramTemplateRenderer.ts к registry.