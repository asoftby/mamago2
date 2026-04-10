# My Plan Onboarding - Full Implementation Architecture

## Overview
Complete MY_PLAN onboarding flow with preview state, value proposition, personalization steps, and first-run experience.

## Key Principles
1. **Preview First**: Don't immediately show auth modal - show value proposition
2. **Value Hook**: "Автогенерация дня для всей семьи"
3. **Progressive Disclosure**: Auth → Child Profile → Preferences (optional)
4. **Meaningful First Experience**: Show generated plan, not empty state
5. **Return to Intent**: Open My Plan after onboarding, not redirect elsewhere

## Architecture Components

### 1. Preview State (Unauthenticated)
**Component**: `MyPlanPreview`
- Shows when unauthenticated user clicks My Plan widget
- Displays value proposition with visual examples
- Shows benefits: персонализация, автогенерация, сохранение идей
- CTA: "Начать планировать" → triggers onboarding

**Visual Elements**:
- Hero section with value hook
- 3-4 benefit cards with icons
- Example plan preview (blurred/demo)
- Clear CTA button

### 2. Onboarding Flow
**Entry Point**: `HEADER_MY_PLAN` (new, separate from HEADER_PROFILE)

**Steps**:
1. **Auth Step** - Email/Password registration
2. **Child Profile Step** - Add first child (name, birth month/year)
3. **Preferences Step** (optional, skippable) - Select interests

**Modal**: `MyPlanOnboardingModal`
- Multi-step wizard
- Progress indicator
- Skip option for preferences
- Clean, focused UI

### 3. Post-Onboarding Experience
**Component**: `MyPlanFirstRun`
- Shows after onboarding completes
- Displays generated plan based on child profile
- Highlights key features
- Smooth transition to normal My Plan state

**Features**:
- Auto-generated recommendations for all 3 slots
- Welcome message with child name
- Quick tips overlay (dismissible)
- Smooth animation

### 4. Orchestrator Integration

**Scenario Registry Update**:
```typescript
[OnboardingEntryPoint.HEADER_MY_PLAN]: {
  entryPoint: OnboardingEntryPoint.HEADER_MY_PLAN,
  title: "Создайте план для вашей семьи",
  subtitle: "Персональные рекомендации под возраст и интересы детей",
  valueProposition: "Автоматически подбираем события на каждый день",
  requiredFields: ["email", "childName", "childBirthDate"],
  optionalFields: ["childInterests"],
  completionStrategy: {
    outcome: OnboardingOutcome.OPEN_MY_PLAN,
    getReturnUrl: () => "/?myPlan=open&firstRun=true"
  },
  deferredPrompts: [],
  analyticsMetadata: { source: "my_plan_widget" }
}
```

**Pending Action**:
```typescript
setPendingOpenPlan({ firstRun: true })
```

### 5. State Management

**MyPlanProvider Updates**:
- Detect preview state: `!isAuthenticated && planOpen`
- Show `MyPlanPreview` instead of auth modal
- Handle `firstRun=true` query param
- Show `MyPlanFirstRun` overlay on first open

**New States**:
- `preview` - Unauthenticated, showing value prop
- `onboarding` - In onboarding flow
- `firstRun` - Just completed onboarding
- `ready` - Normal state

## Implementation Files

### New Files
1. `src/components/my-plan/MyPlanPreview.tsx` - Preview state UI
2. `src/components/onboarding/MyPlanOnboardingModal.tsx` - Onboarding wizard
3. `src/components/my-plan/MyPlanFirstRun.tsx` - First-run experience
4. `src/hooks/useMyPlanOnboarding.ts` - Onboarding hook

### Modified Files
1. `src/components/MyPlanProvider.tsx` - Add preview state logic
2. `src/lib/onboarding/scenarioRegistry.ts` - Add HEADER_MY_PLAN scenario
3. `src/lib/onboarding/types.ts` - Add HEADER_MY_PLAN entry point
4. `src/features/my-plan/components/MyPlanPanelContent.tsx` - Handle firstRun state

## User Flow

### Unauthenticated User
1. Click My Plan widget
2. See preview with value proposition
3. Click "Начать планировать"
4. Enter onboarding flow:
   - Step 1: Email/Password
   - Step 2: Add child (name, birth month/year)
   - Step 3: Select interests (skippable)
5. Complete onboarding
6. See My Plan with generated recommendations
7. See first-run tips overlay (dismissible)

### Authenticated User (No Children)
1. Click My Plan widget
2. Open My Plan directly
3. See empty state with "Add child" prompt
4. Add child through normal flow
5. See recommendations appear

### Authenticated User (With Children)
1. Click My Plan widget
2. Open My Plan directly
3. See recommendations immediately

## Analytics Events

### Preview State
- `my_plan_preview_viewed`
- `my_plan_preview_cta_clicked`
- `my_plan_preview_abandoned`

### Onboarding
- `my_plan_onboarding_started`
- `my_plan_onboarding_step_completed` (step: auth/child/preferences)
- `my_plan_onboarding_step_skipped` (step: preferences)
- `my_plan_onboarding_completed`
- `my_plan_onboarding_abandoned` (step: X)

### First Run
- `my_plan_first_run_viewed`
- `my_plan_first_run_tips_viewed`
- `my_plan_first_run_tips_dismissed`
- `my_plan_first_run_completed`

## Edge Cases

1. **User closes preview** - Track abandonment, don't show again for session
2. **User abandons onboarding** - Save progress, allow resume
3. **Network error during onboarding** - Show error, allow retry
4. **User already has account** - Skip to child step
5. **User closes during first-run** - Mark as completed, don't show again

## Success Metrics

1. **Preview → Onboarding conversion**: % who click CTA
2. **Onboarding completion rate**: % who complete all steps
3. **Time to first plan**: Time from widget click to seeing recommendations
4. **First-run engagement**: % who interact with generated plan
5. **Retention**: % who return to My Plan within 7 days

## Next Steps

1. Create preview component with value proposition
2. Create onboarding modal with multi-step wizard
3. Update orchestrator with MY_PLAN scenario
4. Create first-run experience component
5. Update MyPlanProvider with state logic
6. Add analytics tracking
7. Test full flow end-to-end
