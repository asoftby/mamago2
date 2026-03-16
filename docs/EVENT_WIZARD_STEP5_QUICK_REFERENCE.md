# Event Wizard Step 5 - Quick Reference

## Быстрый старт

### Что изменилось?
Шаг 5 теперь называется "Стоимость и запись" вместо "Стоимость" и включает 3 блока вместо простой формы.

### Новые поля в EventFormData

```typescript
// Pricing
pricingMode: "free" | "fixed" | "from" | "on-request"
price: string

// Participation
participationMode: "info-only" | "simple-booking" | "time-slots" | "external-link" | "request"

// Simple booking
simpleBookingDate: string | null
simpleBookingTime: string | null
simpleBookingCapacity: number | null

// Time slots
timeSlots: {
  dates: Array<{
    id: string
    isoDate: string
    label: string
    slots: Array<{
      id: string
      startTime: string
      endTime: string
      capacity: number
    }>
  }>
}

// External link
ticketLink: string

// CTA
ctaType: "book" | "buy" | "request" | "details"
```

## Режимы стоимости

| Режим | Описание | Дополнительные поля |
|-------|----------|---------------------|
| `free` | Бесплатно | - |
| `fixed` | Фиксированная цена | `price` |
| `from` | Цена "от" | `price` |
| `on-request` | По запросу | - |

## Режимы участия

| Режим | Описание | Дополнительные поля | Когда использовать |
|-------|----------|---------------------|-------------------|
| `info-only` | Только информация | - | Анонсы, информационные события |
| `simple-booking` | Простая запись | `simpleBookingDate`, `simpleBookingTime`, `simpleBookingCapacity` | Разовые мероприятия с заявкой |
| `time-slots` | Запись по времени | `timeSlots` | Мастер-классы, групповые занятия |
| `external-link` | Покупка по ссылке | `ticketLink` | События с внешней продажей билетов |
| `request` | Оставить заявку | - | Индивидуальные консультации |

## Типы CTA

| Тип | Текст кнопки | Когда использовать |
|-----|--------------|-------------------|
| `book` | Записаться | Для booking сценариев |
| `buy` | Купить билет | Для платных событий |
| `request` | Оставить заявку | Для request сценариев |
| `details` | Подробнее | Для информационных событий |

## Валидация

### Обязательные поля

```typescript
// Всегда обязательны
✓ pricingMode
✓ participationMode
✓ ctaType

// Условно обязательны
✓ price (если pricingMode = "fixed" или "from")
✓ ticketLink (если participationMode = "external-link")
✓ simpleBookingDate (если participationMode = "simple-booking")
✓ timeSlots с датами (если participationMode = "time-slots")
```

### Проверка завершенности

```typescript
isComplete = 
  pricingMode выбран &&
  (если fixed/from → price заполнена) &&
  participationMode выбран &&
  (если external-link → ticketLink заполнена) &&
  (если simple-booking → simpleBookingDate заполнена) &&
  (если time-slots → есть даты со слотами) &&
  ctaType выбран
```

## Примеры использования

### Пример 1: Бесплатное событие без записи

```typescript
{
  pricingMode: "free",
  participationMode: "info-only",
  ctaType: "details"
}
```

### Пример 2: Платный мастер-класс с простой записью

```typescript
{
  pricingMode: "fixed",
  price: "50",
  participationMode: "simple-booking",
  simpleBookingDate: "2026-03-20",
  simpleBookingTime: "14:00–16:00",
  simpleBookingCapacity: 15,
  ctaType: "book"
}
```

### Пример 3: Курс со слотами

```typescript
{
  pricingMode: "from",
  price: "30",
  participationMode: "time-slots",
  timeSlots: {
    dates: [
      {
        id: "1",
        isoDate: "2026-03-20",
        label: "20 марта",
        slots: [
          { id: "1", startTime: "10:00", endTime: "12:00", capacity: 10 },
          { id: "2", startTime: "14:00", endTime: "16:00", capacity: 10 }
        ]
      }
    ]
  },
  ctaType: "book"
}
```

### Пример 4: Событие с внешней продажей

```typescript
{
  pricingMode: "fixed",
  price: "100",
  participationMode: "external-link",
  ticketLink: "https://tickets.example.com",
  ctaType: "buy"
}
```

### Пример 5: Консультация по запросу

```typescript
{
  pricingMode: "on-request",
  participationMode: "request",
  ctaType: "request"
}
```

## Миграция со старой версии

### Старые поля → Новые поля

```typescript
// Было
isFree: boolean
price: string
ticketLink: string
registrationRequired: boolean

// Стало
pricingMode: "free" | "fixed" | "from" | "on-request"
price: string
participationMode: "info-only" | "simple-booking" | "time-slots" | "external-link" | "request"
simpleBookingDate: string | null
simpleBookingTime: string | null
simpleBookingCapacity: number | null
timeSlots: { dates: [...] }
ticketLink: string
ctaType: "book" | "buy" | "request" | "details"
```

### Логика миграции

```typescript
// isFree → pricingMode
if (oldData.isFree) {
  newData.pricingMode = "free"
} else if (oldData.price) {
  newData.pricingMode = "fixed"
  newData.price = oldData.price
}

// registrationRequired → participationMode
if (oldData.registrationRequired) {
  newData.participationMode = "simple-booking"
} else {
  newData.participationMode = "info-only"
}

// ticketLink → participationMode + ticketLink
if (oldData.ticketLink) {
  newData.participationMode = "external-link"
  newData.ticketLink = oldData.ticketLink
}

// Default CTA
if (newData.participationMode === "simple-booking" || newData.participationMode === "time-slots") {
  newData.ctaType = "book"
} else if (newData.participationMode === "external-link") {
  newData.ctaType = "buy"
} else if (newData.participationMode === "request") {
  newData.ctaType = "request"
} else {
  newData.ctaType = "details"
}
```

## Файлы

### Основные
- `src/components/business/wizard/event/steps/Step5PricingParticipation.tsx` - компонент
- `src/components/business/wizard/event/types.ts` - типы
- `src/components/business/wizard/event/defaults.ts` - дефолты
- `src/components/business/wizard/event/eventWizardSteps.config.tsx` - конфигурация
- `src/components/business/wizard/event/validation.ts` - валидация

### Документация
- `docs/EVENT_WIZARD_STEP5_REDESIGN_COMPLETE.md` - полное описание
- `docs/EVENT_WIZARD_STEP5_VISUAL_GUIDE.md` - визуальный гайд
- `docs/EVENT_WIZARD_STEP5_QUICK_REFERENCE.md` - этот файл

## Тестирование

### Чек-лист

- [ ] Все 4 режима стоимости работают
- [ ] Все 5 режимов участия работают
- [ ] Progressive disclosure работает корректно
- [ ] Валидация работает для каждого режима
- [ ] Summary в Step 9 показывает правильные данные
- [ ] getMissingFields возвращает корректные поля
- [ ] Schedule Editor интегрирован в time-slots режим
- [ ] Mobile responsive работает
- [ ] Дефолтные значения корректны
- [ ] Миграция со старой версии работает

### Команды для тестирования

```bash
# Проверить типы
pnpm tsc --noEmit

# Проверить линтер
pnpm lint

# Запустить dev сервер
pnpm dev
```

## Поддержка

Если возникли вопросы:
1. Прочитай `EVENT_WIZARD_STEP5_REDESIGN_COMPLETE.md`
2. Посмотри `EVENT_WIZARD_STEP5_VISUAL_GUIDE.md`
3. Проверь примеры в этом файле
4. Изучи код `Step5PricingParticipation.tsx`

## Roadmap

### Ближайшие улучшения
- [ ] Preview виджета справа (как в Activity Form Builder)
- [ ] Quick presets для популярных сценариев
- [ ] Подсказки по выбору оптимального режима
- [ ] Интеграция с реальным booking API

### Будущие возможности
- [ ] Recurring slots (повторяющиеся слоты)
- [ ] Waitlist (лист ожидания)
- [ ] Dynamic pricing (динамическое ценообразование)
- [ ] Group discounts (групповые скидки)
