# PlaceWizard Revision Flow Fix

## Проблема

При редактировании опубликованного места PlaceWizard выдавал ошибку:
```
Published places must be edited through revisions. Use /api/business/places/[id]/revision endpoint.
```

### Корневая причина
PlaceWizard всегда использовал обычный PATCH endpoint `/api/business/places/[id]` для сохранения изменений, не проверяя статус места. По архитектуре проекта опубликованные места должны редактироваться только через revision flow.

### Дополнительная проблема
Error handling был слабым - при ошибке в консоли появлялось `[PlaceWizard] Save failed: {}` без полезной информации о причине ошибки.

## Решение

### 1. Добавлена проверка статуса места
Функция `saveDraft` теперь проверяет `place.status === "PUBLISHED"` и выбирает правильный flow:

```typescript
const isPublished = place.status === "PUBLISHED";

if (isPublished) {
  // Use revision flow
} else {
  // Use direct save flow
}
```

### 2. Реализован revision flow для опубликованных мест

**Шаг 1**: Получить или создать revision
```typescript
const getRevisionRes = await fetch(`/api/business/places/${place.id}/revision`, {
  method: "GET",
});
const { revision } = await getRevisionRes.json();
```

**Шаг 2**: Сохранить изменения в revision
```typescript
const res = await fetch(`/api/business/places/${place.id}/revision`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    revisionId: revision.id,
    data: pendingChanges,
  }),
});
```

### 3. Улучшен error handling

**До**:
```typescript
const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
console.error("[PlaceWizard] Save failed:", errorData);
```

**После**:
```typescript
const errorText = await res.text();
let errorData;
try {
  errorData = JSON.parse(errorText);
} catch {
  errorData = { error: errorText || "Failed to save" };
}
console.error("[PlaceWizard] Save failed:", {
  status: res.status,
  statusText: res.statusText,
  error: errorData,
});
```

**Преимущества**:
- Сначала читаем response как text
- Пытаемся распарсить как JSON
- Если не JSON - используем text как error message
- Логируем status code и statusText для debugging
- Всегда получаем полезную информацию об ошибке

## Логика работы

### Для неопубликованных мест (DRAFT, NEEDS_REVISION, REJECTED)
1. Сохранение через обычный endpoint: `PATCH /api/business/places/[id]`
2. Обновление локального state с ответом сервера
3. Toast: "Черновик сохранён"

### Для опубликованных мест (PUBLISHED)
1. GET `/api/business/places/[id]/revision` - получить или создать revision
2. PATCH `/api/business/places/[id]/revision` - сохранить изменения в revision
3. Локальный state НЕ обновляется (показываем опубликованную версию)
4. Toast: "Изменения сохранены в черновик"

## Изменённые файлы

- `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
  - Функция `saveDraft` - добавлена проверка статуса и revision flow
  - Улучшен error handling с детальным логированием

## Тестирование

### Сценарий 1: Редактирование DRAFT места
1. Создать новое место (статус DRAFT)
2. Внести изменения на любом шаге
3. Переключиться на другой шаг
4. ✅ Изменения сохраняются через обычный endpoint
5. ✅ Навигация работает без ошибок

### Сценарий 2: Редактирование PUBLISHED места
1. Открыть опубликованное место
2. Внести изменения на любом шаге
3. Переключиться на другой шаг
4. ✅ Создаётся revision (если не существует)
5. ✅ Изменения сохраняются в revision
6. ✅ Навигация работает без ошибок
7. ✅ Опубликованная версия остаётся видимой

### Сценарий 3: Error handling
1. Симулировать ошибку API (например, отключить сеть)
2. Попытаться сохранить изменения
3. ✅ В консоли появляется детальная информация:
   - HTTP status code
   - Status text
   - Error message из response
4. ✅ Toast показывает понятное сообщение об ошибке

## Архитектурные решения

### Почему GET потом PATCH для revision?
API endpoint `/api/business/places/[id]/revision` работает так:
- GET - получает существующую revision или создаёт новую
- PATCH - обновляет существующую revision

Это позволяет:
- Избежать дублирования revision при множественных сохранениях
- Гарантировать что всегда работаем с одной активной revision
- Упростить клиентскую логику

### Почему не обновляем state для published мест?
Когда место PUBLISHED, пользователь редактирует revision, а не само место. Опубликованная версия должна оставаться видимой до одобрения изменений. Поэтому:
- Для DRAFT - обновляем state (пользователь видит свои изменения сразу)
- Для PUBLISHED - НЕ обновляем state (пользователь видит опубликованную версию)

## Связанные документы

- `docs/ai-reports/place/PLACE_REVISION_ARCHITECTURE.md` - Архитектура revision system
- `docs/ai-reports/place/PLACE_MODERATION_BUTTON_UX.md` - UX улучшения кнопки модерации

## Статус
✅ Завершено - PlaceWizard теперь корректно работает с revision flow для опубликованных мест
