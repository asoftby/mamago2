# Place Step 2 - Radio Scenarios UX Improvement

## Обзор
Минимальный рефакторинг PlaceLocationPicker: замена checkbox на RadioGroup с тремя сценариями местоположения.

## Изменения

### 1. Добавлен RadioGroup компонент
**Файл:** `src/components/ui/radio-group.tsx`
- Создан shadcn RadioGroup на базе @radix-ui/react-radio-group
- Установлен пакет: `@radix-ui/react-radio-group@1.3.8`

### 2. PlaceLocationPicker - Минимальный рефакторинг
**Файл:** `src/components/business/place/PlaceLocationPicker.tsx`

#### Удалено:
- ❌ Checkbox "Уточнить местоположение вручную"
- ❌ Checkbox "Внутри ТЦ / комплекса"
- ❌ State: `manualPointMode`, `isInsideComplex`, `unitLabel`

#### Добавлено:
- ✅ State: `locationScenario: "ADDRESS" | "UNIT" | "MAP"`
- ✅ RadioGroup с заголовком "Где находится ваше место?"

### 3. Три сценария

#### Сценарий 1: ADDRESS - "Отдельный вход по адресу"
**Показывает:**
- Textarea "Как найти (необязательно)" → `customAddress`

**Сохраняет:**
- `placeKind = "STANDALONE"`
- `customAddress`

#### Сценарий 2: UNIT - "Внутри здания или ТЦ"
**Показывает:**
- Input "Этаж" → `floor`
- Input "Павильон / офис" → `unit`
- Textarea "Как найти" → `customAddress`
- Select "Базовый объект (ТЦ/комплекс)" → `parentPlaceId` (если есть matches)

**Сохраняет:**
- `placeKind = "UNIT"`
- `floor`, `unit`, `customAddress`, `parentPlaceId`

#### Сценарий 3: MAP - "Указать точку на карте"
**Показывает:**
- Инструкция: "Кликните на карте..."
- Координаты (lat/lng) если выбрана точка
- Кнопка "Сохранить точку"

**Поведение:**
- Карта становится clickable
- Клик → сохраняет lat/lng
- Кнопка → вызывает `handleSaveManualPoint()`

## UI Changes

### До:
```
☑ Уточнить местоположение вручную
  [Координаты, кнопка сохранить]

☐ Внутри ТЦ / комплекса

[Поля: этаж, павильон, unitLabel, как найти, select]
[Кнопка: Сохранить уточнения]
```

### После:
```
Где находится ваше место?

○ Отдельный вход по адресу
○ Внутри здания или ТЦ
○ Указать точку на карте

[Динамические поля в зависимости от выбора]
[Кнопка: Сохранить]
```

## Логика сохранения

### ADDRESS:
```typescript
PATCH /api/business/places/[id]
{
  placeKind: "STANDALONE",
  customAddress: "...",
  floor: null,
  unit: null,
  parentPlaceId: null
}
```

### UNIT:
```typescript
PATCH /api/business/places/[id]
{
  placeKind: "UNIT",
  floor: "2",
  unit: "A12",
  customAddress: "...",
  parentPlaceId: "..."
}
```

### MAP:
```typescript
POST /api/business/places/[id]/location/manual
{
  lat: 53.900600,
  lng: 27.559000,
  customAddress: "..."
}
```

## Технические детали

### State Management
- Один state `locationScenario` вместо двух boolean
- Условный рендеринг полей по `locationScenario`
- Сохранение через существующие handlers

### Архитектура
- ✅ Минимальные изменения
- ✅ Сохранена текущая структура
- ✅ Используются существующие API endpoints
- ✅ Не переписан весь компонент

### Удалённые поля
- `unitLabel` - убрано из UI и сохранения
- Поле было избыточным, достаточно `floor` + `unit` + `customAddress`

## UX Improvements

### Понятнее:
- Радио вместо checkbox - один выбор из трёх
- Заголовок "Где находится ваше место?" - понятный вопрос
- Сценарии описаны простым языком

### Проще:
- Меньше полей одновременно на экране
- Динамическое отображение только нужных полей
- Одна кнопка "Сохранить" для ADDRESS и UNIT

### Логичнее:
- MAP сценарий отдельно (не checkbox внутри другого flow)
- UNIT сценарий показывает только релевантные поля
- ADDRESS сценарий минималистичен

## Testing Checklist

- [ ] RadioGroup переключается между сценариями
- [ ] ADDRESS: показывает только customAddress (необязательно)
- [ ] UNIT: показывает этаж, павильон, как найти, select
- [ ] MAP: карта clickable, показывает координаты
- [ ] Сохранение ADDRESS: placeKind = STANDALONE
- [ ] Сохранение UNIT: placeKind = UNIT + все поля
- [ ] Сохранение MAP: вызывает location/manual endpoint
- [ ] Select родительского комплекса работает (только для UNIT)

## Файлы

### Созданные:
1. `src/components/ui/radio-group.tsx`

### Изменённые:
1. `src/components/business/place/PlaceLocationPicker.tsx`

### Установленные пакеты:
1. `@radix-ui/react-radio-group@1.3.8`

---

**Статус:** ✅ Реализовано
**Подход:** Минимальный рефакторинг
**Дата:** 2026-03-05
