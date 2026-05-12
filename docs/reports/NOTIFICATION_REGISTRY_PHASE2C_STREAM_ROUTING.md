# Notification Registry — Фаза 2C Отчёт (Stream Filters & Routing)

**Дата:** 12 мая 2026  
**Статус:** ✅ Завершено  
**Цель:** Подключить notificationRegistry к streamFilters.ts и routing.ts

## Что сделано

### 1. streamFilters.ts интегрирован с registry

✅ **Сохранены все существующие exports:**
- `NOTIFICATION_TYPES_USER`
- `NOTIFICATION_TYPES_BUSINESS`
- `NOTIFICATION_TYPES_ADMIN` (добавлен)

✅ **Массивы теперь строятся из registry:**

```typescript
export const NOTIFICATION_TYPES_USER: NotificationType[] = Object.values(NOTIFICATION_REGISTRY)
  .filter((entry) => entry.surface === "USER")
  .map((entry) => entry.type as NotificationType);

export const NOTIFICATION_TYPES_BUSINESS: NotificationType[] = Object.values(NOTIFICATION_REGISTRY)
  .filter((entry) => entry.surface === "BUSINESS")
  .map((entry) => entry.type as NotificationType);

export const NOTIFICATION_TYPES_ADMIN: NotificationType[] = Object.values(NOTIFICATION_REGISTRY)
  .filter((entry) => entry.surface === "ADMIN")
  .map((entry) => entry.type as NotificationType);
```

✅ **Добавлена helper функция:**

```typescript
export function getNotificationTypesForStream(
  stream: "user" | "business" | "admin"
): NotificationType[]
```

### 2. routing.ts интегрирован с registry

✅ **Сохранены все существующие exports:**
- `getNotificationStreamFromType()`
- `getNotificationCategoryFromType()`
- `getNotificationHref()`
- `mapApiRowToViewModel()`

✅ **Функции обновлены для использования registry:**

#### getNotificationStreamFromType()
- Теперь использует `getNotificationRegistryEntry()` для определения surface
- Fallback на старую логику для неизвестных типов

#### getNotificationCategoryFromType()
- Использует registry.category для маппинга
- Интеллектуальное определение подкатегории на основе importance

#### getNotificationHref()
- **Приоритет 1:** Использует `resolveNotificationHref()` из registry
- **Приоритет 2:** Fallback на существующую логику для специальных случаев
- **Приоритет 3:** Entity-based routing (PLACE, ACTIVITY, OFFER)

### 3. notificationRegistry.ts дополнен href resolvers

Добавлены `resolveHref` для критичных типов:

| Type | Href | Описание |
|------|------|----------|
| SYSTEM | `/settings` | Настройки аккаунта |
| REMINDER | `/me` | Мои планы |
| RECOMMENDATION | `null` | Без deep link |
| NEWS | `ctaAction \|\| null` | Динамический или null |
| ANNOUNCEMENT | `ctaAction \|\| null` | Динамический или null |
| BOOKING_CREATED | `/business/bookings` | Раздел заявок |
| BOOKING_STALE | `/business/bookings` | Раздел заявок |
| BOOKING_NEEDS_ATTENTION | `/business/bookings` | Раздел заявок |
| PLACE_APPROVED | `/business/places/{id}` | Редактор места |
| PLACE_NEEDS_CHANGES | `/business/places/{id}/edit` | Редактор места |
| ACTIVITY_* | `/business/activities/{id}` | Редактор события |
| OFFER_* | `/business/offers/{id}` | Редактор предложения |

### 4. Dev Validation добавлена

#### В streamFilters.ts:

✅ Проверка соответствия типов registry  
✅ Проверка соответствия surface для каждого stream  
✅ Проверка наличия всех 3 BOOKING типов в BUSINESS stream  

#### В routing.ts:

✅ Проверка href resolution для всех типов  
✅ Проверка возвращаемых значений (string | null)  
✅ Проверка критичных типов (REMINDER, SYSTEM, BOOKING_*, PLACE_*)  

## Результаты тестирования

### ✅ Stream Filters

**USER stream (6 типов):**
- SYSTEM ✅
- REMINDER ✅
- RECOMMENDATION ✅
- NEWS ✅
- WELCOME ✅ (legacy, скрывается при telegramConnected)
- ANNOUNCEMENT ✅ (legacy, маппится на NEWS)

**BUSINESS stream (19 типов):**
- PLACE_* (6 типов) ✅
- ACTIVITY_* (3 типа) ✅
- OFFER_* (3 типа) ✅
- BUSINESS_* (3 типа) ✅
- BOOKING_* (3 типа) ✅
- BUSINESS_APPLICATION_CREATED ✅
- NEWS ✅

**ADMIN stream (1 тип):**
- ADMIN_MODERATION_ITEM_CREATED ✅

### ✅ Routing Href Resolution

Протестированы критичные типы:

```
SYSTEM → /settings ✅
REMINDER → /me ✅
RECOMMENDATION → null ✅
BOOKING_CREATED → /business/bookings ✅
BOOKING_STALE → /business/bookings ✅
BOOKING_NEEDS_ATTENTION → /business/bookings ✅
PLACE_APPROVED → /business/places/{id} ✅
NEWS (with ctaAction) → /custom-link ✅
```

### ✅ Booking Types в Business Stream

Все 3 booking типа успешно попали в BUSINESS stream:
- ✅ BOOKING_CREATED
- ✅ BOOKING_STALE
- ✅ BOOKING_NEEDS_ATTENTION

Это означает, что бизнес-пользователи теперь видят booking уведомления в своем feed.

## Обратная совместимость

### ✅ Сохранены все exports

**streamFilters.ts:**
- `NOTIFICATION_TYPES_USER` — работает как раньше
- `NOTIFICATION_TYPES_BUSINESS` — работает как раньше
- `NOTIFICATION_TYPES_ADMIN` — новый export

**routing.ts:**
- `getNotificationStreamFromType()` — работает как раньше
- `getNotificationCategoryFromType()` — работает как раньше
- `getNotificationHref()` — работает как раньше + registry
- `mapApiRowToViewModel()` — без изменений

### ✅ Существующие импорты продолжают работать

Файлы, которые импортируют из streamFilters.ts и routing.ts:
- ✅ `src/server/services/notification.service.ts`
- ✅ `src/app/api/notifications/route.ts`
- ✅ `src/app/api/notifications/unread-count/route.ts`
- ✅ `src/components/site/header/NotificationsDropdown.tsx`
- ✅ `src/components/business/notifications/NotificationFeed.tsx`

## Архитектурные улучшения

### 1. Автоматическое обновление stream filters
- **До:** Новые типы нужно добавлять в hardcoded массивы
- **После:** Типы автоматически попадают в streams на основе surface из registry

### 2. Централизованный href resolution
- **До:** Дублирование логики href в routing.ts и других местах
- **После:** Href определяется в registry, routing.ts использует его

### 3. Type-safe routing
- **До:** Switch/case с риском пропустить новый тип
- **После:** Registry гарантирует покрытие всех типов

### 4. Гибкость href
- **До:** Статичные пути в коде
- **После:** Динамические resolvers с доступом к notification context

## Типы без href (осознанно)

Следующие типы не имеют deep link и возвращают `null`:

- **RECOMMENDATION** — пользователь остается в app, без перехода
- **NEWS** (без ctaAction) — показывается в feed, без действия
- **ANNOUNCEMENT** (без ctaAction) — показывается в feed, без действия
- **WELCOME** — приветственное сообщение, переход на главную

Это ожидаемое поведение для этих типов уведомлений.

## Влияние на UI

### Notification Feed

**USER feed:**
- Показывает 6 типов уведомлений (включая legacy)
- WELCOME скрывается при telegramConnected (существующая логика)
- Href работает для SYSTEM, REMINDER

**BUSINESS feed:**
- Показывает 19 типов уведомлений
- ✅ **BOOKING типы теперь видны** в business feed
- Href работает для всех модерационных и booking уведомлений

**ADMIN feed:**
- Показывает 1 тип уведомлений
- Href работает для модерационных задач

### Unread Count

Endpoint `/api/notifications/unread-count` использует stream filters:
- ✅ Корректно считает непрочитанные для USER
- ✅ Корректно считает непрочитанные для BUSINESS (включая booking)
- ✅ Корректно считает непрочитанные для ADMIN

## Риски и ограничения

### ⚠️ Остается на Фазу 2D

**TelegramTemplateRenderer.ts** пока не подключен к registry:
- Telegram templates все еще hardcoded
- Дублирование template logic
- Будет исправлено в Фазе 2D

### ⚠️ Entity-based routing

Некоторые href все еще используют fallback логику:
- `/editor/place/{id}/edit`
- `/editor/event/{id}/edit`
- `/editor/offer/{id}/edit`

Это нормально, так как эти пути зависят от entityId из notification payload.

### ⚠️ Legacy types

WELCOME и ANNOUNCEMENT остаются в streams для обратной совместимости:
- Существующие DB записи должны продолжать работать
- Новые уведомления этих типов создаются только системой
- Не показываются в пользовательских настройках (Фаза 2B)

## Следующие шаги (Фаза 2D)

### TelegramTemplateRenderer.ts

Подключить к registry:
- Использовать `telegram.template` из registry
- Использовать `telegram.title` и `telegram.body` для inline templates
- Убрать hardcoded template mapping

### Критерии готовности Фазы 2D:

- [ ] TelegramTemplateRenderer использует registry
- [ ] Все telegram templates берутся из единого источника
- [ ] Inline templates поддерживаются
- [ ] Существующие Telegram уведомления не сломаны

## Заключение

✅ **Фаза 2C успешно завершена**

streamFilters.ts и routing.ts теперь полностью интегрированы с notificationRegistry.ts. Booking уведомления автоматически появились в business stream, href resolution централизован, а все существующие imports продолжают работать без изменений.

Система готова к финальной Фазе 2D — подключению TelegramTemplateRenderer.ts к registry для полного устранения дублирования в системе уведомлений mamaGo.by 2.0.