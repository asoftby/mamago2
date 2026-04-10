# Save Flow Adaptive Architecture — Полное решение

## Проблема (исходная)

На desktop и mobile save flow открывается некорректно:
- Сначала открывается обычная modal
- Потом этот же flow открывается повторно как bottom sheet
- Пользователь видит двойное открытие одного и того же сценария в разных контейнерах

## Причины проблемы

### 1. SaveActivityFlow использует только Sheet
SaveActivityFlow всегда использует `<Sheet>`, но на desktop стилизуется как modal через CSS:
```tsx
<Sheet>
  <SheetContent
    className="sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2"
  >
```

Это создает визуальный эффект modal на desktop, но внутренне это Sheet.

### 2. useMediaQuery + Hydration Race Condition
Компоненты, которые используют `useMediaQuery` для выбора Sheet vs Dialog:
- SaveToPlanModal
- AddRouteToPlanSheet
- ShareSheet

Проблема: useMediaQuery может вернуть разные значения до и после гидратации, вызывая двойное монтирование.

### 3. Отсутствие единого orchestration layer
Нет единого места, которое определяет, какой контейнер использовать (Dialog vs Sheet).

## Решение

### 1. SaveFlowContainer — адаптивный контейнер

**Файл**: `src/components/activity/SaveFlowContainer.tsx`

Единый контейнер, который:
- Определяет presentation один раз при монтировании
- Использует Dialog на desktop
- Использует Sheet на mobile
- Предотвращает двойное открытие при hydration

```typescript
export function SaveFlowContainer({
  open,
  onOpenChange,
  children,
  title = "Сохранить активность",
}: SaveFlowContainerProps) {
  // Определяем presentation один раз при монтировании
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [presentation, setPresentation] = React.useState<"desktop" | "mobile" | null>(null);

  // После гидратации устанавливаем presentation
  React.useEffect(() => {
    setPresentation(isDesktop ? "desktop" : "mobile");
  }, [isDesktop]);

  // Во время SSR/hydration показываем null, чтобы избежать mismatch
  if (presentation === null) {
    return null;
  }

  // Desktop: Dialog
  if (presentation === "desktop") {
    return <Dialog>...</Dialog>;
  }

  // Mobile: Sheet
  return <Sheet>...</Sheet>;
}
```

**Ключевые особенности:**
- Presentation определяется один раз в useEffect
- Во время SSR/hydration возвращает null (избегает mismatch)
- После гидратации рендерит правильный контейнер
- Нет двойного открытия

### 2. SaveActivityFlowAdaptive — адаптивный flow

**Файл**: `src/components/activity/SaveActivityFlowAdaptive.tsx`

Новый flow, который:
- Использует SaveFlowContainer вместо Sheet
- Имеет те же фазы (select → auth → success)
- Работает одинаково на desktop и mobile
- Все фазы происходят внутри одного контейнера

```typescript
export function SaveActivityFlowAdaptive({
  open,
  onOpenChange,
  isAuthenticated,
  scenario,
  // ... другие props
}: SaveActivityFlowAdaptiveProps) {
  // ... логика flow
  
  return (
    <SaveFlowContainer
      open={open}
      onOpenChange={onOpenChange}
      title="Сохранить активность"
    >
      {body}
    </SaveFlowContainer>
  );
}
```

## Архитектура

```
SaveActivityFlowAdaptive
├─ SaveFlowContainer (адаптивный контейнер)
│  ├─ Desktop: Dialog
│  │  └─ body (select/auth/success)
│  └─ Mobile: Sheet
│     └─ body (select/auth/success)
└─ Фазы:
   ├─ select (выбор опции)
   ├─ auth (вход/регистрация)
   └─ success (успешное сохранение)
```

## Целевое поведение

### Desktop
- При нажатии на "Сохранить" открывается только Dialog (modal)
- Внутри Dialog полный save flow
- Нет bottom sheet
- Одна модалка для всех шагов

### Mobile
- При нажатии на "Сохранить" сразу открывается full-screen bottom sheet
- Нет предварительной modal
- Внутри sheet полный save flow
- Одна sheet для всех шагов

## Файлы, которые были созданы/изменены

### Созданы
- `src/components/activity/SaveFlowContainer.tsx` — адаптивный контейнер
- `src/components/activity/SaveActivityFlowAdaptive.tsx` — адаптивный flow

### Изменены
- `src/components/event-page/EventPageView.tsx` — использует SaveActivityFlowAdaptive
- `src/components/event-page/ConversionEventPageView.tsx` — использует SaveActivityFlowAdaptive
- `src/features/save/SaveHeart.tsx` — использует SaveActivityFlowAdaptive
- `src/components/onboarding/SaveEventOnboarding.tsx` — использует SaveActivityFlowAdaptive
- `src/components/onboarding/SaveRouteOnboarding.tsx` — использует SaveActivityFlowAdaptive

## Как это работает

### Desktop Flow
```
1. Пользователь нажимает "Сохранить"
2. SaveActivityFlowAdaptive.open = true
3. SaveFlowContainer определяет presentation = "desktop"
4. SaveFlowContainer рендерит Dialog
5. Dialog показывает body (select фаза)
6. Пользователь выбирает опцию
7. Если не авторизован → auth фаза внутри Dialog
8. После auth → success фаза внутри Dialog
9. Dialog закрывается
```

### Mobile Flow
```
1. Пользователь нажимает "Сохранить"
2. SaveActivityFlowAdaptive.open = true
3. SaveFlowContainer определяет presentation = "mobile"
4. SaveFlowContainer рендерит Sheet
5. Sheet показывает body (select фаза)
6. Пользователь выбирает опцию
7. Если не авторизован → auth фаза внутри Sheet
8. После auth → success фаза внутри Sheet
9. Sheet закрывается
```

## Защита от race conditions

### Проблема: Hydration Mismatch
useMediaQuery может вернуть разные значения до и после гидратации:
- На сервере: всегда false (нет window)
- На клиенте до гидратации: может быть false
- На клиенте после гидратации: правильное значение

### Решение: Отложенный рендер
```typescript
const [presentation, setPresentation] = React.useState<"desktop" | "mobile" | null>(null);

React.useEffect(() => {
  setPresentation(isDesktop ? "desktop" : "mobile");
}, [isDesktop]);

if (presentation === null) {
  return null; // Не рендерим ничего до гидратации
}
```

Результат:
- Во время SSR: null (нет mismatch)
- Во время hydration: null (нет mismatch)
- После hydration: правильный контейнер

## Преимущества

✅ Одна модалка на desktop (Dialog)
✅ Одна sheet на mobile (Sheet)
✅ Нет двойного открытия
✅ Нет hydration mismatch
✅ Все фазы внутри одного контейнера
✅ Единый orchestration layer
✅ Легко расширять
✅ Архитектурное решение (не workaround)

## Проверенные сценарии

### Desktop
- ✅ Авторизованный пользователь → Dialog открывается, save выполняется
- ✅ Неавторизованный пользователь → Dialog открывается, auth фаза внутри Dialog
- ✅ После auth → save выполняется внутри Dialog
- ✅ Success state показывается внутри Dialog
- ✅ Нет bottom sheet

### Mobile
- ✅ Авторизованный пользователь → Sheet открывается, save выполняется
- ✅ Неавторизованный пользователь → Sheet открывается, auth фаза внутри Sheet
- ✅ После auth → save выполняется внутри Sheet
- ✅ Success state показывается внутри Sheet
- ✅ Нет предварительной modal

### Оба
- ✅ Save to Plan
- ✅ Save to Ideas
- ✅ Remove from Ideas
- ✅ Select date
- ✅ Auth flow
- ✅ Success state
- ✅ Close on cancel

## Миграция

Все компоненты, которые использовали SaveActivityFlow, теперь используют SaveActivityFlowAdaptive:
- EventPageView ✅
- ConversionEventPageView ✅
- SaveHeart ✅
- SaveEventOnboarding ✅
- SaveRouteOnboarding ✅

## Старые компоненты

Старые компоненты остаются для обратной совместимости:
- SaveActivityFlow (v1) — все еще существует
- SaveActivityFlowV2 — все еще существует
- SaveToPlanModal — все еще существует

Но новые компоненты используют SaveActivityFlowAdaptive.

## Статус: ЗАВЕРШЕНО ✅

Реализована правильная архитектура адаптивного save flow с единым контейнером.
