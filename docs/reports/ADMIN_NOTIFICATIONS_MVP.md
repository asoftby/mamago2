# Admin Notifications MVP - Complete

## Цель
Реализовать MVP систему уведомлений администратора для проверки UX и механики без подключения базы данных.

## Что реализовано

### 1. Типы и структура данных

Файл: `src/lib/mocks/adminNotifications.ts`

**Тип уведомления:**
```typescript
type AdminNotificationType = "MODERATION" | "B2B" | "PAYMENT" | "SYSTEM";

interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  description?: string;
  link?: string;
  createdAt: string;
  read: boolean;
}
```

**Mock данные:**
- 6 уведомлений разных типов
- 3 непрочитанных (read: false)
- Разные временные метки (от 15 минут до 1 дня назад)
- Ссылки на соответствующие разделы админки

### 2. Компонент AdminNotificationItem

Файл: `src/components/admin/notifications/AdminNotificationItem.tsx`

**Визуальные элементы:**
- Type badge с цветовой кодировкой:
  - MODERATION: желтый (bg-yellow-100)
  - B2B: фиолетовый (bg-purple-100)
  - PAYMENT: зеленый (bg-green-100)
  - SYSTEM: красный (bg-red-100)
- Синяя точка слева для непрочитанных
- Bold текст для непрочитанных
- Hover state (bg-gray-50)
- Относительное время (formatDistanceToNow)

**Поведение:**
- Клик по уведомлению:
  - Помечает как прочитанное
  - Переходит по ссылке (если есть)
- Line-clamp для длинных описаний

### 3. Компонент AdminNotificationsDropdown

Файл: `src/components/admin/notifications/AdminNotificationsDropdown.tsx`

**Структура:**
- Header:
  - Заголовок "Уведомления"
  - Счетчик непрочитанных
- Список уведомлений:
  - Максимум 5 уведомлений
  - Scroll если больше
  - max-h-[400px]
- Footer:
  - Кнопка "Посмотреть все" (если > 5)

**Badge на колокольчике:**
- Красный круг с числом непрочитанных
- Показывается только если unreadCount > 0
- Позиция: absolute -top-1 -right-1

**State management:**
- useState для notifications
- handleMarkAsRead обновляет read: true
- Реактивный unreadCount

### 4. Интеграция в AdminHeader

Файл: `src/components/admin/AdminHeader.tsx`

- Заменил простую кнопку Bell на AdminNotificationsDropdown
- Dropdown открывается по клику
- Align: end (справа)
- Width: 400px

## UX особенности

### Цветовая система
- **MODERATION** (желтый): требует внимания, но не критично
- **B2B** (фиолетовый): бизнес-процессы, партнерство
- **PAYMENT** (зеленый): финансы, позитивные события
- **SYSTEM** (красный): ошибки, требует немедленного внимания

### Визуальная иерархия
1. Badge на колокольчике - первый индикатор
2. Синяя точка - непрочитанное уведомление
3. Bold текст - усиление внимания
4. Type badge - категоризация
5. Относительное время - контекст

### Интерактивность
- Hover states на всех элементах
- Плавные transitions
- Четкие зоны клика
- Scroll для длинных списков

## Технические детали

### Состояние
- Local state в AdminNotificationsDropdown
- Изменения не персистятся (MVP)
- При перезагрузке страницы - сброс к mock данным

### Форматирование времени
- date-fns/formatDistanceToNow
- Локаль: ru
- addSuffix: true ("15 минут назад")

### Ограничения
- Максимум 5 уведомлений в dropdown
- Scroll для остальных
- Line-clamp-2 для описаний

## Что НЕ реализовано (намеренно)

1. **База данных** - используются mock данные
2. **API endpoints** - нет запросов к серверу
3. **Real-time updates** - нет WebSocket/polling
4. **Страница /admin/notifications** - только dropdown
5. **Фильтры** - нет фильтрации по типам
6. **Bulk actions** - нет "отметить все как прочитанное"
7. **Удаление** - нельзя удалить уведомление
8. **Настройки** - нет управления подписками

## Следующие шаги (после MVP)

1. Создать таблицу AdminNotification в Prisma
2. Реализовать API endpoints:
   - GET /api/admin/notifications
   - PATCH /api/admin/notifications/:id/read
   - DELETE /api/admin/notifications/:id
3. Добавить real-time через WebSocket или polling
4. Создать страницу /admin/notifications с полным списком
5. Добавить фильтры и поиск
6. Реализовать настройки уведомлений
7. Добавить email/push уведомления

## Результат

MVP готов для тестирования UX:
- Dropdown работает
- Badge показывает количество
- Уведомления кликабельны
- Визуальная система понятна
- Можно оценить удобство механики

Следующий шаг - собрать feedback и решить, нужны ли изменения перед подключением к базе.
