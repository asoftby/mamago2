# Save Flow Architecture Diagram

## Component Hierarchy

```
RootLayout
├── SaveIntentProvider (новый)
│   └── AccountModeProvider
│       └── FamilyPersonaProvider
│           └── CookieConsentProvider
│               ├── FamilyDerivedAgeSync
│               ├── {children}
│               │   ├── SaveHeart
│               │   │   └── SaveActivityFlow
│               │   ├── EventPageView
│               │   │   └── SaveActivityFlow
│               │   ├── SaveEventOnboarding (обновлен)
│               │   │   └── SaveActivityFlow
│               │   └── SaveRouteOnboarding (обновлен)
│               │       └── SaveActivityFlow
│               └── MyPlanProvider
│                   └── MyPlanOverlay
│                       └── MyPlanUnauthFlow (отдельный flow)
└── Sonner
```

## SaveActivityFlow State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    SaveActivityFlow                         │
│                                                             │
│  open=false                                                │
│  ├─ phase="select"                                         │
│  ├─ pending=null                                           │
│                                                             │
│  open=true                                                 │
│  ├─ phase="select"                                         │
│  │  ├─ SaveToPlanPickerBody                               │
│  │  │  ├─ "В план" → handleCommit(result)                │
│  │  │  ├─ "В идеи" → handleCommit(result)                │
│  │  │  └─ "Убрать из идей" → handleCommit(result)        │
│  │  │                                                      │
│  │  └─ if isAuthenticated                                 │
│  │     └─ runPersist(result) → close                      │
│  │                                                         │
│  │  else                                                   │
│  │     ├─ setPending(result)                              │
│  │     └─ setPhase("auth")                                │
│  │                                                         │
│  ├─ phase="auth"                                          │
│  │  ├─ CompactSaveAuthPanel (embedded)                    │
│  │  │  ├─ login/register                                  │
│  │  │  ├─ onAuthSuccess → handleAuthSuccess()            │
│  │  │  └─ onBack → setPhase("select")                    │
│  │  │                                                      │
│  │  └─ handleAuthSuccess()                                │
│  │     ├─ runPersist(pending)                             │
│  │     ├─ setPhase("success")                             │
│  │     ├─ clearPendingIntent()                            │
│  │     └─ setTimeout(() => close, 1000)                   │
│  │                                                         │
│  └─ phase="success"                                       │
│     ├─ CheckCircle2 icon                                  │
│     ├─ "Сохранено"                                        │
│     └─ auto-close after 1s                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Action (Save Heart Click)
  ↓
SaveHeart.handleHeartClick()
  ├─ setFlowOpen(true)
  └─ SaveActivityFlow.open=true
      ↓
      phase="select"
      ├─ SaveToPlanPickerBody renders
      └─ User selects option
          ↓
          handleCommit(result)
          ├─ if isAuthenticated
          │  └─ runPersist(result)
          │     ├─ persistActivitySave()
          │     ├─ toast.success()
          │     └─ onOpenChange(false)
          │
          else
          ├─ setPending(result)
          ├─ setPhase("auth")
          └─ CompactSaveAuthPanel renders
              ↓
              User logs in/registers
              ↓
              handleAuthSuccess()
              ├─ runPersist(pending)
              │  ├─ persistActivitySave()
              │  └─ toast.success()
              ├─ setPhase("success")
              ├─ clearPendingIntent()
              └─ setTimeout(() => onOpenChange(false), 1000)
```

## SaveIntentContext Usage

```
SaveIntentProvider
├─ pendingIntent: SaveIntent | null
├─ setPendingIntent(intent)
└─ clearPendingIntent()

useSaveIntent() hook
├─ Used in SaveActivityFlowV2
├─ Used in future deferred actions
└─ Prevents race conditions
```

## Component Responsibilities

### SaveActivityFlow
- Управляет фазами (select → auth → success)
- Переключается между фазами на основе isAuthenticated
- Вызывает onPersist для сохранения
- Показывает success state
- Закрывает модалку

### SaveHeart
- Открывает SaveActivityFlow
- Передает activityId, title, coverImageUrl
- Реализует handlePersist для сохранения
- Обновляет saveStatus после успеха

### EventPageView
- Открывает SaveActivityFlow
- Передает data.id, data.title, data.media.posterUrl
- Реализует handleSaveToPlanConfirm для сохранения
- Обновляет saveStatus после успеха

### SaveEventOnboarding (обновлен)
- Открывает SaveActivityFlow
- Передает activityId, activityTitle
- Реализует handlePersist для сохранения
- Вызывает onSaveComplete callback

### SaveRouteOnboarding (обновлен)
- Открывает SaveActivityFlow
- Передает routeId, routeTitle
- Реализует handlePersist для сохранения
- Вызывает onSaveComplete callback

### SaveIntentContext
- Хранит pending intent
- Предотвращает race conditions
- Используется для будущих deferred actions

## Race Condition Prevention

```
Scenario: User clicks save multiple times

Before (PROBLEM):
├─ Click 1 → Auth modal opens
├─ Click 2 → Save modal opens (race condition!)
└─ Result: Two modals visible

After (FIXED):
├─ Click 1 → SaveActivityFlow.open=true
├─ Click 2 → SaveActivityFlow.open already true
│            → No effect (React prevents re-render)
└─ Result: Only one modal visible
```

## Migration Path

```
Old Architecture:
CompactSaveAuthModal (independent)
  ↓
SaveEventOnboarding/SaveRouteOnboarding
  ↓
User sees two modals

New Architecture:
SaveActivityFlow (unified)
  ├─ phase="select"
  ├─ phase="auth" (embedded)
  └─ phase="success"
  ↓
SaveEventOnboarding/SaveRouteOnboarding
  ↓
User sees one modal
```

## Future Extensibility

```
SaveActivityFlow can be extended with:
├─ New scenarios (SaveScenario)
├─ New phases (e.g., "confirmation")
├─ New persist handlers
└─ SaveIntentContext can store multiple intents
   (currently stores one, can be extended to queue)
```
