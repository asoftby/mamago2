# Place Moderation Button UX Improvements

## Проблема
Когда публикация находилась на модерации, интерфейс показывал только информационные баннеры без явного визуального индикатора состояния кнопки. Пользователь не видел, что публикация уже отправлена.

Также были дублирующие баннеры в PlaceWizard и Step4Contacts.

## Решение
Кнопка "Отправить на модерацию" теперь остаётся видимой, но меняет своё состояние когда публикация находится на проверке:

### Состояния кнопки

#### 1. Готова к отправке (DRAFT, NEEDS_REVISION, REJECTED)
```
Текст: "Отправить на модерацию"
Стиль: primary (зелёная для последнего шага)
Иконка: Send (отправить)
Состояние: enabled
```

#### 2. На модерации (PENDING)
```
Текст: "⏳ На модерации"
Стиль: secondary (серая)
Иконка: Clock (часы)
Состояние: disabled
```

## Изменения в коде

### 1. Step4Contacts.tsx
**Обновлена логика кнопки**:

```typescript
// Определяем, находится ли на модерации
const isPending = isRevisionMode
  ? revisionStatus === "PENDING"
  : place.status === ContentStatus.PENDING;

// Текст и состояние кнопки
const submitButtonText = isPending
  ? "На модерации"
  : "Отправить на модерацию";

const submitButtonDisabled = isPending || isSaving;
```

**Ключевые изменения**:
- Кнопка теперь ВСЕГДА показывается (убрано условие `canShowSubmitButton`)
- Передаём `onNext={onSubmit}` напрямую, без условия
- Состояние кнопки контролируется через `canNext={!submitButtonDisabled}`
- Кнопка disabled только когда `isPending` или `isSaving`

**Удалён дублирующий баннер**:
- Убран информационный блок из Step4Contacts
- Баннеры теперь показываются только в PlaceWizard

### 2. WizardStepHeader.tsx
**Добавлена поддержка состояния PENDING**:

```typescript
interface WizardStepHeaderProps {
  // ... существующие props
  isPending?: boolean; // Новый prop
}
```

**Обновлён рендер кнопки**:
```typescript
<Button
  onClick={onNext}
  disabled={!canNext || isSaving}
  size="default"
  variant={isPending ? "secondary" : "default"}
  className={cn(
    isLastStep && !isPending && "bg-green-600 hover:bg-green-700",
    isPending && "cursor-not-allowed"
  )}
>
  {isPending && <Clock className="h-4 w-4 mr-1" />}
  {nextLabel}
  {isLastStep && !isPending && <Send className="h-4 w-4 ml-1" />}
  {!isLastStep && !isPending && <ChevronRight className="h-4 w-4 ml-1" />}
</Button>
```

**Изменения**:
- Добавлена иконка Clock для состояния PENDING
- Variant меняется на "secondary" когда isPending
- Иконка Send показывается только когда НЕ pending

### 3. PlaceWizard.tsx
**Обновлены баннеры модерации**:

#### Для revision PENDING:
```typescript
{revision.status === "PENDING" && (
  <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
    <div className="flex items-start">
      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
      <div>
        <h3 className="text-sm font-semibold text-blue-800 mb-1">
          ⏳ Изменения находятся на проверке модератора
        </h3>
        <p className="text-sm text-blue-700">
          Редактирование временно недоступно. После проверки вы получите уведомление.
        </p>
      </div>
    </div>
  </div>
)}
```

#### Для place PENDING (новый баннер):
```typescript
{!isRevisionMode && place.status === "PENDING" && (
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

**Изменения**:
- Цвет баннера изменён с amber на blue (более нейтральный)
- Добавлена эмодзи ⏳ в заголовок
- Текст стал более информативным
- Добавлен баннер для обычного PENDING статуса (не только для revision)

## UX Flow

### Сценарий 1: Отправка новой публикации
1. Пользователь заполняет форму (статус DRAFT)
2. На шаге 4 видит кнопку: **[Отправить на модерацию]** (зелёная, enabled)
3. Нажимает кнопку
4. Статус меняется на PENDING
5. Страница обновляется:
   - Баннер: "⏳ Публикация находится на проверке модератора"
   - Кнопка: **[⏳ На модерации]** (серая, disabled)

### Сценарий 2: Отправка изменений опубликованного места
1. Пользователь редактирует опубликованное место
2. Создаётся revision со статусом DRAFT
3. На шаге 4 видит кнопку: **[Отправить на модерацию]** (зелёная, enabled)
4. Нажимает кнопку
5. Revision статус меняется на PENDING
6. Страница обновляется:
   - Баннер: "⏳ Изменения находятся на проверке модератора"
   - Кнопка: **[⏳ На модерации]** (серая, disabled)

### Сценарий 3: Требуются правки
1. Модератор запрашивает изменения (NEEDS_REVISION)
2. Пользователь видит:
   - Жёлтый баннер с комментарием модератора
   - Кнопка: **[Отправить на модерацию]** (зелёная, enabled)
3. Может редактировать и отправить повторно

## Визуальные состояния

| Статус | Баннер | Кнопка | Цвет кнопки | Иконка | Enabled |
|--------|--------|--------|-------------|--------|---------|
| DRAFT | Нет | "Отправить на модерацию" | Зелёный | Send | ✅ |
| PENDING | Синий | "На модерации" | Серый | Clock | ❌ |
| NEEDS_REVISION | Жёлтый | "Отправить на модерацию" | Зелёный | Send | ✅ |
| REJECTED | Красный | "Отправить на модерацию" | Зелёный | Send | ✅ |
| PUBLISHED (revision DRAFT) | Синий | "Отправить на модерацию" | Зелёный | Send | ✅ |
| PUBLISHED (revision PENDING) | Синий | "На модерации" | Серый | Clock | ❌ |

## Преимущества нового UX

1. **Визуальная ясность**: Кнопка явно показывает состояние модерации
2. **Консистентность**: Кнопка всегда на месте, меняется только её состояние
3. **Информативность**: Иконка часов ⏳ усиливает понимание ожидания
4. **Нет дублирования**: Один баннер вместо двух одинаковых
5. **Предсказуемость**: Пользователь видит, что действие выполнено

## Файлы изменены
- `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
- `src/app/business/(protected)/places/[id]/edit/components/WizardStepHeader.tsx`
- `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

## Связанная документация
- `docs/ai-reports/place/PLACE_MODERATION_UX_COMPLETE.md` - Предыдущие улучшения UX
- `docs/ai-reports/place/PLACE_REVISION_ARCHITECTURE.md` - Архитектура системы ревизий

## Статус
✅ Завершено - Кнопка модерации теперь показывает активное состояние
