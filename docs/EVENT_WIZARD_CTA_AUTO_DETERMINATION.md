# Event Wizard - CTA Auto-Determination

## Обзор

Удален блок "Кнопка действия" из UI Event Wizard. CTA теперь определяется автоматически на основе `participationMode`.

## Проблема

Раньше в шаге 5 был отдельный блок "Кнопка действия", где бизнес мог выбирать:
- Записаться
- Купить билет
- Оставить заявку
- Подробнее

Это создавало:
- **Лишнюю когнитивную нагрузку** - бизнес должен был думать о двух вещах: формат участия + текст кнопки
- **Дублирование логики** - `participationMode` и `ctaType` по сути определяли одно и то же
- **Риск несоответствия** - бизнес мог выбрать "Простая запись" + кнопку "Купить билет"

## Решение

CTA определяется системой автоматически на основе `participationMode`. Бизнес не выбирает и не редактирует кнопку.

## Mapping логики

```typescript
participationMode → CTA
─────────────────────────────────────
info-only         → "Подробнее"
simple-booking    → "Записаться"
time-slots        → "Выбрать время"
external-link     → "Купить билет"
request           → "Оставить заявку"
```

## Архитектура

### 1. Удалено из UI

**Было:**
```tsx
{/* CTA Type */}
<div className="space-y-4">
  <h3>Кнопка действия</h3>
  <p>Текст кнопки, которую увидит пользователь</p>
  
  <div className="grid grid-cols-2 gap-3">
    {[
      { value: "book", label: "Записаться" },
      { value: "buy", label: "Купить билет" },
      { value: "request", label: "Оставить заявку" },
      { value: "details", label: "Подробнее" },
    ].map((cta) => (
      <button onClick={() => onChange({ ctaType: cta.value })}>
        {cta.label}
      </button>
    ))}
  </div>
</div>
```

**Стало:**
```tsx
// Блок полностью удален
// CTA определяется автоматически
```

### 2. Обновлены типы

**types.ts:**
```typescript
interface EventFormData {
  // ...
  participationMode: "info-only" | "simple-booking" | "time-slots" | "external-link" | "request";
  ctaType?: "book" | "buy" | "request" | "details"; // Optional - auto-determined
  // ...
}
```

`ctaType` сделан опциональным для backward compatibility, но больше не используется в wizard.

### 3. Удалено из валидации

**validation.ts:**
```typescript
// БЫЛО:
if (!data.ctaType) {
  warnings.push("Выберите тип кнопки действия");
}

const isComplete = Boolean(
  // ...
  data.ctaType
);

// СТАЛО:
// Валидация ctaType удалена
const isComplete = Boolean(
  // ...
  // ctaType не проверяется
);
```

### 4. Удалено из конфигурации шага

**eventWizardSteps.config.tsx:**

**isComplete():**
```typescript
// БЫЛО:
if (!data.ctaType) return false;

// СТАЛО:
// Проверка удалена
```

**getSummary():**
```typescript
// БЫЛО:
items.push({
  label: "Кнопка действия",
  value: data.ctaType ? ctaLabels[data.ctaType] : "Не выбрана",
  isMissing: !data.ctaType,
});

// СТАЛО:
// Блок удален из summary
```

**getMissingFields():**
```typescript
// БЫЛО:
if (!data.ctaType) {
  missing.push("Тип кнопки действия");
}

// СТАЛО:
// Проверка удалена
```

### 5. Создана утилита для определения CTA

**src/lib/event/getCtaFromParticipationMode.ts:**

```typescript
export function getCtaFromParticipationMode(
  participationMode: ParticipationMode
): CTAType {
  const mapping: Record<ParticipationMode, CTAType> = {
    "info-only": "details",
    "simple-booking": "book",
    "time-slots": "slot",
    "external-link": "buy",
    "request": "request",
  };
  return mapping[participationMode] || "details";
}

export function getCtaLabel(ctaType: CTAType): string {
  const labels: Record<CTAType, string> = {
    details: "Подробнее",
    book: "Записаться",
    slot: "Выбрать время",
    buy: "Купить билет",
    request: "Оставить заявку",
  };
  return labels[ctaType] || "Подробнее";
}

export function getCtaLabelFromParticipationMode(
  participationMode: ParticipationMode
): string {
  const ctaType = getCtaFromParticipationMode(participationMode);
  return getCtaLabel(ctaType);
}
```

## Использование на публичной странице

### Пример 1: Прямое использование

```tsx
import { getCtaLabelFromParticipationMode } from "@/lib/event/getCtaFromParticipationMode";

function EventPage({ event }) {
  const ctaLabel = getCtaLabelFromParticipationMode(event.participationMode);
  
  return (
    <PrimaryButton>
      {ctaLabel}
    </PrimaryButton>
  );
}
```

### Пример 2: С fallback

```tsx
import { getCtaLabelFromParticipationMode } from "@/lib/event/getCtaFromParticipationMode";

function EventPage({ event }) {
  const ctaLabel = event.participationMode 
    ? getCtaLabelFromParticipationMode(event.participationMode)
    : "Подробнее";
  
  return (
    <PrimaryButton>
      {ctaLabel}
    </PrimaryButton>
  );
}
```

### Пример 3: С кастомной логикой

```tsx
import { getCtaFromParticipationMode, getCtaLabel } from "@/lib/event/getCtaFromParticipationMode";

function EventPage({ event }) {
  const ctaType = getCtaFromParticipationMode(event.participationMode);
  
  // Можно добавить кастомную логику
  const ctaLabel = ctaType === "buy" && event.isFree 
    ? "Получить билет"
    : getCtaLabel(ctaType);
  
  return (
    <PrimaryButton>
      {ctaLabel}
    </PrimaryButton>
  );
}
```

## До и После

### БЫЛО (Step 5 UI)

```
┌─────────────────────────────────────┐
│ СТОИМОСТЬ                           │
│ [Бесплатно] [Фиксир.] [Цена от] ✓   │
│ [По запросу]                        │
│                                     │
│ Цена от (BYN): [30_____________]    │
├─────────────────────────────────────┤
│ ФОРМАТ УЧАСТИЯ                      │
│ [Только информация]                 │
│ [Простая запись] ✓                  │
│ [Запись по времени]                 │
│ [Покупка по ссылке]                 │
│ [Оставить заявку]                   │
├─────────────────────────────────────┤
│ КНОПКА ДЕЙСТВИЯ                     │  ← УДАЛЕНО
│ Текст кнопки, которую увидит        │
│ пользователь                        │
│                                     │
│ [Записаться] ✓ [Купить билет]       │
│ [Оставить заявку] [Подробнее]       │
└─────────────────────────────────────┘
```

### СТАЛО (Step 5 UI)

```
┌─────────────────────────────────────┐
│ СТОИМОСТЬ                           │
│ [Бесплатно] [Фиксир.] [Цена от] ✓   │
│ [По запросу]                        │
│                                     │
│ Цена от (BYN): [30_____________]    │
├─────────────────────────────────────┤
│ ФОРМАТ УЧАСТИЯ                      │
│ [Только информация]                 │
│ [Простая запись] ✓                  │
│ [Запись по времени]                 │
│ [Покупка по ссылке]                 │
│ [Оставить заявку]                   │
└─────────────────────────────────────┘

Кнопка определяется автоматически:
simple-booking → "Записаться"
```

## Преимущества

### 1. Упрощение UX
- Меньше полей для заполнения
- Меньше когнитивной нагрузки
- Быстрее создание события

### 2. Устранение несоответствий
- Невозможно выбрать "Простая запись" + "Купить билет"
- Логика всегда согласована
- Меньше ошибок бизнеса

### 3. Чистая архитектура
- Один источник истины: `participationMode`
- Нет дублирования логики
- Проще поддержка

### 4. Гибкость
- Можно добавить кастомную логику на публичной странице
- Можно переопределить CTA для специальных случаев
- Централизованная логика в одном месте

## Backward Compatibility

### Существующие события

Если в БД есть события с заполненным `ctaType`:
- Поле остается в типах как опциональное
- При отображении приоритет: `ctaType` (если есть) → auto-determined
- При редактировании: `ctaType` игнорируется, используется `participationMode`

### Миграция (опционально)

Если нужно очистить старые данные:

```sql
-- Удалить ctaType из существующих событий
UPDATE "Activity" SET "ctaType" = NULL;

-- Или удалить колонку (если она есть в схеме)
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "ctaType";
```

## Файлы

### Обновленные
- `src/components/business/wizard/event/steps/Step5PricingParticipation.tsx` - удален блок CTA
- `src/components/business/wizard/event/types.ts` - `ctaType` сделан опциональным
- `src/components/business/wizard/event/defaults.ts` - удален `ctaType` из дефолтов
- `src/components/business/wizard/event/eventWizardSteps.config.tsx` - удалена валидация и summary CTA
- `src/components/business/wizard/event/validation.ts` - удалена валидация `ctaType`
- `src/app/(public)/[city]/activity/[id]/page.tsx` - добавлен комментарий о CTA

### Созданные
- `src/lib/event/getCtaFromParticipationMode.ts` - утилита для определения CTA
- `docs/EVENT_WIZARD_CTA_AUTO_DETERMINATION.md` - эта документация

### НЕ изменены
- `src/components/activity-builder/*` - Activity Builder использует свою логику CTA

## Тестирование

### Чек-лист

- [ ] Блок "Кнопка действия" удален из UI
- [ ] Шаг 5 корректно отображается без блока
- [ ] `participationMode` сохраняется корректно
- [ ] Валидация шага работает без `ctaType`
- [ ] Summary в Step 9 не показывает CTA
- [ ] `getCtaFromParticipationMode()` возвращает правильные значения
- [ ] `getCtaLabel()` возвращает правильные лейблы
- [ ] Публичная страница может использовать утилиту

### Тестовые сценарии

1. **Создание события с простой записью**
   - Выбрать "Простая запись"
   - Сохранить
   - Проверить, что CTA не запрашивается
   - Проверить, что на публичной странице кнопка "Записаться"

2. **Создание события со слотами**
   - Выбрать "Запись по времени"
   - Сохранить
   - Проверить, что на публичной странице кнопка "Выбрать время"

3. **Создание события с внешней ссылкой**
   - Выбрать "Покупка билета по ссылке"
   - Сохранить
   - Проверить, что на публичной странице кнопка "Купить билет"

4. **Редактирование существующего события**
   - Открыть событие с заполненным `ctaType`
   - Проверить, что блок CTA не показывается
   - Изменить `participationMode`
   - Сохранить
   - Проверить, что CTA определяется из нового `participationMode`

## Заключение

Удаление блока "Кнопка действия" упрощает UX wizard и устраняет дублирование логики. CTA теперь определяется автоматически на основе `participationMode`, что делает процесс создания события быстрее и предотвращает несоответствия.
