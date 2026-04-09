# Унификация системных уведомлений mamaGo 2.0

## Выполнено

Приведены системные уведомления в центре уведомлений к единому визуальному формату с сохранением цветовой семантики.

## Изменённые файлы

### 1. Новый базовый компонент
**`src/features/notifications/components/SystemNotificationCard.tsx`** (новый)
- Единый reusable компонент для всех системных уведомлений
- Поддержка 3 тонов: telegram, email, neutral
- Единая структура: icon → title → description → action button
- Dismissible опция с крестиком справа сверху
- Loading state для кнопки действия
- Mobile-first дизайн

### 2. Telegram уведомление
**`src/components/business/notifications/TelegramPromptBanner.tsx`** (обновлён)
- Переведён на `SystemNotificationCard`
- Новый текст:
  - Заголовок: "Подключите Telegram"
  - Описание: "Чтобы не пропускать важные уведомления и ответы."
  - Кнопка: "Подключить"
- Сохранена голубая цветовая схема (tone="telegram")
- Сохранена аналитика (trackNotificationEvent)

### 3. Email уведомление
**`src/components/business/notifications/EmailVerificationPromptBanner.tsx`** (обновлён)
- Переведён на `SystemNotificationCard`
- Сокращённый текст:
  - Заголовок: "Подтвердите email"
  - Описание: "Чтобы сохранить доступ к вашим идеям, планам и важным действиям."
  - Кнопка: "Отправить письмо"
- Сохранена тёплая цветовая схема (tone="email")
- Сохранён dismissible функционал
- Сохранена вся бизнес-логика (resend, rate-limit, success/error)

### 4. Документация
**`src/features/notifications/components/README.md`** (новый)
- Полное описание API компонента
- Примеры использования
- Цветовая семантика
- Руководство по расширению

## Единый layout

Все системные уведомления теперь используют одинаковую структуру:

```
┌─────────────────────────────────────┐
│ [icon] Title              [X]       │
│        Description                  │
│                                     │
│ [Action Button - full width]       │
└─────────────────────────────────────┘
```

### Единые параметры:
- Иконка: 4x4, strokeWidth 1.75
- Title: font-semibold, text-sm
- Description: text-xs sm:text-sm, leading-snug
- Action button: full-width, bg-[#EF8759]
- Border radius: rounded-lg
- Padding: px-4 py-3
- Gap: gap-3

## Цветовая семантика (сохранена)

### Telegram
- Фон: `bg-sky-50/90`
- Граница: `border-sky-200`
- Иконка: `text-sky-600`
- Текст: `text-sky-950` / `text-sky-900/85`

### Email
- Фон: `bg-amber-50/90`
- Граница: `border-amber-200`
- Иконка: `text-amber-700`
- Текст: `text-amber-950` / `text-amber-900/85`

## Что НЕ изменилось

✅ Бизнес-логика уведомлений  
✅ Обработчики dismiss/action  
✅ Аналитика (trackNotificationEvent)  
✅ Rate-limiting для email  
✅ Success/error UX  
✅ Архитектура notification center  
✅ Позиция в NotificationFeed  

## Преимущества

1. **Единообразие**: все системные уведомления выглядят как часть одной дизайн-системы
2. **Масштабируемость**: легко добавить новые типы уведомлений
3. **Поддерживаемость**: один компонент вместо разрозненной вёрстки
4. **Консистентность**: одинаковые отступы, типографика, иерархия
5. **Семантика**: цвет сохраняет смысл типа уведомления

## Как добавить новое уведомление

```tsx
import { SystemNotificationCard } from "@/features/notifications/components/SystemNotificationCard";
import { Bell } from "lucide-react";

export function NewNotificationBanner() {
  return (
    <SystemNotificationCard
      icon={<Bell className="h-4 w-4" strokeWidth={1.75} />}
      title="Заголовок"
      description="Описание уведомления."
      actionLabel="Действие"
      onAction={handleAction}
      tone="neutral" // или telegram, email
    />
  );
}
```

## Результат

Системные уведомления в центре уведомлений теперь:
- Визуально единообразны
- Сохраняют цветовую семантику
- Легко расширяются
- Соответствуют дизайн-системе mamaGo 2.0
- Premium, light, calm, modern
