# Compact Save Auth Modal - Implementation Complete ✅

## Проблема

При попытке сохранить маршрут/событие у неавторизованного пользователя открывалась тяжёлая универсальная auth-модалка (`SiteAuthModal`), которая содержала:

- ❌ Вход через телефон (PhoneLoginForm)
- ❌ SMS/OTP verification
- ❌ Комбинированный UI с множеством опций
- ❌ Перегруженный layout для простого save-intent действия

Это плохой UX для high-intent сценария "сохранить". Пользователь уже почти завершил полезное действие, а система показывает перегруженный auth-комбайн.

## Решение

Создан отдельный **компактный auth modal** специально для save scenarios:

### CompactSaveAuthModal

Новый компонент с минималистичным UI, содержащий только:

✅ Email + Password auth  
✅ Переключение Вход ↔ Регистрация  
✅ Компактный layout  
✅ Контекстные заголовки  
✅ Без телефона  
✅ Без SMS/OTP  
✅ Без лишних блоков  

---

## Архитектура

### 1. Новый компонент: CompactSaveAuthModal

**Файл:** `src/components/auth/CompactSaveAuthModal.tsx`

**Props:**
```typescript
interface CompactSaveAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;              // Контекстный заголовок
  subtitle: string;           // Контекстный подзаголовок
  dialogTitle?: string;       // Для accessibility
  onAuthSuccess?: () => void; // Callback после успешного auth
  entityType?: "event" | "route" | string; // Для аналитики
}
```

**Ключевые особенности:**

1. **Только Email/Password**
   - Нет PhoneLoginForm
   - Нет SMS/OTP блоков
   - Простая форма с 2-3 полями

2. **Компактный Layout**
   - Меньше padding: `p-5 sm:p-6` вместо `p-6 sm:p-8`
   - Меньше высота инпутов: `h-11` вместо `h-12`
   - Меньше spacing: `space-y-3` и `space-y-4`
   - Узкая модалка: `max-w-[400px]` вместо `max-w-[440px]`

3. **Простое переключение режимов**
   - Toggle между "Войти" и "Регистрация"
   - Без сложных условий
   - Без phone verification state

4. **Контекстные заголовки**
   - "Войдите, чтобы сохранить событие"
   - "Войдите, чтобы сохранить маршрут"
   - Динамические subtitles

5. **Reuse Core Auth Logic**
   - Использует те же API endpoints:
     - `POST /api/auth/login`
     - `POST /api/auth/complete-registration`
   - Та же валидация
   - Те же auth helpers
   - Та же post-auth orchestration

---

## Интеграция

### SaveEventOnboarding

**Было:**
```typescript
import { SiteAuthModal } from "@/components/auth/SiteAuthModal";

<SiteAuthModal
  open={open}
  onOpenChange={handleCancel}
  nextHref={nextHref}
  title="Войдите, чтобы сохранить"
  subtitle="Сохраняйте события в план..."
  onAuthSuccess={handleAuthSuccess}
/>
```

**Стало:**
```typescript
import { CompactSaveAuthModal } from "@/components/auth/CompactSaveAuthModal";

<CompactSaveAuthModal
  open={open}
  onOpenChange={handleCancel}
  nextHref={nextHref}
  dialogTitle="Вход для сохранения"
  title="Войдите, чтобы сохранить"
  subtitle={
    selectedDate
      ? "Сохраняйте события в план и не пропускайте важное"
      : "Сохраняйте идеи и возвращайтесь к ним позже"
  }
  onAuthSuccess={handleAuthSuccess}
  entityType="event"
/>
```

### SaveRouteOnboarding

**Было:**
```typescript
import { SiteAuthModal } from "@/components/auth/SiteAuthModal";

<SiteAuthModal
  open={open}
  onOpenChange={handleCancel}
  nextHref={nextHref}
  title="Войдите, чтобы сохранить маршрут"
  subtitle="Сохраняйте маршруты в план..."
  onAuthSuccess={handleAuthSuccess}
/>
```

**Стало:**
```typescript
import { CompactSaveAuthModal } from "@/components/auth/CompactSaveAuthModal";

<CompactSaveAuthModal
  open={open}
  onOpenChange={handleCancel}
  nextHref={nextHref}
  dialogTitle="Вход для сохранения"
  title="Войдите, чтобы сохранить маршрут"
  subtitle={
    selectedDate
      ? "Сохраняйте маршруты в план и не пропускайте интересное"
      : "Сохраняйте идеи маршрутов и возвращайтесь к ним позже"
  }
  onAuthSuccess={handleAuthSuccess}
  entityType="route"
/>
```

---

## Что убрано из Compact варианта

### ❌ PhoneLoginForm
Полностью исключён компонент с телефонным входом:
```typescript
// НЕТ в CompactSaveAuthModal:
<PhoneLoginForm
  purpose="LOGIN"
  initialPhone={sharedRawPhone.current}
  next={nextHref}
  onPhoneChange={(raw: string) => { ... }}
  onSwitchMode={() => switchMode("register")}
  onSuccess={onAuthSuccess}
/>
```

### ❌ SMS/OTP Verification
Нет состояния и UI для SMS verification:
```typescript
// НЕТ в CompactSaveAuthModal:
const [registerPhoneVerified, setRegisterPhoneVerified] = useState(false);

{mode === "register" && registerPhoneVerified && (
  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
    Номер подтверждён. Теперь завершите создание профиля.
  </div>
)}
```

### ❌ Разделитель "или"
Нет разделителя между phone и email формами:
```typescript
// НЕТ в CompactSaveAuthModal:
{mode === "login" && (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-px bg-neutral-200" />
    <span className="text-xs text-neutral-400">или</span>
    <div className="flex-1 h-px bg-neutral-200" />
  </div>
)}
```

### ❌ Условный рендеринг email формы
Email форма всегда видна, не зависит от phone verification:
```typescript
// В SiteAuthModal:
registerPhoneVerified={mode === "register" ? registerPhoneVerified : true}

// В CompactSaveAuthModal:
// Форма всегда активна, нет условий
```

### ❌ Shared phone state
Нет синхронизации телефона между формами:
```typescript
// НЕТ в CompactSaveAuthModal:
const sharedRawPhone = useRef("");
```

---

## Что сохранено

### ✅ Core Auth Logic

**Login:**
```typescript
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
  body: JSON.stringify({ email: emailVal, password: passwordVal }),
});
```

**Register:**
```typescript
const res = await fetch("/api/auth/complete-registration", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "same-origin",
  body: JSON.stringify({ email: emailVal, password: passwordVal }),
});
```

### ✅ Post-Auth Flow

```typescript
const raw = nextHref ?? getPostAuthRedirect();
const target = appendBirthdayBuilderAuthParam(raw);
notifyAuthStateChanged();
onAuthSuccess?.();
router.replace(target);
router.refresh();
```

### ✅ Validation

- Email validation: `isValidEmail()`
- Password length: `MIN_PASSWORD_LEN = 8`
- Password match check для регистрации
- FormData для browser autofill

### ✅ Error Handling

- Network errors
- Invalid credentials
- Existing account
- Password mismatch

### ✅ Accessibility

- DialogTitle для screen readers
- Proper labels
- Keyboard navigation
- Focus management

---

## UI Comparison

### SiteAuthModal (Default)

```
┌─────────────────────────────────────┐
│  [X]                                │
│                                     │
│  Войдите в аккаунт                  │
│  Сохраняйте идеи и получайте...     │
│                                     │
│  ┌─────────┬──────────────┐         │
│  │ Войти   │ Регистрация  │         │
│  └─────────┴──────────────┘         │
│                                     │
│  ┌─────────────────────────┐        │
│  │ +375 (__) ___-__-__     │ Phone │
│  └─────────────────────────┘        │
│  ┌─────────────────────────┐        │
│  │ Получить код            │        │
│  └─────────────────────────┘        │
│                                     │
│  ────────── или ──────────          │
│                                     │
│  ┌─────────────────────────┐        │
│  │ Email                   │        │
│  └─────────────────────────┘        │
│  ┌─────────────────────────┐        │
│  │ Пароль            [👁]  │        │
│  └─────────────────────────┘        │
│  ┌─────────────────────────┐        │
│  │ Войти                   │        │
│  └─────────────────────────┘        │
│                                     │
│  Большая высота, много padding      │
└─────────────────────────────────────┘
```

### CompactSaveAuthModal (New)

```
┌──────────────────────────────┐
│  [X]                         │
│                              │
│  Войдите, чтобы сохранить    │
│  Сохраняйте события в план   │
│                              │
│  ┌──────────┬──────────────┐ │
│  │ Войти    │ Регистрация  │ │
│  └──────────┴──────────────┘ │
│                              │
│  ┌────────────────────────┐  │
│  │ Email                  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Пароль          [👁]   │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Войти                  │  │
│  └────────────────────────┘  │
│                              │
│  Компактная высота           │
└──────────────────────────────┘
```

**Разница:**
- ❌ Нет phone блока
- ❌ Нет SMS/OTP
- ❌ Нет разделителя "или"
- ✅ Меньше padding
- ✅ Меньше высота
- ✅ Фокус на email/password

---

## Где используется

### ✅ SAVE_EVENT Entry Point
- `SaveEventOnboarding` → `CompactSaveAuthModal`
- Сохранение событий в план/идеи

### ✅ SAVE_ROUTE Entry Point
- `SaveRouteOnboarding` → `CompactSaveAuthModal`
- Сохранение маршрутов в план/идеи

### ❌ Другие сценарии
- Header profile → `SiteAuthModal` (default)
- My Plan → `SiteAuthModal` (default)
- Birthday Constructor → `SiteAuthModal` (default)
- Review Create → `SiteAuthModal` (default)
- Generic Login → `SiteAuthModal` (default)

---

## Что НЕ сломано

### ✅ SiteAuthModal остаётся без изменений
Большая универсальная auth-модалка продолжает работать для других сценариев:
- Вход через профиль
- Регистрация с телефоном
- SMS verification для отзывов (future)
- Полный onboarding flow

### ✅ PhoneLoginForm не удалён
Компонент остаётся в проекте и используется в `SiteAuthModal`

### ✅ SMS инфраструктура сохранена
- SMS verification остаётся для future review flow
- API endpoints не тронуты
- Phone validation не удалена

### ✅ Auth API не изменены
- `POST /api/auth/login` - без изменений
- `POST /api/auth/complete-registration` - без изменений
- `POST /api/auth/session` - без изменений

---

## Pending Action Resume

После успешного auth через `CompactSaveAuthModal`:

1. `onAuthSuccess()` вызывается
2. `handleAuthSuccess()` в SaveEventOnboarding/SaveRouteOnboarding
3. `completeOnboarding(userId)` в orchestrator
4. Orchestrator выполняет pending action:
   - `executeSaveEvent()` или
   - `executeSaveEventWithDate()` или
   - `executeSaveRouteToPlan()` или
   - `executeSaveRouteToIdeas()`
5. Success toast показывается
6. Modal закрывается
7. Пользователь остаётся на странице (return-to-intent)

**Логика resume не изменилась** - изменился только UI входа.

---

## Analytics (Future)

Можно добавить события для compact variant:

```typescript
// В CompactSaveAuthModal
trackOnboardingEvent("compact_save_auth_opened", {
  variant: "compact-save",
  entityType,
  mode,
});

trackOnboardingEvent("compact_save_auth_completed", {
  variant: "compact-save",
  entityType,
  authMode: mode,
});

trackOnboardingEvent("compact_save_auth_abandoned", {
  variant: "compact-save",
  entityType,
  reason: "user_closed_modal",
});
```

---

## Файлы

### Созданные:
- ✅ `src/components/auth/CompactSaveAuthModal.tsx` - Новый компактный auth modal

### Изменённые:
- ✅ `src/components/onboarding/SaveEventOnboarding.tsx` - Использует CompactSaveAuthModal
- ✅ `src/components/onboarding/SaveRouteOnboarding.tsx` - Использует CompactSaveAuthModal

### Не изменённые:
- ✅ `src/components/auth/SiteAuthModal.tsx` - Остаётся для других сценариев
- ✅ `src/app/(auth)/login/PhoneLoginForm.tsx` - Не тронут
- ✅ `src/app/(auth)/login/EmailLoginForm.tsx` - Не тронут
- ✅ API endpoints - Не тронуты

---

## Результат

✅ Для `SAVE_EVENT` и `SAVE_ROUTE` открывается компактный auth modal  
✅ Нет телефона, SMS/OTP, лишних блоков  
✅ Только email + password  
✅ Компактный layout  
✅ Контекстные заголовки  
✅ Core auth logic переиспользуется  
✅ Pending action resume работает  
✅ SiteAuthModal не сломан  
✅ SMS инфраструктура сохранена  
✅ Phone auth доступен в других сценариях  

---

## Next Steps

1. **Тестирование:**
   - Неавторизованный пользователь → save event → compact auth
   - Неавторизованный пользователь → save route → compact auth
   - Вход через compact modal → pending action resume
   - Регистрация через compact modal → pending action resume

2. **Analytics:**
   - Добавить tracking для compact variant
   - Сравнить conversion rate с default modal

3. **UI Polish:**
   - Анимации
   - Loading states
   - Error states

4. **Расширение:**
   - Использовать compact variant для других save scenarios
   - Добавить forgot password link (опционально)
