# Place Locked State Implementation

## Проблема
Когда место находится на модерации (статус PENDING), интерфейс не блокировал редактирование. Пользователь мог вносить изменения, которые не сохранялись, что создавало путаницу.

## Решение

### 1. Единый источник определения locked state

В `PlaceWizard.tsx` добавлены флаги:
```typescript
const isLockedForModeration = place.status === "PENDING";
const isEditable = !isLockedForModeration;
```

### 2. Блокировка сохранения

**saveDraft**:
```typescript
const saveDraft = useCallback(async () => {
  // Don't save if locked for moderation
  if (isLockedForModeration) {
    console.log("[PlaceWizard] Save blocked - place is on moderation");
    return true;
  }
  // ... rest of save logic
}, [isDirty, pendingChanges, place.id, place.status, isLockedForModeration]);
```

**handleUpdate**:
```typescript
const handleUpdate = (updates: Partial<Place> & { images?: PlaceImage[] }) => {
  // Block updates if locked for moderation
  if (isLockedForModeration) {
    console.log("[PlaceWizard] Update blocked - place is on moderation");
    return;
  }
  // ... rest of update logic
};
```

### 3. Баннер для locked state

```typescript
{isLockedForModeration && (
  <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
    <div className="flex items-start">
      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
      <div>
        <h3 className="text-sm font-semibold text-blue-800 mb-1">
          ⏳ Публикация находится на проверке модератора
        </h3>
        <p className="text-sm text-blue-700">
          Редактирование временно недоступно. После проверки вы получите уведомление.
        </p>
      </div>
    </div>
  </div>
)}
```

### 4. Передача isEditable в шаги

Все шаги теперь получают `isEditable` prop:
```typescript
<Step1Profile isEditable={isEditable} />
<Step2Location isEditable={isEditable} />
<Step3Photos isEditable={isEditable} />
<Step4Contacts isEditable={isEditable} />
```

### 5. Disabled inputs в Step4Contacts

```typescript
<Input
  disabled={!isEditable}
  // ... other props
/>
```

## Что работает

✅ PlaceWizard определяет locked state через `place.status === "PENDING"`
✅ saveDraft не выполняется если locked
✅ handleUpdate не применяет изменения если locked
✅ Баннер показывает понятное сообщение
✅ Step4Contacts получает isEditable и блокирует inputs
✅ Кнопка "На модерации" disabled (из предыдущей задачи)

## Что нужно доделать

Добавить `isEditable` prop и disabled состояние в:
- Step1Profile - все Input, Textarea, select, кнопки тегов
- Step2Location - PlaceLocationPicker, address inputs
- Step3Photos - PlaceGalleryUploadTemp, upload кнопки

## Файлы изменены

- `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
  - Добавлены isLockedForModeration и isEditable
  - Обновлены saveDraft и handleUpdate
  - Добавлен баннер для PENDING
  - Передача isEditable во все шаги

- `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
  - Добавлен isEditable prop
  - Все Input получили disabled={!isEditable}

## Архитектура

### Определение locked state
```
place.status === "PENDING" → isLockedForModeration = true → isEditable = false
```

### Блокировка на уровне PlaceWizard
- saveDraft - ранний return
- handleUpdate - ранний return
- Изменения не попадают в pendingChanges
- Не вызываются API endpoints

### Блокировка на уровне UI
- Inputs получают disabled={!isEditable}
- Кнопки получают disabled={!isEditable}
- Upload компоненты должны проверять isEditable

## Статус
🟡 В процессе - PlaceWizard готов, нужно доделать Step1, Step2, Step3
