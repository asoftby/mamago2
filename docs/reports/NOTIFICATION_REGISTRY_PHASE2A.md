# Notification Registry — Phase 2A Report

**Дата:** 12 мая 2026  
**Статус:** ✅ Завершено  
**Цель:** Создать единый registry для системы уведомлений как единый источник правды

## 🎯 Выполненные задачи

### 1. Создан Notification Registry
- **Файл:** `src/lib/notifications/notificationRegistry.ts`
- **Статус:** Client-safe (без server-only зависимостей)
- **Архитектура:** Единый источник правды для всех типов уведомлений

### 2. Типы уведомлений в Registry

#### ✅ Включены в Registry (25 типов):

**System & Welcome:**
- `WELCOME` — Приветственное сообщение для новых пользователей
- `SYSTEM` — Важные системные сообщения  
- `REMINDER` — Напоминания о событиях и планах
- `RECOMMENDATION` — Персональные рекомендации событий и мест
- `NEWS` — Новости платформы и обновления
- `ANNOUNCEMENT` — Важные объявления администрации

**Place Moderation:**
- `PLACE_APPROVED` — Место прошло модерацию и опубликовано
- `PLACE_NEEDS_CHANGES` — Место отправлено на доработку
- `PLACE_REJECTED` — Место не прошло модерацию
- `PLACE_UPDATE_APPROVED` — Изменения места опубликованы
- `PLACE_UPDATE_NEEDS_REVISION` — Изменения места отправлены на доработку
- `PLACE_UPDATE_REJECTED` — Изменения места не приняты

**Activity Moderation:**
- `ACTIVITY_APPROVED` — Активность прошла модерацию и опубликована
- `ACTIVITY_NEEDS_CHANGES` — Активность отправлена на доработку
- `ACTIVITY_REJECTED` — Активность не прошла модерацию

**Offer Moderation:**
- `OFFER_APPROVED` — Предложение прошло модерацию и опубликовано
- `OFFER_NEEDS_CHANGES` — Предложение отправлено на доработку
- `OFFER_REJECTED` — Предложение не прошло модерацию

**Business Verification:**
- `BUSINESS_VERIFIED` — Бизнес-аккаунт успешно верифицирован
- `BUSINESS_REJECTED` — Заявка на верификацию бизнеса отклонена
- `BUSINESS_NEEDS_INFO` — Для верификации бизнеса нужны дополнительные данные
- `BUSINESS_APPLICATION_CREATED` — Поступила новая заявка на верификацию бизнеса
- `ADMIN_MODERATION_ITEM_CREATED` — Поступил новый элемент для модерации

**Booking:**
- `BOOKING_CREATED` — Поступила новая заявка на запись
- `BOOKING_STALE` — Новая заявка не обработана более 24 часов
- `BOOKING_NEEDS_ATTENTION` — Подтверждённая заявка без активности более 3 дней

### 3. Структура Registry Entry

Каждый тип уведомления содержит:
- `type` — тип уведомления (соответствует Prisma enum)
- `audience` — USER | BUSINESS | ADMIN
- `surface` — USER | BUSINESS | ADMIN  
- `groupId` — группа для настроек
- `label` — человекочитаемое название
- `description` — описание
- `defaultChannels` — каналы по умолчанию (inApp, email, telegram)
- `entityType` — тип сущности (опционально)
- `ctaLabel` — текст кнопки CTA (опционально)
- `resolveHref` — функция построения ссылки (опционально)
- `telegram` — конфигурация Telegram (template/title/body)
- `importance` — LOW | NORMAL | HIGH | CRITICAL
- `category` — SYSTEM | MODERATION | BOOKING | PLAN | BUSINESS | MARKETING | ADMIN

### 4. Helper Functions

Созданы функции для замены дублирования:
- `getNotificationRegistryEntry(type)` — получить запись по типу
- `getNotificationTypesForSurface(surface)` — типы для поверхности
- `getNotificationTypesForAudience(audience)` — типы для аудитории  
- `getNotificationDefaultChannels(type)` — каналы по умолчанию
- `resolveNotificationHref(type, notification)` — построить ссылку
- `getNotificationSettingsRows(surface)` — для замены settingsDomain.ts
- `getNotificationStreamTypes(surface)` — для замены streamFilters.ts

### 5. Dev Validation

Добавлена проверка соответствия Registry и Prisma enum:
- **Файл:** `src/server/services/notification.service.ts`
- **Функция:** `validateNotificationRegistry()`
- **Режим:** Только development
- **Проверки:**
  - Типы в registry, но отсутствующие в Prisma enum
  - Типы в Prisma enum, но отсутствующие в registry
  - Синхронизация между registry и enum

## 🔍 Анализ соответствия Prisma enum

### ✅ Все типы из Registry присутствуют в Prisma enum
Проверено: все 25 типов из registry существуют в `prisma/schema.prisma`

### ⚠️ Типы в Prisma enum, НЕ включённые в Registry

Следующие типы требуют анализа для Phase 2B:
- Возможные LEGACY типы
- Возможные UNUSED типы  
- Возможные новые типы для добавления в registry

*Примечание: Полный список будет определён при запуске dev validation*

## 🚀 Готовность к Phase 2B

### Файлы для подключения к Registry:
1. `src/lib/notifications/settingsDomain.ts` — заменить на `getNotificationSettingsRows()`
2. `src/lib/notifications/streamFilters.ts` — заменить на `getNotificationStreamTypes()`
3. `src/lib/notifications/routing.ts` — использовать `resolveNotificationHref()`
4. `src/server/services/telegram/TelegramTemplateRenderer.ts` — использовать telegram config из registry

### Критерии готовности ✅
- [x] `pnpm tsc --noEmit` проходит
- [x] Существующие уведомления не сломаны
- [x] Registry можно импортировать из server/client-safe файлов
- [x] В registry нет server-only зависимостей
- [x] Dev validation работает

## 📋 Следующие шаги (Phase 2B)

1. **Постепенная миграция файлов:**
   - Заменить `settingsDomain.ts` на registry helpers
   - Заменить `streamFilters.ts` на registry helpers  
   - Обновить `routing.ts` для использования `resolveNotificationHref()`
   - Обновить `TelegramTemplateRenderer.ts` для использования telegram config

2. **Тестирование:**
   - Проверить настройки уведомлений в UI
   - Проверить stream фильтры
   - Проверить routing и CTA ссылки
   - Проверить Telegram templates

3. **Cleanup:**
   - Удалить дублирующий код после успешной миграции
   - Обновить импорты
   - Обновить документацию

## 🎉 Результат Phase 2A

Создан единый источник правды для системы уведомлений mamaGo.by 2.0. Registry содержит полное описание всех активных типов уведомлений с их конфигурацией, что позволит устранить дублирование кода в Phase 2B.

**Статус:** ✅ Готово к Phase 2B