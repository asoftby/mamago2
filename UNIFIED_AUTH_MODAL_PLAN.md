# План объединения форм регистрации

## Цель
Объединить DefaultAuthModal и MyPlanOnboardingModal в единую форму с опциональными шагами онбординга.

## Текущее состояние
- **DefaultAuthModal**: единая форма входа/регистрации
- **MyPlanOnboardingModal**: пошаговая форма (auth → child → interests)

## Новая структура

### DefaultAuthModal (обновленный)
Добавить поддержку шагов онбординга через новые пропсы:

```typescript
interface DefaultAuthModalProps {
  // Существующие пропсы
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;
  subtitle: string;
  dialogTitle?: string;
  onAuthSuccess?: () => void;
  
  // Новые пропсы для онбординга
  withOnboarding?: boolean; // Включить шаги после регистрации
  onboardingConfig?: {
    skipChildStep?: boolean; // Пропустить шаг добавления ребенка
    skipInterestsStep?: boolean; // Пропустить шаг интересов
  };
}
```

### Шаги (steps)
1. **auth** - форма входа/регистрации (всегда)
2. **child** - добавление ребенка (только если `withOnboarding=true` и регистрация)
3. **interests** - выбор интересов (только если `withOnboarding=true` и регистрация)

### Логика работы

#### Обычная регистрация (withOnboarding=false)
1. Показываем форму auth
2. После успешной регистрации → редирект на nextHref
3. Закрываем модалку

#### Регистрация через Мой план (withOnboarding=true)
1. Показываем форму auth
2. После успешной регистрации → переход на шаг child
3. После добавления ребенка → переход на шаг interests
4. После выбора интересов → редирект на nextHref
5. Закрываем модалку

#### Вход (login)
1. Показываем форму auth
2. После успешного входа → редирект на nextHref
3. Закрываем модалку (шаги онбординга не показываются)

## Изменения в коде

### 1. Добавить state для шагов
```typescript
type Step = "auth" | "child" | "interests";
const [step, setStep] = useState<Step>("auth");
const [userId, setUserId] = useState<string | null>(null);
```

### 2. Добавить stepper UI
Показывать индикатор шагов только когда `withOnboarding=true` и `step !== "auth"`

### 3. Обновить handleSubmit
После успешной регистрации:
- Если `withOnboarding=true` → сохранить userId и перейти на шаг "child"
- Если `withOnboarding=false` → редирект как обычно

### 4. Добавить компоненты шагов
- ChildStep (из MyPlanOnboardingModal)
- InterestsStep (из MyPlanOnboardingModal)

### 5. Обновить использование
```typescript
// Обычная регистрация
<DefaultAuthModal
  open={open}
  onOpenChange={setOpen}
  nextHref="/dashboard"
  title="Вход в mamaGo"
  subtitle="Планируйте лучшее время с детьми"
/>

// Регистрация через Мой план
<DefaultAuthModal
  open={open}
  onOpenChange={setOpen}
  nextHref="/my-plan"
  title="Вход в mamaGo"
  subtitle="Планируйте лучшее время с детьми"
  withOnboarding={true}
/>
```

## Файлы для изменения
1. `src/components/auth/DefaultAuthModal.tsx` - основные изменения
2. `src/hooks/useMyPlanOnboarding.ts` - обновить использование
3. `src/components/MyPlanProvider.tsx` - заменить MyPlanOnboardingModal на DefaultAuthModal

## Файлы для удаления (после миграции)
- `src/components/onboarding/MyPlanOnboardingModal.tsx`
