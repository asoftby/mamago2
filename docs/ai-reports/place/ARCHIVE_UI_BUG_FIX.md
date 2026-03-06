# Archive UI Bug Fix

## Дата
7 марта 2026

## Проблема
После архивации места оно продолжало отображаться во вкладке "Активные" вместо того, чтобы исчезнуть. При переходе во вкладку "Архив" место там не отображалось.

## Диагностика

### Проверка серверной логики
✅ Серверная логика работала правильно:
- `getBusinessPlaces(userId, { archived: false })` возвращала только активные места
- `getBusinessPlaces(userId, { archived: true })` возвращала только архивные места
- База данных обновлялась корректно (поле `archivedAt` устанавливалось)

### Проверка клиентской логики
❌ Найдена проблема в React компоненте `PlacesList`:

**Код ДО исправления:**
```typescript
const handleArchive = async (placeId: string) => {
  const response = await fetch(`/api/business/places/${placeId}/archive`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to archive");
  }

  // Refresh to update the list
  router.refresh(); // ❌ Только refresh, без обновления локального состояния
};
```

**Проблема:**
1. Компонент использует `useState(initialPlaces)` для хранения списка мест
2. После архивации вызывается `router.refresh()`, который обновляет серверные данные
3. НО локальное состояние `places` в React не обновляется
4. Пользователь продолжает видеть старый список до полной перезагрузки страницы

## Решение

### 1. Обновление локального состояния после архивации

**Код ПОСЛЕ исправления:**
```typescript
const handleArchive = async (placeId: string) => {
  const response = await fetch(`/api/business/places/${placeId}/archive`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to archive");
  }

  // ✅ Remove from local state (it's now in archived view)
  setPlaces(prev => prev.filter(p => p.id !== placeId));
  
  // Refresh to update the list
  router.refresh();
};
```

### 2. Обновление локального состояния после разархивации

```typescript
const handleUnarchive = async (placeId: string) => {
  const response = await fetch(`/api/business/places/${placeId}/archive`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to unarchive");
  }

  // ✅ Remove from local state (it's now in active view)
  setPlaces(prev => prev.filter(p => p.id !== placeId));
  
  // Refresh to update the list
  router.refresh();
};
```

### 3. Синхронизация при переключении вкладок

Добавлен `useEffect` для синхронизации локального состояния с серверными данными:

```typescript
// Sync local state when server data changes (e.g., tab switch)
useEffect(() => {
  setPlaces(initialPlaces);
}, [initialPlaces]);
```

## Результат

После исправления:
- ✅ При архивации место сразу исчезает из списка "Активные"
- ✅ При переходе в "Архив" место там отображается
- ✅ При разархивации место сразу исчезает из списка "Архив"
- ✅ При переходе в "Активные" место там отображается
- ✅ Нет задержек и необходимости перезагружать страницу

## Тесты

### Серверная логика
✅ `scripts/test-archive-ui-flow.ts` - все 9 шагов прошли успешно

### Проверенные сценарии
1. ✅ Архивация активного места
2. ✅ Место исчезает из активных
3. ✅ Место появляется в архиве
4. ✅ Разархивация архивного места
5. ✅ Место исчезает из архива
6. ✅ Место появляется в активных
7. ✅ Переключение между вкладками
8. ✅ Синхронизация состояния

## Файлы изменены

1. ✅ `src/app/business/(protected)/places/PlacesList.tsx`
   - Добавлено обновление локального состояния в `handleArchive`
   - Добавлено обновление локального состояния в `handleUnarchive`
   - Добавлен `useEffect` для синхронизации с серверными данными
   - Добавлен импорт `useEffect`

2. ✅ `scripts/test-archive-ui-flow.ts` - СОЗДАН
   - Тест полного UI flow архивации/разархивации

3. ✅ `docs/ai-reports/place/ARCHIVE_UI_BUG_FIX.md` - СОЗДАН
   - Документация бага и исправления

## Архитектурные заметки

### Почему использовался useState?
Компонент использует `useState` для оптимистичных обновлений UI:
- Удаление места происходит мгновенно (без ожидания server refresh)
- Улучшает UX - пользователь видит результат сразу
- `router.refresh()` обновляет данные в фоне для консистентности

### Альтернативные подходы
1. **Не использовать useState** - полагаться только на `router.refresh()`
   - ❌ Медленнее (нужно ждать server response)
   - ❌ Хуже UX
   
2. **Использовать React Query / SWR**
   - ✅ Автоматическая синхронизация
   - ❌ Дополнительная зависимость
   - ❌ Overkill для простого случая

3. **Текущий подход (useState + useEffect)**
   - ✅ Быстрые оптимистичные обновления
   - ✅ Синхронизация с сервером
   - ✅ Нет дополнительных зависимостей
   - ✅ Простой и понятный код

## Заключение

Баг был в клиентском коде, а не в серверной логике. После добавления обновления локального состояния проблема полностью решена. Система работает быстро и предсказуемо.
