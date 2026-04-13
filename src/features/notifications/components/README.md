# SystemNotificationCard

Единый reusable компонент для системных/pinned уведомлений в центре уведомлений mamaGo 2.0.

## Принципы дизайна

- **Цвет = смысл**: каждый тип уведомления имеет свой tone (telegram, email, neutral)
- **Структура = единая**: все уведомления используют одинаковый layout
- **Mobile-first**: адаптивная типографика и отступы
- **Premium & calm**: современный, лёгкий, без визуального шума

## Структура карточки

```
┌─────────────────────────────────────┐
│ [icon] Title              [X]       │
│        Description                  │
│                                     │
│ [Action Button - full width]       │
└─────────────────────────────────────┘
```

- Иконка слева (4x4, strokeWidth 1.75)
- Крестик справа сверху (если dismissible)
- Title: semibold, 14px
- Description: regular, 12px → 14px (sm)
- Action button: full-width, снизу

## API

```tsx
type SystemNotificationCardProps = {
  icon: React.ReactNode;           // Иконка слева
  title: string;                   // Заголовок
  description: string;             // Описание
  actionLabel?: string;            // Текст кнопки
  onAction?: () => void;           // Обработчик действия
  onDismiss?: () => void;          // Обработчик закрытия
  dismissible?: boolean;           // Показывать крестик
  loading?: boolean;               // Состояние загрузки
  tone?: "telegram" | "email" | "neutral";  // Визуальный тон
  className?: string;              // Дополнительные стили
};
```

## Цветовая семантика

### Telegram (tone="telegram")
- Светлый голубой фон: `bg-sky-50/90`
- Голубая граница: `border-sky-200`
- Синяя иконка: `text-sky-600`
- Тёмный текст: `text-sky-950` / `text-sky-900/85`

### Email (tone="email")
- Тёплый светлый фон: `bg-amber-50/90`
- Тёплая граница: `border-amber-200`
- Тёплая иконка: `text-amber-700`
- Тёмный текст: `text-amber-950` / `text-amber-900/85`

### Neutral (tone="neutral")
- Нейтральный фон: `bg-neutral-50`
- Нейтральная граница: `border-neutral-200`
- Нейтральная иконка: `text-neutral-600`
- Тёмный текст: `text-neutral-950` / `text-neutral-700`

## Примеры использования

### Telegram уведомление

```tsx
<SystemNotificationCard
  icon={<Send className="h-4 w-4" strokeWidth={1.75} />}
  title="Подключите Telegram"
  description="Чтобы не пропускать важные уведомления и ответы."
  actionLabel="Подключить"
  onAction={handleConnect}
  tone="telegram"
/>
```

### Email уведомление

```tsx
<SystemNotificationCard
  icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
  title="Подтвердите email"
  description="Чтобы сохранить доступ к вашим идеям, планам и важным действиям."
  actionLabel="Отправить письмо"
  onAction={handleResend}
  onDismiss={handleDismiss}
  dismissible
  loading={loading}
  tone="email"
/>
```

### Нейтральное уведомление

```tsx
<SystemNotificationCard
  icon={<Bell className="h-4 w-4" strokeWidth={1.75} />}
  title="Новая функция"
  description="Теперь вы можете сохранять избранные места в коллекции."
  actionLabel="Узнать больше"
  onAction={handleLearnMore}
  tone="neutral"
/>
```

## Где используется

- `TelegramPromptBanner` - подключение Telegram
- `EmailVerificationPromptBanner` - подтверждение email
- Любые будущие системные уведомления в центре уведомлений

## Что НЕ делать

❌ Не менять позицию action button (всегда снизу, full-width)  
❌ Не использовать разные размеры иконок  
❌ Не менять иерархию title/description  
❌ Не добавлять сложные layouts внутри карточки  
❌ Не смешивать цветовую семантику между типами  

## Расширение

Для добавления нового типа уведомления:

1. Добавьте новый tone в `toneStyles` объект
2. Определите цветовую палитру (container, icon, title, description)
3. Создайте wrapper компонент (как `TelegramPromptBanner`)
4. Используйте `SystemNotificationCard` с новым tone

```tsx
// Пример нового tone
const toneStyles = {
  // ...existing tones
  success: {
    container: "border-green-200 bg-green-50/90",
    icon: "text-green-600",
    title: "text-green-950",
    description: "text-green-900/85",
  },
};
```
