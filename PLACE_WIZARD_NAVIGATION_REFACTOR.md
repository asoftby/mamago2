# Place Wizard Navigation Refactor - Complete

## Status: ✅ COMPLETE

## Summary
Успешно реализована кликабельная навигация по шагам визарда с переносом кнопок "Назад/Далее" в верхний хедер. Добавлена система валидации шагов с блокировкой недоступных шагов.

## Changes Made

### 1. New Components

#### WizardHeaderNew.tsx (CREATED)
**Path**: `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`

**Features**:
- ✅ Кликабельные шаги (4 кнопки: Профиль, Локация, Фото, Контакты)
- ✅ Визуальные состояния шагов:
  - `current` - активный шаг (primary background)
  - `done` - пройденный шаг (green background с галочкой)
  - `available` - доступный шаг (hover эффект)
  - `locked` - заблокированный шаг (disabled, opacity 50%)
- ✅ Навигационные кнопки справа:
  - "Назад" (outline, disabled на шаге 1)
  - "Далее" (primary, disabled если шаг не валиден)
  - "Отправить" на последнем шаге (green background)
- ✅ Progress bar внизу
- ✅ Save status (Сохраняю... / Сохранено)
- ✅ Валидационное сообщение под хедером
- ✅ Responsive (мобильная версия с компактными кнопками)

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Создание места | Черновик          Сохранено только что │
├─────────────────────────────────────────────────────────┤
│ [Профиль] [Локация] [Фото] [Контакты]  [Назад] [Далее] │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  3/4   │
│ Заполните обязательные поля для продолжения             │
└─────────────────────────────────────────────────────────┘
```

#### stepValidation.ts (CREATED)
**Path**: `src/app/business/(protected)/places/[id]/edit/utils/stepValidation.ts`

**Functions**:
- `validateStep1(place)` - Проверка шага 1 (title, category, shortDesc)
- `validateStep2(place)` - Проверка шага 2 (lat, lng)
- `validateStep3(place)` - Проверка шага 3 (logoImageId + logo image exists)
- `validateStep4(place)` - Проверка шага 4 (всегда true, все поля опциональны)
- `getStepStatus(targetStep, currentStep, place)` - Получить статус шага
- `isStepValid(step, place)` - Проверить валидность шага
- `canGoToNextStep(currentStep, place)` - Можно ли перейти вперед
- `canGoToPrevStep(currentStep)` - Можно ли перейти назад
- `canGoToStep(targetStep, currentStep, place)` - Можно ли перейти на конкретный шаг

**Validation Rules**:
```typescript
Step 1: title && category && shortDesc
Step 2: lat !== null && lng !== null
Step 3: logoImageId && logoImage exists
Step 4: always valid (all optional)
```

### 2. Modified Components

#### PlaceWizard.tsx (MODIFIED)
**Path**: `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

**Changes**:
- ✅ Заменен `WizardHeader` на `WizardHeaderNew`
- ✅ Добавлен импорт валидационных функций
- ✅ Добавлен импорт `toast` из `sonner`
- ✅ Добавлена функция `handleStepClick(targetStep)` - клик по шагу
- ✅ Обновлена функция `handleNext()`:
  - На последнем шаге вызывает `handleSubmit()`
  - Проверяет валидность перед переходом
  - Показывает toast ошибку если шаг не валиден
- ✅ Обновлена функция `handlePrev()` - использует `canGoToPrevStep()`
- ✅ Передача новых пропсов в `WizardHeaderNew`:
  - `onStepClick`, `onPrev`, `onNext`
  - `canGoNext`, `canGoPrev`, `isLastStep`
  - `getStepStatus` функция
- ✅ Удалены пропсы `onNext`, `onPrev`, `onSubmit` из шагов

#### Step1Profile.tsx (MODIFIED)
**Path**: `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx`

**Changes**:
- ❌ Удален проп `onNext`
- ❌ Удалена переменная `canProceed`
- ❌ Удалены импорты `Button`, `ChevronRight`
- ❌ Удалена секция "Navigation" с кнопками
- ❌ Удалено сообщение об ошибке валидации

**Result**: Чистый компонент формы без навигации.

#### Step2Location.tsx (MODIFIED)
**Path**: `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`

**Changes**:
- ❌ Удалены пропсы `onNext`, `onPrev`
- ❌ Удалены импорты `Button`, `ChevronLeft`, `ChevronRight`
- ❌ Удалена секция "Navigation" с кнопками

**Result**: Чистый компонент с PlaceLocationPicker.

#### Step3Photos.tsx (MODIFIED)
**Path**: `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`

**Changes**:
- ❌ Удалены пропсы `onNext`, `onPrev`
- ❌ Удалена переменная `canProceed`
- ❌ Удалены импорты `Button`, `ChevronLeft`, `ChevronRight`
- ❌ Удалена секция "Navigation" с кнопками
- ❌ Удалено сообщение "Загрузите логотип для продолжения"

**Result**: Чистый компонент с PlaceLogoUpload.

#### Step4Contacts.tsx (MODIFIED)
**Path**: `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`

**Changes**:
- ❌ Удалены пропсы `onSubmit`, `onPrev`, `isSubmitting`
- ❌ Удалены импорты `ChevronLeft`, `Send`
- ❌ Удалена секция "Navigation" с кнопками
- ✅ Оставлен импорт `Button` для кнопки "Открыть" Instagram

**Result**: Чистый компонент формы контактов.

### 3. Deleted Components

#### WizardHeader.tsx (DEPRECATED)
**Path**: `src/app/business/(protected)/places/[id]/edit/components/WizardHeader.tsx`

**Status**: Оставлен для обратной совместимости, но больше не используется.

**Recommendation**: Можно удалить после проверки что нигде не импортируется.

## Navigation Logic

### Step Status States

```typescript
type StepStatus = "done" | "current" | "available" | "locked";

// done - пройденный шаг (можно вернуться)
// current - текущий шаг
// available - доступный шаг (можно перейти)
// locked - заблокированный шаг (нельзя перейти)
```

### Step Click Behavior

```typescript
handleStepClick(targetStep) {
  const status = getStepStatus(targetStep, currentStep, place);
  
  if (status === "locked") {
    // Show toast error
    toast.error("Заполните обязательные поля на шаге ...");
    return;
  }
  
  // Navigate to step
  setCurrentStep(targetStep);
}
```

### Next Button Behavior

```typescript
handleNext() {
  if (currentStep === 4) {
    // Last step - submit
    handleSubmit();
  } else if (canGoToNextStep(currentStep, place)) {
    // Valid - go next
    setCurrentStep(currentStep + 1);
  } else {
    // Invalid - show error
    toast.error("Заполните обязательные поля для продолжения");
  }
}
```

### Prev Button Behavior

```typescript
handlePrev() {
  if (canGoToPrevStep(currentStep)) {
    setCurrentStep(currentStep - 1);
  }
}
```

## Validation Rules

### Step 1: Profile
**Required**:
- `title` (string, not empty)
- `category` (string, not empty)
- `shortDesc` (string, not empty)

**Optional**:
- `description`
- `ageTags`
- `visitFormats`
- `activityTypes`

### Step 2: Location
**Required**:
- `lat` (number, not null)
- `lng` (number, not null)

**Optional**:
- `formattedAddr`
- `googlePlaceId`
- `customAddress`

### Step 3: Photos
**Required**:
- `logoImageId` (string, not null)
- Logo image must exist in `place.images` with `kind: "LOGO"`

**Optional**:
- Gallery images

### Step 4: Contacts
**All Optional**:
- `phone`
- `website`
- `instagramHandle`

## User Flow

### Scenario 1: New Place (Empty Draft)
1. User starts on Step 1
2. Steps 2, 3, 4 are locked (disabled)
3. User fills required fields (title, category, shortDesc)
4. Step 2 becomes available (clickable)
5. User clicks Step 2 or "Далее"
6. User sets location
7. Step 3 becomes available
8. User clicks Step 3 or "Далее"
9. User uploads logo
10. Step 4 becomes available
11. User clicks Step 4 or "Далее"
12. User fills contacts (optional)
13. User clicks "Отправить" (green button)
14. Place submitted for moderation

### Scenario 2: Editing Existing Place
1. User opens place with all data filled
2. All steps are available (clickable)
3. User can jump to any step directly
4. User can go back/forward freely
5. Changes auto-save via `useAutosave` hook

### Scenario 3: Validation Error
1. User on Step 1, fields not filled
2. User clicks Step 3 (locked)
3. Toast error: "Заполните обязательные поля на шаге Профиль"
4. User stays on Step 1
5. User fills required fields
6. User can now navigate to Step 3

### Scenario 4: Mobile View
1. Step labels show numbers instead of text (1, 2, 3, 4)
2. Button labels shortened ("Назад" → hidden, "Далее" → "→")
3. Horizontal scroll if needed
4. All functionality preserved

## Visual Design

### Step Button States

**Current Step**:
```css
bg-primary text-primary-foreground shadow-sm
```

**Done Step**:
```css
bg-green-50 text-green-700 hover:bg-green-100
+ Check icon
```

**Available Step**:
```css
text-muted-foreground hover:bg-muted
```

**Locked Step**:
```css
text-muted-foreground/50 cursor-not-allowed opacity-50
```

### Navigation Buttons

**Prev Button**:
```tsx
<Button variant="outline" size="sm" disabled={!canGoPrev}>
  <ChevronLeft /> Назад
</Button>
```

**Next Button**:
```tsx
<Button size="sm" disabled={!canGoNext}>
  Далее <ChevronRight />
</Button>
```

**Submit Button** (Step 4):
```tsx
<Button size="sm" className="bg-green-600">
  Отправить <Send />
</Button>
```

## Responsive Design

### Desktop (≥640px)
- Full step labels: "Профиль", "Локация", "Фото", "Контакты"
- Full button labels: "Назад", "Далее", "Отправить"
- All elements visible

### Mobile (<640px)
- Step numbers: 1, 2, 3, 4
- Button icons: ←, →, ✓
- Compact layout
- Horizontal scroll if needed

## Technical Details

### State Management
- Single source of truth: `place` state in PlaceWizard
- Optimistic updates via `setPlace()`
- Auto-save via `useAutosave` hook
- URL sync via `router.replace()`

### URL Routing
```typescript
useEffect(() => {
  const params = new URLSearchParams();
  params.set("step", currentStep.toString());
  router.replace(`?${params.toString()}`, { scroll: false });
}, [currentStep]);
```

### Toast Notifications
```typescript
// Error on locked step click
toast.error("Заполните обязательные поля на шаге ...");

// Error on invalid next
toast.error("Заполните обязательные поля для продолжения");
```

### Auto-save
```typescript
const { updatePlace, isUpdating } = useAutosave(place.id, {
  onSuccess: () => {
    setLastSaved(new Date());
  },
});
```

## Testing Checklist

- [x] Шаги кликабельны
- [x] Locked шаги показывают toast ошибку
- [x] Available шаги переключаются
- [x] Done шаги показывают галочку
- [x] Current шаг выделен
- [x] Кнопка "Назад" работает
- [x] Кнопка "Далее" работает
- [x] Кнопка "Далее" disabled на невалидном шаге
- [x] Кнопка "Отправить" на последнем шаге
- [x] Progress bar обновляется
- [x] Save status показывается
- [x] URL обновляется при смене шага
- [x] Draft сохраняется при переходах
- [x] Валидация работает корректно
- [x] Нижних кнопок нет
- [x] Мобильная версия работает
- [x] Нет TypeScript ошибок
- [x] Нет console ошибок

## Files Summary

### Created (3 files)
1. `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`
2. `src/app/business/(protected)/places/[id]/edit/utils/stepValidation.ts`
3. `PLACE_WIZARD_NAVIGATION_REFACTOR.md`

### Modified (6 files)
1. `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
2. `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx`
3. `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`
4. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
5. `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`

### Deprecated (1 file)
1. `src/app/business/(protected)/places/[id]/edit/components/WizardHeader.tsx`

## Dependencies

### Existing (Reused)
- `@/components/ui/button` - Button component
- `@/lib/utils` - cn() utility
- `sonner` - Toast notifications
- `lucide-react` - Icons
- `next/navigation` - useRouter
- `@prisma/client` - Types

### No New Dependencies
All functionality implemented with existing dependencies.

## Next Steps (Optional)

1. Add keyboard navigation (Arrow keys, Tab)
2. Add step completion animations
3. Add progress percentage tooltip
4. Add "Save draft" explicit button
5. Add "Exit wizard" confirmation dialog
6. Add step validation preview (show which fields are missing)
7. Add step history (undo/redo)
8. Add wizard completion celebration 🎉

## Notes

- Old `WizardHeader.tsx` оставлен для обратной совместимости
- Можно удалить после проверки что нигде не используется
- Все шаги теперь "чистые" компоненты без навигации
- Навигация полностью управляется из PlaceWizard
- Валидация централизована в stepValidation.ts
- Draft-first подход сохранен
- Auto-save работает как раньше
- URL синхронизация работает как раньше
