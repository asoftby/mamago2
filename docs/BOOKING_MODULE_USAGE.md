# Booking / Sales Module Usage Guide

## Overview

Универсальный модуль для записи на события и продажи услуг в mamaGo 2.0. Предоставляет чистый, премиальный UI для booking/sales flows с поддержкой трех режимов работы.

## Demo Location

Полная демонстрация доступна в UI Lab Admin:
- URL: `/ui-lab-admin#booking-module`
- Секция: "Booking / Sales Module"

## Key Features

- ✅ Три режима работы: Single Event, Multi Date, Slots/Course
- ✅ Премиальный, понятный UI в стиле mamaGo
- ✅ Адаптивность: desktop + mobile
- ✅ Availability states: available, low, sold-out
- ✅ Автоматический выбор первой доступной даты/слота
- ✅ Disabled state для sold out опций
- ✅ Reusable компоненты

## Architecture

### Component Structure

```
src/components/booking/
├── types.ts                      # TypeScript типы
├── mockData.ts                   # Mock данные для demo
├── BookingCard.tsx               # Главный контейнер
├── BookingDateSelector.tsx       # Выбор даты
├── BookingSlotSelector.tsx       # Выбор временного слота
└── BookingAvailabilityBadge.tsx  # Badge availability статуса
```

### Type Definitions

```typescript
type BookingMode = 'single' | 'multi-date' | 'slots';
type AvailabilityStatus = 'available' | 'low' | 'sold-out';

interface BookingProduct {
  id: string;
  mode: BookingMode;
  title: string;
  subtitle?: string;
  meta?: string;
  priceLabel: string;
  priceSubtext?: string;
  ctaLabel: string;
  dates?: BookingDateOption[];
  singleDateLabel?: string;
  singleTimeLabel?: string;
  availabilityStatus?: AvailabilityStatus;
  availabilityText?: string;
}
```

## Usage Scenarios

### Scenario A: Single Event

Для разового события с фиксированной датой и временем.

**Use Case:** Мастер-класс, разовый спектакль, workshop

**Example:**
```tsx
import { BookingCard } from "@/components/booking/BookingCard";

const product = {
  id: "event-1",
  mode: "single",
  title: "Мастер-класс по керамике",
  subtitle: "Разовое событие",
  meta: "90 минут",
  priceLabel: "35 BYN",
  priceSubtext: "за участие",
  ctaLabel: "Записаться",
  singleDateLabel: "16 марта 2026",
  singleTimeLabel: "12:00–13:30",
  availabilityStatus: "low",
};

<BookingCard product={product} />
```

**UI Behavior:**
- Дата и время отображаются статически
- Availability badge показывает остаток мест
- CTA disabled если sold out

### Scenario B: Multi Date Event

Для события с несколькими доступными датами.

**Use Case:** Спектакль с несколькими показами, выставка

**Example:**
```tsx
const product = {
  id: "event-2",
  mode: "multi-date",
  title: 'Детский спектакль "Лиса и медведь"',
  subtitle: "Театральная постановка",
  meta: "Для детей 4–8 лет • 45 минут",
  priceLabel: "25 BYN",
  ctaLabel: "Купить билет",
  dates: [
    {
      id: "date-1",
      label: "16 мар",
      isoDate: "2026-03-16",
      status: "available",
      remaining: 15,
    },
    {
      id: "date-2",
      label: "17 мар",
      isoDate: "2026-03-17",
      status: "low",
      remaining: 3,
    },
    {
      id: "date-3",
      label: "18 мар",
      isoDate: "2026-03-18",
      status: "sold-out",
      remaining: 0,
    },
  ],
};

<BookingCard product={product} />
```

**UI Behavior:**
- Пользователь выбирает дату из доступных
- Availability badge обновляется при выборе даты
- Sold out даты disabled и зачеркнуты
- Автоматически выбирается первая доступная дата

### Scenario C: Slots / Course / Service

Самый гибкий режим для услуг с выбором даты и времени.

**Use Case:** Курсы, пробные занятия, консультации

**Example:**
```tsx
const product = {
  id: "service-1",
  mode: "slots",
  title: "Пробное занятие по рисованию",
  subtitle: "Первое занятие в группе",
  meta: "Для детей 5–7 лет • 60 минут",
  priceLabel: "20 BYN",
  ctaLabel: "Записаться",
  dates: [
    {
      id: "date-1",
      label: "18 мар",
      isoDate: "2026-03-18",
      status: "available",
      remaining: 8,
      slots: [
        {
          id: "slot-1",
          label: "11:00",
          startTime: "11:00",
          endTime: "12:00",
          status: "available",
          remaining: 5,
        },
        {
          id: "slot-2",
          label: "13:00",
          startTime: "13:00",
          endTime: "14:00",
          status: "low",
          remaining: 2,
        },
      ],
    },
  ],
};

<BookingCard product={product} />
```

**UI Behavior:**
- Сначала выбор даты, затем слота
- Слоты показываются только для выбранной даты
- Sold out слоты disabled
- Availability badge показывает статус выбранного слота
- CTA disabled пока не выбран валидный слот

## State Management

### Local State
```tsx
const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
```

### Auto-Selection Logic
- При mount: автоматически выбирается первая доступная дата
- При смене даты: автоматически выбирается первый доступный слот
- CTA disabled если нет валидного выбора или sold out

## Availability States

### Visual Indicators

**Available (Есть места)**
- Badge: `bg-green-50 border-green-200 text-green-700`
- Text: "Есть места" или "Осталось X мест"

**Low (Мест мало)**
- Badge: `bg-yellow-50 border-yellow-200 text-yellow-700`
- Text: "Осталось X места" (1-4 места)

**Sold Out (Мест нет)**
- Badge: `bg-gray-100 border-gray-200 text-gray-600`
- Text: "Мест нет"
- Button/Slot: disabled + line-through

## Styling Guidelines

### Card Structure
```tsx
<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
  {/* Header: title, subtitle, meta, price */}
  <div className="p-6 space-y-3">...</div>
  
  {/* Content: date/slot selectors, availability */}
  <div className="px-6 pb-6 space-y-4">...</div>
  
  {/* CTA */}
  <div className="px-6 pb-6">...</div>
</div>
```

### Typography
- Title: `text-lg font-semibold text-gray-900`
- Subtitle: `text-sm text-gray-600`
- Meta: `text-xs text-gray-500`
- Price: `text-2xl font-bold text-gray-900`
- Price subtext: `text-xs text-gray-500`

### Spacing
- Card padding: `p-6`
- Section spacing: `space-y-3` (header), `space-y-4` (content)
- Button height: `h-11`

### Mobile Adaptations
- Slot grid: `grid-cols-2 md:grid-cols-3`
- Full-width CTA button
- Compact spacing maintained

## Integration Points

### Events Module
```tsx
// В event wizard или event detail page
import { BookingCard } from "@/components/booking/BookingCard";

// Преобразовать event data в BookingProduct format
const bookingProduct = {
  mode: event.hasMultipleDates ? 'multi-date' : 'single',
  title: event.title,
  // ... map остальные поля
};

<BookingCard product={bookingProduct} />
```

### Offers Module
```tsx
// Для курсов и услуг с расписанием
const bookingProduct = {
  mode: 'slots',
  title: offer.title,
  dates: offer.schedule.map(/* transform to BookingDateOption */),
  // ...
};

<BookingCard product={bookingProduct} />
```

### Business Flows
```tsx
// Embed в wizard steps или standalone booking pages
<div className="max-w-2xl mx-auto">
  <BookingCard product={bookingProduct} />
</div>
```

## Best Practices

### DO ✅
- Используйте правильный mode для вашего use case
- Предоставляйте realistic availability data
- Автоматически выбирайте первую доступную опцию
- Показывайте clear availability indicators
- Disable sold out опции
- Используйте понятные CTA labels

### DON'T ❌
- Не показывайте selector если опция одна
- Не перегружайте meta информацией
- Не используйте агрессивные цвета
- Не показывайте все слоты сразу (группируйте по датам)
- Не делайте CTA clickable если sold out
- Не забывайте про mobile адаптацию

## Technical Notes

### Performance
- Используется `useMemo` для вычисляемых значений
- Минимальные re-renders при выборе даты/слота

### Accessibility
- Все buttons имеют proper disabled states
- Clear visual feedback для selections
- Keyboard navigation support

### Future Enhancements
- Интеграция с реальным API
- Payment flow integration
- Calendar view для date selection
- Recurring events support
- Group booking support

## Files Created

```
src/components/booking/
├── types.ts
├── mockData.ts
├── BookingCard.tsx
├── BookingDateSelector.tsx
├── BookingSlotSelector.tsx
└── BookingAvailabilityBadge.tsx

src/app/(ui)/ui-lab-admin/_sections/
└── BookingModuleSection.tsx

docs/
└── BOOKING_MODULE_USAGE.md
```

## Next Steps

1. Интегрировать в Events module для event registration
2. Интегрировать в Offers module для course/service booking
3. Добавить payment flow integration
4. Создать API endpoints для booking operations
5. Добавить confirmation flow после booking

---

**Created:** March 14, 2026  
**Status:** ✅ Complete - Ready for integration
