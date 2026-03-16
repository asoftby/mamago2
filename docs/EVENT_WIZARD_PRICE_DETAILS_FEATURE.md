# Event Wizard - Price Details Feature

## Обзор

Добавлена возможность указывать детали стоимости для режима "Цена от" в шаге 5 Event Wizard.

## Проблема

Раньше режим "Цена от" позволял указать только минимальную цену, но у событий часто есть разные категории билетов:
- Детский билет
- Взрослый билет
- Семейный билет
- Льготный билет

Бизнесу нужно было место, где можно указать эти варианты.

## Решение

Добавлено опциональное поле `priceDetails` (textarea), которое показывается ТОЛЬКО при выборе режима "Цена от".

## Архитектура

### 1. Модель данных

#### EventFormData (types.ts)
```typescript
interface EventFormData {
  // ...
  pricingMode: "free" | "fixed" | "from" | "on-request";
  price: string;
  priceDetails: string; // NEW - Optional details for "from" mode
  ticketLink: string;
  // ...
}
```

#### Prisma Schema
```prisma
model Activity {
  // ...
  priceFrom    Float?
  priceTo      Float?
  priceText    String?
  priceDetails String? // NEW - Optional price breakdown
  currency     String? @default("BYN")
  // ...
}
```

#### Mock Data (activity.types.ts)
```typescript
interface ActivityMock {
  // ...
  priceMin?: number;
  priceMax?: number;
  priceDetails?: string; // NEW
  currency: 'BYN';
  // ...
}
```

### 2. UI компонент (Step5PricingParticipation.tsx)

Поле показывается только если `pricingMode === "from"`:

```tsx
{data.pricingMode === "from" && (
  <div className="space-y-2">
    <Label htmlFor="priceDetails">
      Детали стоимости (опционально)
    </Label>
    <textarea
      id="priceDetails"
      value={data.priceDetails}
      onChange={(e) => onChange({ priceDetails: e.target.value })}
      placeholder="Дети — 30 BYN&#10;Взрослые — 50 BYN&#10;Семейный билет — 80 BYN"
      rows={4}
      disabled={!isEditable}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md..."
    />
    <p className="text-xs text-gray-600">
      Укажите варианты цен, если стоимость зависит от категории
    </p>
  </div>
)}
```

### 3. Отображение на странице события

#### Карточка события (ActivityCard.tsx)
Показывает только: **"от 30 BYN"**

#### Страница события (activity/[id]/page.tsx)
Показывает блок с деталями:

```tsx
{priceLabel && (
  <div className="space-y-3">
    <div className="text-2xl font-semibold text-primary">
      {priceLabel}
    </div>
    
    {/* Price Details - if available */}
    {activity.priceDetails && (
      <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
        <div className="text-sm font-medium text-foreground mb-2">
          Стоимость
        </div>
        <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
          {activity.priceDetails}
        </div>
      </div>
    )}
  </div>
)}
```

## Примеры использования

### Пример 1: Мастер-класс с разными ценами

**В wizard:**
```
Режим стоимости: Цена от
Цена от: 30
Детали стоимости:
Дети — 30 BYN
Взрослые — 50 BYN
Семейный билет (2 взрослых + 2 детей) — 80 BYN
```

**На карточке:**
```
от 30 BYN
```

**На странице события:**
```
┌─────────────────────────────────────┐
│ от 30 BYN                           │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Стоимость                       │ │
│ │                                 │ │
│ │ Дети — 30 BYN                   │ │
│ │ Взрослые — 50 BYN               │ │
│ │ Семейный билет (2+2) — 80 BYN   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Пример 2: Спектакль с категориями мест

**В wizard:**
```
Режим стоимости: Цена от
Цена от: 25
Детали стоимости:
Партер — 50 BYN
Амфитеатр — 35 BYN
Балкон — 25 BYN
Льготный билет — 20 BYN
```

**На странице события:**
```
┌─────────────────────────────────────┐
│ от 25 BYN                           │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Стоимость                       │ │
│ │                                 │ │
│ │ Партер — 50 BYN                 │ │
│ │ Амфитеатр — 35 BYN              │ │
│ │ Балкон — 25 BYN                 │ │
│ │ Льготный билет — 20 BYN         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## UX принципы

### 1. Progressive Disclosure
Поле показывается ТОЛЬКО если выбран режим "Цена от". Не перегружает форму для других режимов.

### 2. Опциональность
Поле не обязательное. Если бизнес не хочет детализировать цены - может оставить пустым.

### 3. Простота ввода
Используется простой textarea, а не сложная таблица тарифов. Бизнес просто вводит текст.

### 4. Понятный placeholder
```
Дети — 30 BYN
Взрослые — 50 BYN
Семейный билет — 80 BYN
```

### 5. Helper text
"Укажите варианты цен, если стоимость зависит от категории"

### 6. Визуальная иерархия
На странице события детали показываются в отдельном блоке с фоном и border, чтобы выделить информацию.

## Поведение

### Показ поля
```
IF pricingMode === "from"
  → показать поле priceDetails
ELSE
  → скрыть поле
```

### Сохранение
```
priceDetails сохраняется в formData
→ передается в API
→ сохраняется в Activity.priceDetails
```

### Отображение
```
Карточка: показывает только "от X BYN"
Страница: показывает "от X BYN" + блок с priceDetails (если заполнено)
```

## Файлы

### Созданные
- `docs/EVENT_WIZARD_PRICE_DETAILS_FEATURE.md` - эта документация
- `prisma/migrations/20260314081309_add_price_details_to_activity/migration.sql` - миграция БД

### Обновленные
- `src/components/business/wizard/event/types.ts` - добавлено поле `priceDetails`
- `src/components/business/wizard/event/defaults.ts` - дефолтное значение `priceDetails: ""`
- `src/components/business/wizard/event/steps/Step5PricingParticipation.tsx` - добавлен textarea для деталей
- `src/app/(public)/[city]/activity/[id]/page.tsx` - добавлено отображение блока с деталями
- `src/mocks/activity.types.ts` - добавлено поле `priceDetails?` в ActivityMock
- `prisma/schema.prisma` - добавлено поле `priceDetails String?` в Activity

## Миграция БД

```sql
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "priceDetails" TEXT;
```

Миграция применена: `20260314081309_add_price_details_to_activity`

## Валидация

Поле `priceDetails` не участвует в валидации, так как оно опциональное.

## API

При сохранении события через API, поле `priceDetails` должно передаваться в payload:

```typescript
{
  // ...
  pricingMode: "from",
  price: "30",
  priceDetails: "Дети — 30 BYN\nВзрослые — 50 BYN",
  // ...
}
```

И маппиться в Activity:

```typescript
{
  // ...
  priceFrom: 30,
  priceDetails: "Дети — 30 BYN\nВзрослые — 50 BYN",
  // ...
}
```

## Тестирование

### Чек-лист

- [ ] Поле показывается только при `pricingMode === "from"`
- [ ] Поле скрывается при других режимах
- [ ] Placeholder корректный
- [ ] Helper text отображается
- [ ] Значение сохраняется в formData
- [ ] Переключение режимов работает корректно
- [ ] На странице события блок отображается если `priceDetails` заполнено
- [ ] На странице события блок НЕ отображается если `priceDetails` пустое
- [ ] Многострочный текст отображается корректно (whitespace-pre-line)
- [ ] Mobile responsive работает

### Тестовые сценарии

1. **Создание события с деталями цены**
   - Выбрать "Цена от"
   - Ввести минимальную цену: 30
   - Заполнить детали: "Дети — 30 BYN\nВзрослые — 50 BYN"
   - Сохранить
   - Проверить на странице события

2. **Создание события без деталей**
   - Выбрать "Цена от"
   - Ввести минимальную цену: 30
   - НЕ заполнять детали
   - Сохранить
   - Проверить, что блок деталей НЕ показывается

3. **Переключение режимов**
   - Выбрать "Цена от" → поле показывается
   - Заполнить детали
   - Переключить на "Фиксированная цена" → поле скрывается
   - Переключить обратно на "Цена от" → поле показывается, значение сохранено

## Ограничения

1. **Не rich text** - используется простой textarea, без форматирования
2. **Не структурированные данные** - просто текст, не JSON с категориями
3. **Не валидация формата** - бизнес может ввести любой текст
4. **Не автоматический расчет** - минимальная цена не вычисляется из деталей

Эти ограничения сделаны намеренно, чтобы сохранить простоту UX.

## Будущие улучшения (опционально)

- [ ] Добавить preview форматирования в wizard
- [ ] Добавить шаблоны (детский/взрослый, партер/балкон и т.д.)
- [ ] Добавить валидацию формата (опционально)
- [ ] Добавить поддержку markdown для форматирования (опционально)

## Заключение

Функция добавлена максимально просто и не перегружает UX. Бизнес может указать детали цен, если нужно, или оставить поле пустым для простых событий.
