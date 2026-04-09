# Архитектура единого Save Flow

## Проблема
При попытке сохранить публикацию незарегистрированным пользователем открываются две модалки одновременно/последовательно:
1. Auth modal (вход/регистрация)
2. Save modal (выбор плана/идей)

Это происходит из-за дублирования логики управления модалками в разных компонентах.

## Текущее состояние

### Компоненты, которые работают правильно:
- **SaveActivityFlow** — единый flow (select → auth → success) ✅
- **SaveHeart** — использует SaveActivityFlow ✅
- **EventPageView** — использует SaveActivityFlow ✅

### Компоненты, которые работают неправильно:
- **SaveEventOnboarding** — использует CompactSaveAuthModal отдельно ❌
- **SaveRouteOnboarding** — использует CompactSaveAuthModal отдельно ❌
- **MyPlanProvider** — имеет собственный flow (MyPlanUnauthFlow) ❌

## Решение

### 1. SaveIntentContext (новый)
Единый источник истины для deferred save actions:
```typescript
type SaveIntent = {
  id: string;
  type: "publication" | "plan-date-selection";
  entityType: string;
  entityId: string;
  entityTitle: string;
  coverImageUrl?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
};
```

### 2. SaveActivityFlowV2 (новый)
Улучшенная версия SaveActivityFlow с поддержкой SaveIntentContext.

### 3. Миграция компонентов

#### SaveEventOnboarding → SaveActivityFlow
Вместо отдельного CompactSaveAuthModal, использовать SaveActivityFlow:
- Открыть SaveActivityFlow с `isAuthenticated=false`
- Flow автоматически покажет auth шаг
- После успешной авторизации продолжить сохранение

#### SaveRouteOnboarding → SaveActivityFlow
Аналогично SaveEventOnboarding.

#### MyPlanProvider
Оставить MyPlanUnauthFlow как есть (это отдельный product flow для "Мой план", не для сохранения публикаций).

### 4. Защита от race conditions

**Проблема:** Если пользователь нажимает save несколько раз, может открыться несколько модалок.

**Решение:**
- SaveActivityFlow проверяет `open` prop
- Если уже открыт, повторный trigger игнорируется
- SaveIntentContext хранит только один pending intent

### 5. Обработка закрытия

- Если пользователь закрыл auth modal → pending intent очищается
- Если пользователь успешно вошел, но закрыл flow на шаге save-options → ничего не сохраняется
- Если сохранение instant (без выбора) → выполняется сразу после auth

## Файлы для изменения

1. ✅ `src/lib/save/SaveIntentContext.tsx` — создан
2. ✅ `src/components/activity/SaveActivityFlowV2.tsx` — создан
3. `src/components/onboarding/SaveEventOnboarding.tsx` — обновить
4. `src/components/onboarding/SaveRouteOnboarding.tsx` — обновить
5. `src/lib/root-layout.tsx` или `src/app/layout.tsx` — добавить SaveIntentProvider
6. `src/components/event-page/EventPageView.tsx` — опционально обновить (уже работает)

## User Flows (проверены)

### Flow 1: Save Heart на карточке (незарегистрированный)
1. Пользователь нажимает сердечко
2. SaveActivityFlow открывается с phase="select"
3. Пользователь выбирает "В план" или "В идеи"
4. SaveActivityFlow переходит на phase="auth"
5. Пользователь входит/регистрируется
6. SaveActivityFlow выполняет сохранение
7. SaveActivityFlow показывает success state
8. SaveActivityFlow закрывается

**Результат:** Одна модалка, бесшовный flow ✅

### Flow 2: Save Event на странице события (незарегистрированный)
1. Пользователь нажимает "В план"
2. SaveActivityFlow открывается с phase="select"
3. Пользователь выбирает дату
4. SaveActivityFlow переходит на phase="auth"
5. Пользователь входит/регистрируется
6. SaveActivityFlow выполняет сохранение
7. SaveActivityFlow показывает success state
8. SaveActivityFlow закрывается

**Результат:** Одна модалка, бесшовный flow ✅

### Flow 3: My Plan (незарегистрированный)
1. Пользователь нажимает "Мой план" в хедере
2. MyPlanOverlay открывается с MyPlanUnauthFlow
3. MyPlanUnauthFlow показывает onboarding
4. Пользователь нажимает "Войти" или "Создать аккаунт"
5. MyPlanUnauthFlow переходит на auth шаг
6. Пользователь входит/регистрируется
7. MyPlanUnauthFlow показывает план
8. Пользователь может сохранять события внутри плана

**Результат:** Один overlay, бесшовный flow ✅

## Преимущества

1. **Единый механизм** — все save actions используют SaveActivityFlow
2. **Нет race conditions** — SaveIntentContext хранит только один pending intent
3. **Бесшовный UX** — пользователь видит одну модалку
4. **Легко расширять** — новые save scenarios просто добавляют новый SaveScenario
5. **Легко тестировать** — SaveActivityFlow полностью изолирован

## Миграция

### Шаг 1: Добавить SaveIntentProvider в layout
```typescript
<SaveIntentProvider>
  {children}
</SaveIntentProvider>
```

### Шаг 2: Обновить SaveEventOnboarding
Заменить CompactSaveAuthModal на SaveActivityFlow.

### Шаг 3: Обновить SaveRouteOnboarding
Заменить CompactSaveAuthModal на SaveActivityFlow.

### Шаг 4: Тестирование
- Проверить все entry points (card, detail page, onboarding)
- Проверить auth flow (login, register)
- Проверить save scenarios (plan, ideas, remove)
- Проверить close scenarios (cancel, success)
