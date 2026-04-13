# Onboarding Orchestrator

Единый слой маршрутизации и правил для всех регистрационных entry points в mamaGo 2.0.

## Архитектура

### Текущая архитектура (до рефакторинга)

**Проблемы**:
- Разрозненные auth модалки (`SiteAuthModal`, `MyPlanAuthModal`, `BirthdayBuilderAuthModal`)
- Pending actions только для birthday builder
- Post-auth redirect через URL параметр `next`
- SMS смешан с регистрацией
- Нет единой типизации intent/outcome
- Нет deferred prompts механизма

### Целевая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                  Onboarding Orchestrator                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Types      │  │   Scenario   │  │   Context    │      │
│  │              │  │   Registry   │  │   Manager    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pending    │  │ Orchestrator │  │  Analytics   │      │
│  │   Actions    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
   │ Header  │         │  Save   │        │ My Plan │
   │ Profile │         │  Event  │        │         │
   └─────────┘         └─────────┘        └─────────┘
```

## Компоненты

### 1. Types (`types.ts`)

Определяет все базовые типы:

- `OnboardingEntryPoint` - откуда пользователь пришёл
- `OnboardingIntent` - что хочет сделать
- `OnboardingOutcome` - куда вести после завершения
- `DeferredPromptType` - что предложить позже
- `PendingAction` - действие для выполнения после auth
- `OnboardingContext` - полный контекст flow
- `PostAuthResult` - результат завершения
- `OnboardingScenario` - конфигурация сценария

### 2. Scenario Registry (`scenarioRegistry.ts`)

Единый реестр всех onboarding сценариев:

```typescript
const SCENARIO_REGISTRY: Record<OnboardingEntryPoint, OnboardingScenario> = {
  HEADER_PROFILE: { ... },
  SAVE_EVENT: { ... },
  MY_PLAN: { ... },
  BIRTHDAY_CONSTRUCTOR: { ... },
  REVIEW_CREATE: { ... },
  GENERIC_LOGIN: { ... },
};
```

Каждый сценарий определяет:
- Обязательные поля
- Опциональные поля
- Стратегию завершения
- Deferred prompts

### 3. Context Manager (`contextManager.ts`)

Управление контекстом onboarding flow:

- `createOnboardingContext()` - создать контекст
- `saveOnboardingContext()` - сохранить в sessionStorage
- `getOnboardingContext()` - получить текущий
- `clearOnboardingContext()` - очистить
- `initOnboardingContext()` - инициализировать для entry point

### 4. Pending Action Manager (`pendingActionManager.ts`)

Единый менеджер для всех pending actions:

**Типы действий**:
- `saveEvent` - сохранить в идеи
- `saveEventWithDate` - сохранить в план
- `openPlan` - открыть план
- `birthdayConstructor` - действие в конструкторе
- `createReview` - создать отзыв (future: SMS)

**API**:
```typescript
setPendingAction(action)
getPendingAction()
consumePendingAction()
clearPendingAction()

// Typed helpers
setPendingSaveEvent(activityId)
setPendingSaveEventWithDate(activityId, date)
setPendingOpenPlan(date)
setPendingBirthdayAction(action, offerId)
setPendingCreateReview(activityId)
```

### 5. Orchestrator (`orchestrator.ts`)

Главный координатор:

```typescript
// Start onboarding
const context = startOnboarding(entryPoint, options);

// Complete onboarding
const result = await completeOnboarding(userId, completedSteps, skippedSteps);

// Cancel onboarding
cancelOnboarding(reason);

// Deferred prompts
const prompt = getNextDeferredPrompt();
markDeferredPromptShown(type);
```

**Логика завершения**:
1. Получить контекст
2. Выполнить pending action (если есть)
3. Определить next action и redirect
4. Получить deferred prompts
5. Запланировать deferred prompts
6. Track analytics
7. Очистить контекст

### 6. Analytics (`analytics.ts`)

Tracking onboarding events:

**События**:
- `onboarding_entry_opened`
- `onboarding_entry_completed`
- `onboarding_step_viewed`
- `onboarding_step_completed`
- `onboarding_step_skipped`
- `onboarding_abandoned`
- `pending_action_resumed`
- `pending_action_completed`
- `deferred_prompt_scheduled`
- `deferred_prompt_shown`
- `deferred_prompt_completed`
- `deferred_prompt_skipped`

### 7. React Hook (`useOnboarding.ts`)

Hook для использования в компонентах:

```typescript
const {
  context,
  isActive,
  isCompleting,
  start,
  complete,
  cancel,
  hasPendingAction,
} = useOnboarding({
  entryPoint: OnboardingEntryPoint.MY_PLAN,
  returnUrl: "/?myPlan=open",
  onComplete: (result) => { ... },
});
```

## Entry Points

### 1. HEADER_PROFILE
**Intent**: VIEW_PROFILE  
**Required**: email  
**Outcome**: RETURN_TO_PROFILE  
**Deferred**: ADD_CHILD_PROFILE

### 2. SAVE_EVENT
**Intent**: SAVE_TO_IDEAS | SAVE_TO_PLAN  
**Required**: email  
**Outcome**: COMPLETE_SAVE_TO_IDEAS | COMPLETE_SAVE_TO_PLAN  
**Deferred**: ADD_CHILD_PROFILE

### 3. MY_PLAN
**Intent**: OPEN_MY_PLAN  
**Required**: email  
**Optional**: childName, childBirthDate  
**Outcome**: OPEN_MY_PLAN  
**Deferred**: ADD_CHILD_PROFILE, SET_INTERESTS

### 4. BIRTHDAY_CONSTRUCTOR
**Intent**: SUBMIT_BIRTHDAY_REQUEST  
**Required**: email  
**Outcome**: RETURN_TO_BIRTHDAY_RESULT  
**Deferred**: SAVE_BIRTHDAY_CHILD_TO_PROFILE

### 5. REVIEW_CREATE
**Intent**: CREATE_REVIEW  
**Required**: email  
**Optional**: name, phone  
**Outcome**: REQUEST_SMS_VERIFICATION_FOR_REVIEW  
**Deferred**: VERIFY_PHONE_FOR_REVIEWS (non-skippable)

**Важно**: SMS verification только для отзывов, не для регистрации!

## Использование

### Пример 1: Save Event

```typescript
import { startOnboarding, OnboardingEntryPoint, setPendingSaveEvent } from "@/lib/onboarding";

// User clicks "Save" button
function handleSaveClick(activityId: string) {
  if (!isAuthenticated) {
    // Set pending action
    setPendingSaveEvent(activityId);
    
    // Start onboarding
    startOnboarding(OnboardingEntryPoint.SAVE_EVENT, {
      returnUrl: window.location.pathname,
    });
    
    // Open auth modal
    setShowAuthModal(true);
  } else {
    // Save directly
    saveEvent(activityId);
  }
}
```

### Пример 2: My Plan

```typescript
import { useOnboarding, OnboardingEntryPoint } from "@/lib/onboarding";

function MyPlanButton() {
  const { start } = useOnboarding({
    entryPoint: OnboardingEntryPoint.MY_PLAN,
    returnUrl: "/?myPlan=open",
  });
  
  const handleClick = () => {
    if (!isAuthenticated) {
      start();
      setShowAuthModal(true);
    } else {
      openMyPlan();
    }
  };
  
  return <button onClick={handleClick}>Мой план</button>;
}
```

### Пример 3: Post-Auth Completion

```typescript
import { completeOnboarding } from "@/lib/onboarding";

// After successful auth
async function handleAuthSuccess(userId: string) {
  const result = await completeOnboarding(userId, ["email"], []);
  
  // Result contains:
  // - redirectTarget: where to go
  // - completedPendingAction: was action executed
  // - deferredPrompts: what to show later
  
  if (result.redirectTarget) {
    router.push(result.redirectTarget);
  }
  
  // Show deferred prompts later
  if (result.deferredPrompts.length > 0) {
    setTimeout(() => {
      showDeferredPrompt(result.deferredPrompts[0]);
    }, 2000);
  }
}
```

## SMS Verification Strategy

**Важно**: SMS НЕ используется в регистрационном onboarding!

### Текущее состояние
- SMS используется в `PhoneLoginForm` для регистрации
- Это нужно изменить

### Целевое состояние
- Регистрация: только email (без SMS)
- SMS verification: только для отзывов
- Отдельный flow для phone verification

### Архитектурная подготовка

1. **User model**: добавить поле `phoneVerifiedAt`
2. **Review flow**: проверять `phoneVerifiedAt` перед созданием отзыва
3. **SMS verification**: отдельный компонент для верификации телефона
4. **Entry point**: `REVIEW_CREATE` зарезервирован для этого flow

### Будущая реализация (не в этом задании)

```typescript
// When user tries to create review
if (!user.phoneVerifiedAt) {
  // Start SMS verification flow
  startOnboarding(OnboardingEntryPoint.REVIEW_CREATE, {
    returnUrl: `/activity/${activityId}/review`,
  });
  
  // Show phone verification modal
  setShowPhoneVerificationModal(true);
}
```

## Deferred Prompts

Механизм отложенных prompts после регистрации.

### Типы prompts

1. **ADD_CHILD_PROFILE** - добавить ребёнка
2. **SET_INTERESTS** - указать интересы
3. **SET_PREFERENCES** - настроить предпочтения
4. **VERIFY_PHONE_FOR_REVIEWS** - подтвердить телефон для отзывов
5. **SAVE_BIRTHDAY_CHILD_TO_PROFILE** - сохранить данные из birthday constructor

### Конфигурация

```typescript
{
  type: DeferredPromptType.ADD_CHILD_PROFILE,
  priority: 1,
  skippable: true,
  delay: 1000,
  condition: (context, result) => !result.metadata?.hasChildren,
}
```

### Показ prompts

```typescript
// Get next prompt
const prompt = getNextDeferredPrompt();

if (prompt) {
  // Show prompt UI
  showPromptModal(prompt.type);
  
  // Mark as shown
  markDeferredPromptShown(prompt.type);
}
```

## Миграция существующего кода

### Birthday Builder

**Было**:
```typescript
// src/features/birthday/builder/lib/pendingBirthdayBuilderAction.ts
setPendingBirthdayBuilderAction({ type: "selectBase", offerId });
```

**Стало**:
```typescript
import { setPendingBirthdayAction } from "@/lib/onboarding";
setPendingBirthdayAction("selectBase", offerId);
```

### Auth Modals

**Было**: Каждый entry point создаёт свою модалку

**Стало**: Единый orchestrator определяет сценарий

```typescript
// Start onboarding
const context = startOnboarding(entryPoint, options);

// Show generic auth modal with context
<SiteAuthModal
  open={showAuth}
  onOpenChange={setShowAuth}
  title={scenario.title}
  subtitle={scenario.subtitle}
  nextHref={context.returnUrl}
  onAuthSuccess={() => completeOnboarding(userId)}
/>
```

## Файлы

### Созданные файлы

1. `src/lib/onboarding/types.ts` - типы
2. `src/lib/onboarding/scenarioRegistry.ts` - реестр сценариев
3. `src/lib/onboarding/contextManager.ts` - управление контекстом
4. `src/lib/onboarding/pendingActionManager.ts` - pending actions
5. `src/lib/onboarding/orchestrator.ts` - главный координатор
6. `src/lib/onboarding/analytics.ts` - аналитика
7. `src/lib/onboarding/useOnboarding.ts` - React hook
8. `src/lib/onboarding/index.ts` - экспорты
9. `src/lib/onboarding/README.md` - документация

### Файлы для миграции (не в этом задании)

- `src/components/auth/SiteAuthModal.tsx` - интегрировать с orchestrator
- `src/components/auth/MyPlanAuthModal.tsx` - использовать orchestrator
- `src/features/birthday/builder/components/BirthdayBuilderAuthModal.tsx` - использовать orchestrator
- `src/features/birthday/builder/lib/pendingBirthdayBuilderAction.ts` - deprecated, использовать pendingActionManager

## Следующие шаги

1. **Интеграция с существующими auth модалками**
2. **Миграция birthday builder на новый pending action manager**
3. **Реализация deferred prompts UI**
4. **Отделение SMS от регистрации**
5. **Реализация review SMS verification flow**
6. **Реализация специфичных onboarding UI для каждого entry point**

## Принципы

1. **Единый источник правды** - все сценарии в одном месте
2. **Return-to-intent** - пользователь возвращается туда, откуда пришёл
3. **Минимальные требования** - спрашиваем только необходимое
4. **Deferred prompts** - остальное предлагаем позже
5. **Типизация** - всё типизировано через TypeScript
6. **Аналитика** - все события трекаются
7. **Расширяемость** - легко добавить новый entry point

## Важные замечания

- **SMS**: Только для отзывов, не для регистрации!
- **Pending actions**: Переживают auth modal и выполняются после входа
- **Deferred prompts**: Не агрессивные, можно пропустить
- **Context TTL**: 1 час (можно настроить)
- **Pending action TTL**: 30 минут (можно настроить)
- **Analytics**: Все события логируются для отладки
