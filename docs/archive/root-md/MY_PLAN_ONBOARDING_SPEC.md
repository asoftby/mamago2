# My Plan Onboarding - Implementation Spec

## Overview
3-step onboarding flow specifically for "My Plan" entry point with beautiful UX, clear progress, and contextual copy.

## Key Changes

### 1. Remove Confirm Password Everywhere
- Single password field for registration
- Inline validation for password strength
- Simpler, faster UX

### 2. 3-Step Flow for My Plan Registration

**Step 1: Account**
- Email input
- Password input (single field)
- Button: "Далее"

**Step 2: Child**
- Child name input
- Birth month dropdown (1-12)
- Birth year dropdown (last 18 years)
- Button: "Далее"
- Back button

**Step 3: Interests**
- Multi-select from DB (useChildInterests hook)
- Beautiful chip/pill UI
- Button: "Go"
- Skip button
- Back button

### 3. Visual Stepper
Horizontal progress indicator:
```
1. Аккаунт  →  2. Ребенок  →  3. Интересы
   [active]      [pending]      [pending]
```

### 4. Contextual Copy
**Title**: "Сохраните свой план"
**Subtitle**: "Добавьте ребенка, и мы поможем собирать идеи и планы удобнее"

### 5. Flow Logic
- When `withOnboarding={true}` → 3-step flow
- When mode="login" → standard login form
- After completion → return to My Plan context

## Files to Modify

1. `src/components/auth/DefaultAuthModal.tsx` - Main implementation
2. `src/components/MyPlanProvider.tsx` - Update title/subtitle
3. `src/hooks/useChildInterests.ts` - Already exists ✅

## API Integration

**Create Account**: `POST /api/auth/complete-registration`
```json
{ "email": "user@example.com", "password": "password123" }
```

**Create Child**: `POST /api/children`
```json
{
  "name": "Маша",
  "birthDate": "2020-06-15T00:00:00.000Z",
  "systemInterests": ["sports", "art"],
  "customInterests": []
}
```

## UX Requirements

### Visual Design
- Clean, modern, premium feel
- Strong typography hierarchy
- Generous spacing
- Brand color #EF8759 for CTAs
- Smooth transitions between steps

### Progress Indicator
- Always visible during onboarding
- Shows current step clearly
- Shows completed steps
- Shows upcoming steps

### Error Handling
- Inline validation
- Clear error messages
- Helpful suggestions (e.g., "Email already exists" → "Login instead")
- Loading states
- Empty states for interests

### Edge Cases
- User already exists → suggest login
- Network errors → retry option
- Empty interests list → allow skip
- Modal closed mid-flow → reset on reopen
- Switch to login mode → hide stepper

## Success Criteria
- Fast, friendly onboarding
- Clear value proposition
- Minimal friction
- Returns user to My Plan context
- No confirm password field anywhere
