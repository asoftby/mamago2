# Notification Registry — Фаза 2A Отчёт

**Дата:** 12 мая 2026  
**Статус:** ✅ Завершено  
**Цель:** Создать единый registry для системы уведомлений mamaGo.by 2.0

## Что сделано

### 1. Создан файл `src/lib/notifications/notificationRegistry.ts`

Единый источник правды для всех типов уведомлений с полным описанием:

- **26 типов уведомлений** включены в registry
- **Client-safe** — без server-only зависимостей
- **Type-safe** — полная типизация TypeScript
- **Extensible** — легко добавлять новые типы

### 2. Структура каждого типа уведомления

```typescript
interface NotificationRegistryEntry {
  type: string;                    // NotificationType из Prisma
  audience: NotificationAudience;  // USER | BUSINESS | ADMIN
  surface: NotificationSurface;    // USER | BUSINESS | ADMIN  
  groupId: string;                 // Группа для настроек
  label: string;                   // Человекочитаемое название
  description: string;             // Описание
  defaultChannels: {               // Каналы по умолчанию
    inApp: boolean;
    email: boolean;
    telegram: boolean;
  };
  entityType?: string;             // Тип сущности (PLACE, BOOKING, etc.)
  ctaLabel?: string;               // Текст кнопки действия
  resolveHref?: Function;          // Функция построения ссылки
  telegram: {                      // Настройки Telegram
    enabledByDefault: boolean;
    template?: string;             // Ключ шаблона или inline
    title?: string;                // Inline заголовок
    body?: string;                 // Inline тело
  };
  importance: NotificationImportance; // LOW | NORMAL | HIGH | CRITICAL
  category: NotificationCategory;     // SYSTEM | MODERATION | BOOKING | etc.
}
```

### 3. Включённые типы уведомлений

#### System & Welcome (4 типа)
- `WELCOME` — Приветственное сообщение
- `SYSTEM` — Системные уведомления  
- `REMINDER` — Напоминания о событиях
- `RECOMMENDATION` — Персональные рекомендации
- `NEWS` — Новости платформы
- `ANNOUNCEMENT` — Важные объявления

#### Place Moderation (6 типов)
- `PLACE_APPROVED` — Место одобрено
- `PLACE_NEEDS_CHANGES` — Место требует изменений
- `PLACE_REJECTED` — Место отклонено
- `PLACE_UPDATE_APPROVED` — Обновление места одобрено
- `PLACE_UPDATE_NEEDS_REVISION` — Обновление требует доработки
- `PLACE_UPDATE_REJECTED` — Обновление отклонено

#### Activity Moderation (3 типа)
- `ACTIVITY_APPROVED` — Активность одобрена
- `ACTIVITY_NEEDS_CHANGES` — Активность требует изменений
- `ACTIVITY_REJECTED` — Активность отклонена

#### Offer Moderation (3 типа)
- `OFFER_APPROVED` — Предложение одобрено
- `OFFER_NEEDS_CHANGES` — Предложение требует изменений
- `OFFER_REJECTED` — Предложение отклонено

#### Business Verification (4 типа)
- `BUSINESS_VERIFIED` — Бизнес верифицирован
- `BUSINESS_REJECTED` — Заявка на бизнес отклонена
- `BUSINESS_NEEDS_INFO` — Нужна дополнительная информация
- `BUSINESS_APPLICATION_CREATED` — Новая заявка на бизнес (для админов)

#### Admin (1 тип)
- `ADMIN_MODERATION_ITEM_CREATED` — Новый элемент на модерацию

#### Booking (3 типа)
- `BOOKING_CREATED` — Новая заявка
- `BOOKING_STALE` — Заявка ждёт ответа
- `BOOKING_NEEDS_ATTENTION` — Требует внимания

### 4. Helper функции

```typescript
// Основные
getNotificationRegistryEntry(type: string)
getNotificationTypesForSurface(surface: NotificationSurface)
getNotificationTypesForAudience(audience: NotificationAudience)
getNotificationDefaultChannels(type: string)
resolveNotificationHref(type: string, notification: object)

// Для замены существующих файлов
getNotificationSettingsRows(surface: NotificationSurface)
getNotificationStreamTypes(surface: NotificationSurface)

// Dev validation
validateNotificationRegistry(prismaNotificationTypes: string[])
```

### 5. Dev-only validation

Добавлена проверка в `src/server/services/notification.service.ts`:

- Сравнивает registry с Prisma enum `NotificationType`
- Выводит warnings в development mode
- Помогает поддерживать синхронизацию

### 6. Проверка совместимости

✅ **TypeScript компиляция:** Registry файл компилируется без ошибок  
✅ **Runtime импорт:** Registry успешно загружается (26 entries)  
✅ **Client-safe:** Нет server-only зависимостей  
✅ **Обратная совместимость:** Существующие уведомления не сломаны  

## Анализ соответствия с Prisma enum

### ✅ Типы в registry (26 из 26 проверенных)

Все запрошенные типы успешно добавлены в registry:

- WELCOME ✅
- SYSTEM ✅  
- REMINDER ✅
- RECOMMENDATION ✅
- NEWS ✅
- ANNOUNCEMENT ✅
- PLACE_APPROVED ✅
- PLACE_NEEDS_CHANGES ✅
- PLACE_REJECTED ✅
- PLACE_UPDATE_APPROVED ✅
- PLACE_UPDATE_NEEDS_REVISION ✅
- PLACE_UPDATE_REJECTED ✅
- ACTIVITY_APPROVED ✅
- ACTIVITY_NEEDS_CHANGES ✅
- ACTIVITY_REJECTED ✅
- OFFER_APPROVED ✅
- OFFER_NEEDS_CHANGES ✅
- OFFER_REJECTED ✅
- BUSINESS_VERIFIED ✅
- BUSINESS_REJECTED ✅
- BUSINESS_NEEDS_INFO ✅
- BUSINESS_APPLICATION_CREATED ✅
- ADMIN_MODERATION_ITEM_CREATED ✅
- BOOKING_CREATED ✅
- BOOKING_STALE ✅
- BOOKING_NEEDS_ATTENTION ✅

### ⚠️ Потенциальные расхождения

Dev validation покажет в runtime:
- Какие типы есть в Prisma enum, но отсутствуют в registry
- Какие типы есть в registry, но отсутствуют в Prisma enum

## Следующие шаги (Фаза 2B)

### Файлы для подключения к registry:

1. **`src/lib/notifications/settingsDomain.ts`**
   - Заменить hardcoded группы на `getNotificationSettingsRows()`
   - Использовать registry для labels и descriptions

2. **`src/lib/notifications/streamFilters.ts`**
   - Заменить `NOTIFICATION_TYPES_*` на `getNotificationStreamTypes()`
   - Упростить логику фильтрации

3. **`src/lib/notifications/routing.ts`**
   - Использовать `resolveNotificationHref()` из registry
   - Убрать дублирование CTA logic

4. **`src/server/services/telegram/TelegramTemplateRenderer.ts`**
   - Использовать telegram config из registry
   - Унифицировать template resolution

### Критерии готовности Фазы 2B:

- [ ] settingsDomain.ts использует registry
- [ ] streamFilters.ts использует registry  
- [ ] routing.ts использует registry
- [ ] TelegramTemplateRenderer.ts использует registry
- [ ] Все существующие тесты проходят
- [ ] `pnpm tsc --noEmit` проходит
- [ ] Dev validation не показывает warnings

## Архитектурные решения

### 1. Client-safe дизайн
Registry можно импортировать как в server, так и в client коде без проблем.

### 2. Extensible структура
Легко добавлять новые поля в `NotificationRegistryEntry` без breaking changes.

### 3. Type safety
Полная типизация предотвращает ошибки на этапе компиляции.

### 4. Single source of truth
Один файл содержит всю информацию о типах уведомлений.

### 5. Backward compatibility
Существующие notify* helpers продолжают работать без изменений.

## Заключение

✅ **Фаза 2A успешно завершена**

Создан мощный и гибкий Notification Registry, который станет основой для унификации системы уведомлений mamaGo.by 2.0. Registry готов к использованию в Фазе 2B для постепенной замены дублированного кода в settingsDomain.ts, streamFilters.ts, routing.ts и TelegramTemplateRenderer.ts.

Система остается полностью обратно совместимой, а dev validation поможет поддерживать синхронизацию между registry и Prisma enum в будущем.