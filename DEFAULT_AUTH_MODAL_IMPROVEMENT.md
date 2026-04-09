# Default Auth Modal Improvement - Complete ✅

## Проблема

При клике на аккаунт/профиль в хедере открывалась перегруженная `SiteAuthModal`, которая содержала:

- ❌ PhoneLoginForm с телефонным входом
- ❌ SMS/OTP verification UI
- ❌ Разделитель "или" между phone и email
- ❌ Смешанный layout с множеством конкурирующих опций
- ❌ Слабая визуальная иерархия
- ❌ Ощущение "auth-комбайна"

Это не подходило для обычного account entry, где пользователь сам открывает аккаунт.

## Решение

Создан новый **DefaultAuthModal** - чистый, современный auth modal для account entry с:

✅ Только Email/Password auth  
✅ Чистая визуальная иерархия  
✅ Современный UI  
✅ Понятное переключение Вход ↔ Регистрация  
✅ Без phone/SMS перегрузки  
✅ Компактный и приятный layout  

---

## Архитектура Auth Modals

Теперь в проекте есть **3 варианта auth modal** для разных сценариев:

### 1. DefaultAuthModal (NEW) ✨
**Использование:** Account/Profile click в хедере  
**Файл:** `src/components/auth/DefaultAuthModal.tsx`  
**Особенности:**
- Только Email/Password
- Чистый layout
- Переключение Login ↔ Register
- Forgot password link
- Terms & Privacy для регистрации

### 2. CompactSaveAuthModal
**Использование:** SAVE_EVENT, SAVE_ROUTE  
**Файл:** `src/components/auth/CompactSaveAuthModal.tsx`  
**Особенности:**
- Только Email/Password
- Максимально компактный
- Контекстные заголовки
- Для high-intent save scenarios

### 3. SiteAuthModal (Legacy)
**Использование:** MY_PLAN, другие legacy flows  
**Файл:** `src/components/auth/SiteAuthModal.tsx`  
**Особенности:**
- Phone + Email auth
- SMS/OTP verification
- Полный feature set
- Остаётся для совместимости

---

## DefaultAuthModal - Детали

### Props

```typescript
interface DefaultAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;
  subtitle: string;
  dialogTitle?: string;
  onAuthSuccess?: () => void;
}
```

### UI Structure

```
┌────────────────────────────────┐
│  [X]                           │
│                                │
│  Вход в mamaGo                 │
│  Планируйте лучшее время       │
│  с детьми                      │
│                                │
│  ┌──────────┬────────────────┐ │
│  │ Войти    │ Регистрация    │ │
│  └──────────┴────────────────┘ │
│                                │
│  ┌──────────────────────────┐  │
│  │ Email                    │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ Пароль            [👁]   │  │
│  └──────────────────────────┘  │
│                                │
│  [Регистрация: +Повторите]     │
│                                │
│  [Login: Забыли пароль?]       │
│                                │
│  ┌──────────────────────────┐  │
│  │ Войти / Создать аккаунт  │  │
│  └──────────────────────────┘  │
│                                │
│  [Register: Terms & Privacy]   │
└────────────────────────────────┘
```

### Ключевые улучшения

#### 1. Чистая визуальная иерархия

**Было (SiteAuthModal):**
- Phone form
- Разделитель "или"
- Email form
- Всё на одном уровне
- Визуальный хаос

**Стало (DefaultAuthModal):**
- Заголовок + подзаголовок
- Toggle Login/Register
- Email + Password
- Один главный CTA
- Чистая структура

#### 2. Убраны лишние блоки

**Удалено:**
- ❌ PhoneLoginForm
- ❌ SMS/OTP verification state
- ❌ Разделитель "или"
- ❌ Shared phone state
- ❌ Phone verification banner
- ❌ Условный рендеринг email формы

**Оставлено:**
- ✅ Email/Password auth
- ✅ Login/Register toggle
- ✅ Password visibility toggle
- ✅ Forgot password link
- ✅ Terms & Privacy

#### 3. Улучшенный spacing

```typescript
// Padding
p-6 sm:p-7  // Комфортный, не перегруженный

// Spacing между элементами
space-y-5   // Header sections
space-y-3.5 // Form fields

// Input height
h-12        // Стандартная высота

// Modal width
max-w-[420px] // Оптимальная ширина
```

#### 4. Улучшенная типографика

```typescript
// Title
text-xl font-semibold

// Subtitle
text-sm text-neutral-500 leading-relaxed

// Toggle buttons
text-sm font-medium

// Error messages
text-sm text-red-600 in bg-red-50 box
```

#### 5. Улучшенные состояния

**Password match indicator:**
```typescript
{confirmNonEmpty && (
  <p className={passwordsMatch ? "text-emerald-600" : "text-red-500"}>
    {passwordsMatch ? "✓ Пароли совпадают" : "✗ Пароли не совпадают"}
  </p>
)}
```

**Error display:**
```typescript
<div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
  <p className="text-sm text-red-600">{error}</p>
</div>
```

**Loading state:**
```typescript
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## Интеграция

### HeaderAccountMenu

**Было:**
```typescript
import { SiteAuthModal } from "@/components/auth/SiteAuthModal";

<SiteAuthModal
  open={guestAuthOpen}
  onOpenChange={setGuestAuthOpen}
  nextHref={pathname || "/"}
  dialogTitle="Вход в mamaGo"
  title="Вход в mamaGo"
  subtitle="Планируйте лучшее время с детьми"
  onAuthSuccess={() => {
    setGuestAuthOpen(false);
    notifyAuthStateChanged();
    router.refresh();
  }}
/>
```

**Стало:**
```typescript
import { DefaultAuthModal } from "@/components/auth/DefaultAuthModal";

<DefaultAuthModal
  open={guestAuthOpen}
  onOpenChange={setGuestAuthOpen}
  nextHref={pathname || "/"}
  dialogTitle="Вход в mamaGo"
  title="Вход в mamaGo"
  subtitle="Планируйте лучшее время с детьми"
  onAuthSuccess={() => {
    setGuestAuthOpen(false);
    notifyAuthStateChanged();
    router.refresh();
  }}
/>
```

---

## Что сохранено

### ✅ Core Auth Logic

**Login:**
```typescript
POST /api/auth/login
{ email, password }
```

**Register:**
```typescript
POST /api/auth/complete-registration
{ email, password }
```

**Post-Auth Flow:**
```typescript
const target = appendBirthdayBuilderAuthParam(nextHref);
notifyAuthStateChanged();
onAuthSuccess?.();
router.replace(target);
router.refresh();
```

### ✅ Validation

- Email validation
- Password length (min 8 chars)
- Password match check
- FormData для browser autofill

### ✅ Error Handling

- Network errors
- Invalid credentials
- Existing account
- Password mismatch

### ✅ Accessibility

- DialogTitle для screen readers
- Proper ARIA labels
- Keyboard navigation
- Focus management

---

## Что НЕ сломано

### ✅ CompactSaveAuthModal

Save scenarios продолжают использовать компактный вариант:

- `SaveEventOnboarding` → `CompactSaveAuthModal` ✅
- `SaveRouteOnboarding` → `CompactSaveAuthModal` ✅

### ✅ SiteAuthModal

Legacy modal остаётся для других сценариев:

- `MyPlanAuthModal` → `SiteAuthModal` ✅
- Birthday Constructor → `SiteAuthModal` (если используется)
- Review Create → `SiteAuthModal` (future SMS)

### ✅ Phone/SMS Infrastructure

- PhoneLoginForm не удалён
- SMS verification остаётся в проекте
- API endpoints не тронуты
- Доступен для future scenarios

---

## Сравнение вариантов

| Аспект | SiteAuthModal | DefaultAuthModal | CompactSaveAuthModal |
|--------|---------------|------------------|----------------------|
| **Использование** | Legacy flows | Account click | Save flows |
| **Phone auth** | ✅ Да | ❌ Нет | ❌ Нет |
| **SMS/OTP** | ✅ Да | ❌ Нет | ❌ Нет |
| **Email/Password** | ✅ Да | ✅ Да | ✅ Да |
| **Forgot password** | ✅ Да | ✅ Да | ❌ Нет |
| **Terms & Privacy** | ✅ Да | ✅ Да | ✅ Да |
| **Layout** | Перегруженный | Чистый | Компактный |
| **Padding** | p-6 sm:p-8 | p-6 sm:p-7 | p-5 sm:p-6 |
| **Max width** | 440px | 420px | 400px |
| **Input height** | h-12 | h-12 | h-11 |
| **Spacing** | space-y-5 | space-y-5 | space-y-3/4 |
| **Контекстные заголовки** | ❌ Нет | ✅ Да | ✅ Да |

---

## User Flow

### Account Click → Login

1. Пользователь кликает на иконку аккаунта в хедере
2. Открывается `DefaultAuthModal`
3. По умолчанию режим "Войти"
4. Вводит email + password
5. Клик "Войти"
6. API call → `POST /api/auth/login`
7. Success → `notifyAuthStateChanged()`
8. Modal закрывается
9. Router refresh
10. Пользователь видит authenticated state

### Account Click → Register

1. Пользователь кликает на иконку аккаунта
2. Открывается `DefaultAuthModal`
3. Переключается на "Регистрация"
4. Вводит email + password + confirm password
5. Видит индикатор совпадения паролей
6. Клик "Создать аккаунт"
7. API call → `POST /api/auth/complete-registration`
8. Success → `notifyAuthStateChanged()`
9. Modal закрывается
10. Router refresh
11. Пользователь видит authenticated state
12. (Optional) Мягкий enrichment prompt через orchestrator

---

## Post-Auth Behavior

После успешного auth через account click:

**Не происходит:**
- ❌ Жёсткий redirect в My Plan
- ❌ Длинный onboarding wizard
- ❌ Принудительное заполнение профиля
- ❌ Resume pending save actions

**Происходит:**
- ✅ Modal закрывается
- ✅ Auth state обновляется
- ✅ Router refresh
- ✅ Пользователь остаётся на текущей странице
- ✅ Header показывает authenticated state
- ✅ (Optional) Мягкие enrichment prompts позже

---

## Analytics (Future)

Можно добавить события:

```typescript
trackAuthEvent("account_auth_opened", {
  variant: "default",
  entryPoint: "HEADER_PROFILE",
});

trackAuthEvent("account_auth_completed", {
  variant: "default",
  authMode: mode, // "login" | "register"
  isNewUser: mode === "register",
});

trackAuthEvent("account_auth_abandoned", {
  variant: "default",
  reason: "user_closed_modal",
});
```

---

## Файлы

### Созданные:
- ✅ `src/components/auth/DefaultAuthModal.tsx` - Новый чистый auth modal

### Изменённые:
- ✅ `src/components/site/header/HeaderAccountMenu.tsx` - Использует DefaultAuthModal

### Не изменённые:
- ✅ `src/components/auth/SiteAuthModal.tsx` - Остаётся для legacy flows
- ✅ `src/components/auth/CompactSaveAuthModal.tsx` - Остаётся для save flows
- ✅ `src/components/auth/MyPlanAuthModal.tsx` - Остаётся для MY_PLAN
- ✅ `src/app/(auth)/login/PhoneLoginForm.tsx` - Не тронут
- ✅ `src/app/(auth)/login/EmailLoginForm.tsx` - Не тронут
- ✅ API endpoints - Не тронуты

---

## Результат

✅ Клик на аккаунт открывает чистый DefaultAuthModal  
✅ Нет phone/SMS перегрузки  
✅ Только email+password  
✅ Чистая визуальная иерархия  
✅ Современный UI  
✅ Forgot password доступен  
✅ Terms & Privacy для регистрации  
✅ Core auth logic переиспользуется  
✅ CompactSaveAuthModal не сломан  
✅ SiteAuthModal остаётся для legacy  
✅ SMS инфраструктура сохранена  

---

## Next Steps

1. **Тестирование:**
   - Account click → login flow
   - Account click → register flow
   - Forgot password link
   - Error states
   - Browser autofill

2. **Analytics:**
   - Добавить tracking для default variant
   - Сравнить conversion rate с SiteAuthModal

3. **UI Polish:**
   - Анимации переходов
   - Loading states
   - Success feedback

4. **Постепенная миграция:**
   - Оценить другие entry points
   - Мигрировать на DefaultAuthModal где уместно
   - Оставить SiteAuthModal только где нужен phone auth

5. **Enrichment Flow:**
   - Добавить мягкие post-registration prompts
   - Интегрировать с orchestrator
   - Не делать агрессивным
