# Unified Auth Modal - Правильная архитектура

## Проблема текущей реализации
Сейчас создается впечатление двух разных модалок:
- Одна для обычной auth
- Другая для My Plan onboarding

## Правильный подход

### Единый Auth Modal Shell
```
┌─────────────────────────────────┐
│  [X]  Единая Auth Modal         │
│                                 │
│  ┌─────────┬─────────┐         │
│  │ Войти   │ Регистр │ ← Единый toggle │
│  └─────────┴─────────┘         │
│                                 │
│  [Контент зависит от mode]     │
│                                 │
│  • Login mode = всегда один    │
│  • Register mode:              │
│    - default = простая форма   │
│    - my-plan = 3 шага          │
│                                 │
└─────────────────────────────────┘
```

### Логика
1. **Единый shell** - одна модалка для всех
2. **Единый toggle** - Войти/Регистрация везде одинаковый
3. **Login mode** - всегда одинаковый
4. **Register mode** - адаптивный:
   - `withOnboarding=false` → простая форма (email + password)
   - `withOnboarding=true` → 3 шага (auth → child → interests)

### Ключевые принципы
- ✅ Один компонент
- ✅ Один layout
- ✅ Один visual style
- ✅ Условная логика ВНУТРИ registration mode
- ❌ НЕ отдельная модалка
- ❌ НЕ отдельный UI паттерн
- ❌ НЕ разные компоненты

## Реализация

### Props
```typescript
interface DefaultAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextHref: string;
  title: string;
  subtitle: string;
  withOnboarding?: boolean; // Включить 3-step для registration
  isMobile?: boolean;
}
```

### State
```typescript
const [mode, setMode] = useState<Mode>("login");
const [step, setStep] = useState<Step>("auth"); // Только для registration
```

### Render Logic
```typescript
// Единый shell
<Dialog>
  <DialogContent>
    {/* Единый header */}
    <Header title={title} subtitle={subtitle} />
    
    {/* Единый toggle */}
    <ModeToggle mode={mode} setMode={setMode} />
    
    {/* Контент зависит от mode */}
    {mode === "login" && <LoginForm />}
    
    {mode === "register" && (
      withOnboarding ? (
        // 3-step flow ВНУТРИ той же формы
        <>
          {step === "auth" && <StepperProgress />}
          {step === "auth" && <AuthStep />}
          {step === "child" && <ChildStep />}
          {step === "interests" && <InterestsStep />}
        </>
      ) : (
        // Простая регистрация
        <SimpleRegisterForm />
      )
    )}
  </DialogContent>
</Dialog>
```

## Изменения

### 1. Убрать confirm password везде
- В простой регистрации
- В 3-step регистрации
- Только email + password

### 2. Единый visual shell
- Одинаковый padding
- Одинаковый border-radius
- Одинаковые тени
- Одинаковый spacing

### 3. Stepper только для my-plan registration
- Показывать только когда `withOnboarding=true` и `mode="register"`
- Встроить аккуратно в существующий layout
- Не ломать общую структуру

### 4. Адаптивные тексты
- Title/subtitle можно менять через props
- Но структура модалки остается единой
