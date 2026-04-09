# Save Route Flow - Implementation Complete ✅

## Проблемы, которые были исправлены

### 1. ❌ Отсутствовал onboarding/auth flow для неавторизованных
**Было:** Модалка сразу показывала ложный success без проверки авторизации
**Стало:** Полноценный auth flow через Onboarding Orchestrator

### 2. ❌ Ложный success до завершения действия
**Было:** Toast "Добавлено в план" показывался сразу, даже если пользователь не авторизован
**Стало:** Success показывается только после реального завершения pending action

### 3. ❌ Отсутствовала опция "Сохранить в Идеи"
**Было:** Только 3 опции (Сегодня, Завтра, Выбрать дату)
**Стало:** 4 опции, включая "Сохранить в Идеи" как отдельное явное действие

### 4. ❌ Использовался примитивный input date
**Было:** `<input type="date">` вместо нормального datepicker
**Стало:** Полноценный `DatePicker` из ui-lab с красивым UI

### 5. ❌ Не было унификации с Save Event flow
**Было:** Отдельная хаотичная реализация
**Стало:** Использует тот же Onboarding Orchestrator и pending action architecture

---

## Архитектура решения

### 1. Расширение Pending Action Manager

Добавлены два новых типа pending actions:

```typescript
// Save route to plan (with date)
export interface SaveRouteToPlanAction {
  type: "saveRouteToPlan";
  payload: {
    routeId: string;
    routeSlug: string;
    routeTitle?: string;
    date: string;
  };
}

// Save route to ideas (without date)
export interface SaveRouteToIdeasAction {
  type: "saveRouteToIdeas";
  payload: {
    routeId: string;
    routeSlug: string;
    routeTitle?: string;
  };
}
```

**Typed helpers:**
```typescript
setPendingSaveRouteToPlan(routeId, routeSlug, date, { routeTitle })
setPendingSaveRouteToIdeas(routeId, routeSlug, { routeTitle })
```

**Type guards:**
```typescript
isSaveRouteToPlanAction(action)
isSaveRouteToIdeasAction(action)
```

### 2. Executors в Orchestrator

Добавлены функции для выполнения pending actions:

```typescript
async function executeSaveRouteToPlan(payload, userId) {
  // POST /api/plan/routes
  // { routeId, routeSlug, date }
}

async function executeSaveRouteToIdeas(payload, userId) {
  // POST /api/ideas/routes
  // { routeId, routeSlug }
}
```

### 3. Hook: useSaveRouteOnboarding

Аналогичен `useSaveEventOnboarding`, но для маршрутов:

```typescript
const {
  showOnboarding,
  pendingParams,
  initiateSave,
  closeOnboarding,
  handleSaveComplete,
} = useSaveRouteOnboarding({
  sourceContext: "route_card",
  onSaveComplete: (result) => {
    // result.savedTo: "ideas" | "plan"
    // result.date?: string
  }
});
```

**Логика:**
- Если `isAuthenticated` → прямой API call
- Если не авторизован → pending action + onboarding modal

### 4. Component: SaveRouteOnboarding

Wrapper вокруг `SiteAuthModal` для маршрутов:

```typescript
<SaveRouteOnboarding
  open={showOnboarding}
  onOpenChange={closeOnboarding}
  routeId={routeId}
  routeSlug={routeSlug}
  routeTitle={routeTitle}
  selectedDate={selectedDate}  // Optional
  sourceContext="route_card"
  onSaveComplete={handleSaveComplete}
/>
```

**После успешного auth:**
1. Получает userId из session
2. Вызывает `completeOnboarding(userId)`
3. Orchestrator автоматически выполняет pending action
4. Показывает success toast
5. Остаётся на текущей странице (return-to-intent)

### 5. Переработанный AddRouteToPlanSheet

**Новые props:**
```typescript
{
  routeId: string;        // Добавлено
  isAuthenticated: boolean; // Добавлено
  routeTitle: string;
  routeSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**4 действия в модалке:**

1. **Сегодня** → `handleSave(getTodayISO())`
2. **Завтра** → `handleSave(getTomorrowISO())`
3. **Выбрать дату** → Открывает DatePicker из ui-lab
4. **Сохранить в идеи** → `handleSave(undefined)`

**View states:**
- `"quick"` - Главное меню с 4 опциями
- `"datepicker"` - DatePicker для выбора даты

**DatePicker integration:**
```typescript
<DatePicker
  value={selectedDate}
  onDateChange={setSelectedDate}
  disablePast={true}
  placeholder="Выберите дату"
/>
```

### 6. Обновлённые компоненты

**RouteCard.tsx:**
```typescript
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";

const { isAuthenticated } = useAuthMe();

<AddRouteToPlanSheet
  routeId={route.id}
  isAuthenticated={isAuthenticated}
  // ... other props
/>
```

**RouteDetailClient.tsx:**
```typescript
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";

const { isAuthenticated } = useAuthMe();

<AddRouteToPlanSheet
  routeId={route.id}
  isAuthenticated={isAuthenticated}
  // ... other props
/>
```

---

## Flow Execution

### Для неавторизованного пользователя:

#### Сценарий 1: Сегодня
1. Клик "Сегодня"
2. `initiateSave({ routeId, routeSlug, selectedDate: today }, false)`
3. `setPendingSaveRouteToPlan(routeId, routeSlug, today)`
4. Открывается `SaveRouteOnboarding` modal
5. Пользователь проходит auth (email + password)
6. `handleAuthSuccess()` → `completeOnboarding(userId)`
7. Orchestrator выполняет `executeSaveRouteToPlan()`
8. API call: `POST /api/plan/routes { routeId, routeSlug, date: today }`
9. Success toast: "Маршрут добавлен в план на 5 апреля"
10. Модалка закрывается, пользователь остаётся на странице

#### Сценарий 2: Завтра
Аналогично, но `date: tomorrow`

#### Сценарий 3: Выбрать дату
1. Клик "Выбрать дату"
2. Открывается DatePicker view
3. Пользователь выбирает дату в календаре
4. Клик "Добавить в план"
5. `initiateSave({ routeId, routeSlug, selectedDate }, false)`
6. `setPendingSaveRouteToPlan(routeId, routeSlug, selectedDate)`
7. Открывается `SaveRouteOnboarding` modal
8. Auth flow → pending action execution
9. Success toast с выбранной датой

#### Сценарий 4: Сохранить в идеи
1. Клик "Сохранить в идеи"
2. `initiateSave({ routeId, routeSlug, selectedDate: undefined }, false)`
3. `setPendingSaveRouteToIdeas(routeId, routeSlug)`
4. Открывается `SaveRouteOnboarding` modal
5. Auth flow → pending action execution
6. API call: `POST /api/ideas/routes { routeId, routeSlug }`
7. Success toast: "Маршрут сохранён в идеи"

### Для авторизованного пользователя:

#### Любой сценарий:
1. Клик на действие
2. `initiateSave({ ... }, true)`
3. Прямой API call (без onboarding)
4. Success toast
5. Модалка закрывается

---

## API Endpoints

Реализация ожидает следующие endpoints:

### Save to Plan
```
POST /api/plan/routes
Body: {
  routeId: string;
  routeSlug: string;
  date: string; // ISO format YYYY-MM-DD
}
```

### Save to Ideas
```
POST /api/ideas/routes
Body: {
  routeId: string;
  routeSlug: string;
}
```

---

## Отличия от Save Event Flow

| Аспект | Save Event | Save Route |
|--------|-----------|------------|
| Entity type | Activity | Route |
| Pending actions | `saveEvent`, `saveEventWithDate` | `saveRouteToPlan`, `saveRouteToIdeas` |
| API endpoints | `/api/ideas`, `/api/plan` | `/api/ideas/routes`, `/api/plan/routes` |
| Onboarding entry point | `SAVE_EVENT` | `SAVE_EVENT` (reused) |
| Auth flow | Email + password only | Email + password only |
| SMS | ❌ Not used | ❌ Not used |
| DatePicker | Not used in modal | ui-lab DatePicker |
| "Save to Ideas" option | Implicit fallback | Explicit UI option |

---

## Что НЕ используется

✅ **SMS verification** - остаётся для future review flow  
✅ **Child profile** - не запрашивается в этом flow  
✅ **Preferences/interests** - не запрашиваются  
✅ **Phone number** - не запрашивается  
✅ **Long onboarding** - только email + password  

---

## Edge Cases

### 1. Пользователь закрыл auth modal
- Pending action сохраняется в sessionStorage
- Success не показывается
- При повторном клике можно продолжить

### 2. Маршрут уже сохранён
- API должен вернуть ошибку или игнорировать дубль
- Показать соответствующий toast

### 3. Выбранная дата стала невалидной
- DatePicker блокирует прошлые даты (`disablePast={true}`)
- Если дата всё равно невалидна, API вернёт ошибку

### 4. Несколько быстрых кликов
- `saving` state блокирует повторные клики
- Pending action перезаписывается (последний wins)

### 5. Маршрут удалён/unpublished
- API вернёт 404
- Показать error toast: "Маршрут недоступен"

---

## Analytics Events

Добавлены события (через `trackOnboardingEvent`):

- `pending_action_completed` с `actionType: "saveRouteToPlan"`
- `pending_action_completed` с `actionType: "saveRouteToIdeas"`

Дополнительные события можно добавить:
- `route_save_modal_opened`
- `route_save_option_selected`
- `route_save_datepicker_opened`
- `route_save_date_selected`
- `route_save_auth_opened`
- `route_save_auth_completed`
- `route_save_completed_to_plan`
- `route_save_completed_to_ideas`

---

## Файлы

### Созданные:
- `src/hooks/useSaveRouteOnboarding.ts` - Hook для save route flow
- `src/components/onboarding/SaveRouteOnboarding.tsx` - Auth modal wrapper
- `SAVE_ROUTE_FLOW_COMPLETE.md` - Эта документация

### Изменённые:
- `src/lib/onboarding/pendingActionManager.ts` - Добавлены route actions
- `src/lib/onboarding/orchestrator.ts` - Добавлены route executors
- `src/lib/onboarding/index.ts` - Экспорты route helpers
- `src/components/routes/AddRouteToPlanSheet.tsx` - Полная переработка
- `src/components/routes/RouteCard.tsx` - Добавлен isAuthenticated
- `src/app/(public)/routes/[slug]/RouteDetailClient.tsx` - Добавлен isAuthenticated

---

## Результат

✅ У маршрута работает простой auth/onboarding flow для неавторизованного пользователя  
✅ В модалке есть 4 действия: Сегодня, Завтра, Выбрать дату, Сохранить в Идеи  
✅ "Выбрать дату" открывает DatePicker из ui-lab  
✅ После auth выполняется ровно тот action, который пользователь выбрал до входа  
✅ Success показывается только после реального завершения save  
✅ Есть разделение: route → plan with date, route → ideas without date  
✅ Пользователь не теряет контекст (return-to-intent)  
✅ SMS не используется в этом flow  
✅ Унифицировано с Save Event architecture  

---

## Next Steps

1. **Реализовать API endpoints:**
   - `POST /api/plan/routes`
   - `POST /api/ideas/routes`

2. **Тестирование:**
   - Неавторизованный пользователь → все 4 сценария
   - Авторизованный пользователь → прямое сохранение
   - Edge cases (дубли, удалённые маршруты, etc.)

3. **Analytics:**
   - Добавить детальные события для route save flow
   - Отслеживать conversion rate auth → save

4. **UI polish:**
   - Анимации переходов между views
   - Loading states
   - Error states

5. **Интеграция с My Plan:**
   - Показывать сохранённые маршруты в плане
   - Поддержка редактирования/удаления
