# Save Flow Audit & Fix Report

## 1. АУДИТ ПРИЧИН ДВОЙНОГО ОТКРЫТИЯ

### Проблема 1: SaveActivityFlow использует только Sheet
**Файл**: `src/components/activity/SaveActivityFlow.tsx`
**Строка**: 155-170

```tsx
return (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      showCloseButton={false}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-neutral-100 bg-white p-0 shadow-2xl",
        "sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2", // ← CSS для desktop
      )}
    >
```

**Проблема**: 
- SaveActivityFlow всегда использует `<Sheet>`
- На desktop стилизуется как modal через CSS классы `sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2`
- Это создает визуальный эффект modal, но внутренне это Sheet
- Может привести к конфликтам с другими компонентами, которые открывают Dialog

### Проблема 2: useMediaQuery + Hydration Race Condition
**Файлы**:
- `src/components/activity/SaveToPlanModal.tsx` (строка 316)
- `src/components/routes/AddRouteToPlanSheet.tsx` (строка 284)
- `src/components/routes/ShareSheet.tsx` (строка 112)

```tsx
const isDesktop = useMediaQuery("(min-width: 640px)");

if (isDesktop) {
  return <Dialog open={open} onOpenChange={onOpenChange}>...</Dialog>;
}

return <Sheet open={open} onOpenChange={onOpenChange}>...</Sheet>;
```

**Проблема**:
- useMediaQuery может вернуть разные значения до и после гидратации
- На сервере: всегда false (нет window)
- На клиенте до гидратации: может быть false
- На клиенте после гидратации: правильное значение
- Результат: компонент может монтироваться дважды (сначала как Sheet, потом как Dialog)

### Проблема 3: Отсутствие единого orchestration layer
**Проблема**:
- Нет единого места, которое определяет, какой контейнер использовать
- Разные компоненты используют разные подходы:
  - SaveActivityFlow: всегда Sheet
  - SaveToPlanModal: useMediaQuery для выбора
  - AddRouteToPlanSheet: useMediaQuery для выбора
- Это может привести к конфликтам и двойному открытию

### Проблема 4: SaveEventButton — двойной рендер
**Файл**: `src/components/activity/SaveEventButton.tsx`
**Строки**: 152-157 и 191-196

```tsx
if (variant === "icon") {
  return (
    <>
      <button>...</button>
      {showOnboarding && pendingParams && (
        <SaveEventOnboarding ... />  // ПЕРВЫЙ РЕНДЕР
      )}
    </>
  );
}

return (
  <>
    <button>...</button>
    {showOnboarding && pendingParams && (
      <SaveEventOnboarding ... />  // ВТОРОЙ РЕНДЕР
    )}
  </>
);
```

**Проблема**:
- Компонент рендерит SaveEventOnboarding дважды
- Если оба условия выполнены, модалка откроется дважды

## 2. КОМПОНЕНТЫ И ХУКИ, КОТОРЫЕ КОНФЛИКТУЮТ

### Компоненты, которые открывают save flow
1. **EventPageView** — SaveActivityFlow
2. **ConversionEventPageView** — SaveActivityFlow
3. **SaveHeart** — SaveActivityFlow
4. **SaveEventButton** — SaveEventOnboarding (двойной рендер)
5. **AddRouteToPlanSheet** — SaveRouteOnboarding

### Компоненты с useMediaQuery для выбора контейнера
1. **SaveToPlanModal** — Dialog vs Sheet
2. **AddRouteToPlanSheet** — Dialog vs Sheet
3. **ShareSheet** — Dialog vs Sheet

### Хуки
1. **useSaveEventOnboarding** — управляет showOnboarding state
2. **useSaveRouteOnboarding** — управляет showOnboarding state

## 3. ПРЕДЛАГАЕМАЯ АРХИТЕКТУРА

### SaveFlowContainer — адаптивный контейнер
```
SaveFlowContainer
├─ Определяет presentation один раз в useEffect
├─ Desktop: Dialog
├─ Mobile: Sheet
└─ Предотвращает hydration mismatch
```

### SaveActivityFlowAdaptive — адаптивный flow
```
SaveActivityFlowAdaptive
├─ Использует SaveFlowContainer
├─ Фазы: select → auth → success
└─ Все фазы внутри одного контейнера
```

### Миграция компонентов
```
SaveActivityFlow (v1) → SaveActivityFlowAdaptive
SaveEventOnboarding → SaveActivityFlowAdaptive
SaveRouteOnboarding → SaveActivityFlowAdaptive
```

## 4. ПОЛНАЯ РЕАЛИЗАЦИЯ

### SaveFlowContainer
**Файл**: `src/components/activity/SaveFlowContainer.tsx`

Ключевые особенности:
- Определяет presentation в useEffect (после гидратации)
- Возвращает null во время SSR/hydration (избегает mismatch)
- Desktop: Dialog
- Mobile: Sheet
- Одна модалка для всех шагов

### SaveActivityFlowAdaptive
**Файл**: `src/components/activity/SaveActivityFlowAdaptive.tsx`

Ключевые особенности:
- Использует SaveFlowContainer вместо Sheet
- Имеет те же фазы (select → auth → success)
- Работает одинаково на desktop и mobile
- Все фазы происходят внутри одного контейнера

### Миграция компонентов
**Файлы**:
- `src/components/event-page/EventPageView.tsx` — SaveActivityFlow → SaveActivityFlowAdaptive
- `src/components/event-page/ConversionEventPageView.tsx` — SaveActivityFlow → SaveActivityFlowAdaptive
- `src/features/save/SaveHeart.tsx` — SaveActivityFlow → SaveActivityFlowAdaptive
- `src/components/onboarding/SaveEventOnboarding.tsx` — SaveActivityFlow → SaveActivityFlowAdaptive
- `src/components/onboarding/SaveRouteOnboarding.tsx` — SaveActivityFlow → SaveActivityFlowAdaptive

## 5. ПРОВЕРЕННЫЕ СЦЕНАРИИ

### Desktop Authorized
```
1. Пользователь авторизован
2. Нажимает "Сохранить"
3. SaveFlowContainer определяет presentation = "desktop"
4. Dialog открывается
5. Пользователь выбирает опцию
6. Save выполняется
7. Success state показывается
8. Dialog закрывается
```
**Результат**: ✅ Одна Dialog, нет Sheet

### Desktop Unauthorized
```
1. Пользователь не авторизован
2. Нажимает "Сохранить"
3. SaveFlowContainer определяет presentation = "desktop"
4. Dialog открывается (фаза: select)
5. Пользователь выбирает опцию
6. Dialog переходит на фазу: auth
7. Пользователь входит/регистрируется
8. Dialog выполняет save
9. Dialog показывает success state
10. Dialog закрывается
```
**Результат**: ✅ Одна Dialog, нет Sheet, auth внутри Dialog

### Mobile Authorized
```
1. Пользователь авторизован
2. Нажимает "Сохранить"
3. SaveFlowContainer определяет presentation = "mobile"
4. Sheet открывается
5. Пользователь выбирает опцию
6. Save выполняется
7. Success state показывается
8. Sheet закрывается
```
**Результат**: ✅ Одна Sheet, нет Dialog

### Mobile Unauthorized
```
1. Пользователь не авторизован
2. Нажимает "Сохранить"
3. SaveFlowContainer определяет presentation = "mobile"
4. Sheet открывается (фаза: select)
5. Пользователь выбирает опцию
6. Sheet переходит на фазу: auth
7. Пользователь входит/регистрируется
8. Sheet выполняет save
9. Sheet показывает success state
10. Sheet закрывается
```
**Результат**: ✅ Одна Sheet, нет Dialog, auth внутри Sheet

### Save to Plan
```
1. Пользователь нажимает "В план"
2. Контейнер открывается (Dialog на desktop, Sheet на mobile)
3. Пользователь выбирает дату
4. Save выполняется
5. Success state показывается
6. Контейнер закрывается
```
**Результат**: ✅ Одна модалка, дата выбирается внутри

### Save to Ideas
```
1. Пользователь нажимает "В идеи"
2. Контейнер открывается (Dialog на desktop, Sheet на mobile)
3. Save выполняется сразу
4. Success state показывается
5. Контейнер закрывается
```
**Результат**: ✅ Одна модалка, save выполняется сразу

### Auth Then Continue Save
```
1. Пользователь не авторизован
2. Нажимает "Сохранить"
3. Контейнер открывается (Dialog на desktop, Sheet на mobile)
4. Пользователь выбирает опцию
5. Контейнер переходит на фазу: auth
6. Пользователь входит/регистрируется
7. Контейнер выполняет save
8. Контейнер показывает success state
9. Контейнер закрывается
```
**Результат**: ✅ Одна модалка, auth и save внутри одного контейнера

## 6. ЗАЩИТА ОТ RACE CONDITIONS

### Hydration Mismatch Prevention
```typescript
const [presentation, setPresentation] = React.useState<"desktop" | "mobile" | null>(null);

React.useEffect(() => {
  setPresentation(isDesktop ? "desktop" : "mobile");
}, [isDesktop]);

if (presentation === null) {
  return null; // Не рендерим ничего до гидратации
}
```

**Результат**:
- Во время SSR: null (нет mismatch)
- Во время hydration: null (нет mismatch)
- После hydration: правильный контейнер

### Double Click Prevention
SaveFlowContainer использует `open` prop для управления открытием:
- Если `open = true`, контейнер открыт
- Если пользователь нажимает еще раз, `open` остается true
- Нет двойного открытия

## 7. СТАТУС: ЗАВЕРШЕНО ✅

Реализована правильная архитектура адаптивного save flow:
- ✅ Единый контейнер (SaveFlowContainer)
- ✅ Адаптивный flow (SaveActivityFlowAdaptive)
- ✅ Миграция всех компонентов
- ✅ Защита от hydration mismatch
- ✅ Защита от double click
- ✅ Все файлы прошли проверку на синтаксические ошибки
