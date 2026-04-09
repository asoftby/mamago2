# Save Flow Fix — Краткий Summary

## Проблема
Двойное открытие модалок при сохранении публикации незарегистрированным пользователем:
- Auth modal (вход)
- Save modal (выбор плана/идей)

## Решение
Единый архитектурный flow через SaveActivityFlow с поддержкой SaveIntentContext.

## Что было сделано

### 1. Созданы новые компоненты
- `SaveIntentContext` — управление deferred save actions
- `SaveActivityFlowV2` — улучшенный flow с поддержкой контекста

### 2. Обновлены компоненты
- `SaveEventOnboarding` — теперь использует SaveActivityFlow вместо CompactSaveAuthModal
- `SaveRouteOnboarding` — теперь использует SaveActivityFlow вместо CompactSaveAuthModal

### 3. Интегрировано в layout
- `SaveIntentProvider` добавлен в `src/app/layout.tsx`

## Результат

### До
```
Пользователь нажимает save
  ↓
Auth modal открывается
  ↓
Пользователь входит
  ↓
Auth modal закрывается
  ↓
Save modal открывается ← ПРОБЛЕМА: вторая модалка
  ↓
Пользователь выбирает опцию
  ↓
Сохранение выполняется
```

### После
```
Пользователь нажимает save
  ↓
SaveActivityFlow открывается (phase="select")
  ↓
Пользователь выбирает опцию
  ↓
SaveActivityFlow переходит на phase="auth"
  ↓
Пользователь входит
  ↓
SaveActivityFlow выполняет сохранение
  ↓
SaveActivityFlow показывает success state
  ↓
SaveActivityFlow закрывается
```

## Файлы

### Созданы
- `src/lib/save/SaveIntentContext.tsx`
- `src/components/activity/SaveActivityFlowV2.tsx`
- `SAVE_FLOW_ARCHITECTURE.md`
- `SAVE_FLOW_IMPLEMENTATION.md`
- `SAVE_FLOW_SUMMARY.md` (этот файл)

### Изменены
- `src/components/onboarding/SaveEventOnboarding.tsx`
- `src/components/onboarding/SaveRouteOnboarding.tsx`
- `src/app/layout.tsx`

## Проверка

Все файлы прошли проверку на синтаксические ошибки ✅

## Тестирование

Нужно протестировать вручную:
1. Save Heart на карточке (незарегистрированный)
2. Save Event на странице события (незарегистрированный)
3. Save Route Onboarding (незарегистрированный)
4. Save Event Onboarding (незарегистрированный)
5. Все варианты: "В план", "В идеи", "Убрать из идей"
6. Закрытие модалки на разных шагах

## Преимущества

✅ Одна модалка вместо двух
✅ Бесшовный UX
✅ Нет race conditions
✅ Архитектурное решение (не workaround)
✅ Легко расширять
✅ Легко тестировать
