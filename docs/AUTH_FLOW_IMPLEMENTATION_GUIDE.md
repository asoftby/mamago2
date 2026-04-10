# Auth Flow Implementation Guide

## Status: ✅ Core Implementation Complete

This document describes the dynamic auth + onboarding flow system for mamaGo.

## What's Been Built

### Architecture
- ✅ Clean separation: model / logic / UI
- ✅ Single orchestration layer (no duplication)
- ✅ Intent survives login/register/verify
- ✅ Context-aware behavior per entry point

### Core Components

#### Model Layer (`src/features/auth-flow/model/`)
- ✅ `types.ts` - All TypeScript types
- ✅ `auth-flow-store.ts` - Zustand store (single source of truth)
- ✅ `resolvers.ts` - Business logic for onboarding needs

#### Logic Layer (`src/features/auth-flow/lib/`)
- ✅ `post-auth-resolver.ts` - Post-auth orchestration
- ✅ `save-flow-handler.ts` - Save event logic with date picker
- ✅ `auth-modal-content.ts` - Dynamic modal texts

#### UI Layer (`src/features/auth-flow/ui/`)
- ✅ `AuthFlowOrchestrator.tsx` - Main orchestrator component
- ✅ `AuthModal.tsx` - Auth modal with dynamic content
- ✅ `OnboardingFlow.tsx` - Multi-step onboarding with modes
- ✅ `SaveDatePickerModal.tsx` - Date picker for save flow
- ✅ `DeferredOnboardingPrompt.tsx` - Soft onboarding offer
- ✅ `PostAuthResolver.tsx` - Post-auth logic component

#### Hooks (`src/features/auth-flow/hooks/`)
- ✅ `useAuthFlow.ts` - Entry point hooks
  - `useProfileAuth()`
  - `usePlanAuth()`
  - `useSaveEventAuth()`

#### API Endpoints
- ✅ `POST /api/user/onboarding` - Save onboarding data
- ✅ `POST /api/user/plan/items` - Add to plan
- ✅ `GET /api/user/plan/items` - Get plan items
- ✅ `POST /api/user/ideas` - Add to ideas
- ✅ `GET /api/user/ideas` - Get ideas

## Integration Steps

### 1. Add Orchestrator to Root Layout

```tsx
// app/layout.tsx or app/(root)/layout.tsx
import { AuthFlowOrchestrator } from "@/features/auth-flow";
import { getCurrentUser } from "@/lib/auth"; // Your auth logic

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html>
      <body>
        {children}
        <AuthFlowOrchestrator user={user} />
      </body>
    </html>
  );
}
```

### 2. Integrate Profile Entry Point

```tsx
// components/header/ProfileIcon.tsx
import { useProfileAuth } from "@/features/auth-flow";

export function ProfileIcon() {
  const { openProfileAuth } = useProfileAuth();
  const { data: session } = useSession(); // Or your auth hook

  const handleClick = () => {
    if (!session) {
      openProfileAuth();
    } else {
      // Go to profile
      router.push("/profile");
    }
  };

  return (
    <button onClick={handleClick}>
      <UserIcon />
    </button>
  );
}
```

### 3. Integrate Plan Entry Point

```tsx
// components/plan/MyPlanButton.tsx
import { usePlanAuth } from "@/features/auth-flow";

export function MyPlanButton({ selectedDate }: { selectedDate?: string }) {
  const { openPlanAuth } = usePlanAuth();
  const { data: session } = useSession();

  const handleClick = () => {
    if (!session) {
      openPlanAuth(selectedDate);
    } else {
      router.push(selectedDate ? `/plan?date=${selectedDate}` : "/plan");
    }
  };

  return (
    <button onClick={handleClick}>
      Мой план
    </button>
  );
}
```

### 4. Integrate Save Event Entry Point

```tsx
// components/activity/SaveButton.tsx
import { useSaveEventAuth } from "@/features/auth-flow";

export function SaveButton({ 
  entityType, 
  entityId, 
  selectedDate 
}: {
  entityType: "activity" | "offer" | "route" | "article";
  entityId: string;
  selectedDate?: string;
}) {
  const { openSaveEventAuth } = useSaveEventAuth();
  const { data: session } = useSession();

  const handleSave = () => {
    if (!session) {
      openSaveEventAuth(entityType, entityId, selectedDate);
    } else {
      // Direct save logic
      saveEntity(entityType, entityId, selectedDate);
    }
  };

  return (
    <button onClick={handleSave}>
      <HeartIcon />
    </button>
  );
}
```

## What Still Needs Integration

### 1. Auth Forms Integration
The `AuthModal` component currently shows a placeholder. You need to integrate your existing auth forms:

```tsx
// src/features/auth-flow/ui/AuthModal.tsx
// Replace placeholder with:
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";

// Inside AuthModal:
<div className="space-y-4">
  <LoginForm onSuccess={() => setStep("post_auth_resolve")} />
  {/* Or show register form based on tab/state */}
</div>
```

### 2. Toast Notifications
Add toast notifications for save actions:

```tsx
// In AuthFlowOrchestrator.tsx
import { toast } from "@/components/ui/use-toast";

// Replace console.log with:
toast({
  title: "Успешно",
  description: result.message,
});
```

### 3. User Session Hook
Update to use your actual session hook:

```tsx
// Currently using placeholder getCurrentUser()
// Replace with your actual auth logic
import { useSession } from "next-auth/react";
// or
import { useUser } from "@/hooks/useUser";
```

### 4. Business Onboarding
The business onboarding flow is basic. You may want to:
- Create separate Business model entry
- Add more business-specific fields
- Integrate with your business verification flow

### 5. Calendar Component
The `SaveDatePickerModal` uses `@/components/ui/calendar`. Ensure you have this component or replace with your date picker.

## Testing Checklist

### Profile Entry
- [ ] Click profile icon (not logged in)
- [ ] See "Войдите в аккаунт" modal
- [ ] Login successfully
- [ ] See soft onboarding (can skip)
- [ ] Complete or skip onboarding
- [ ] Land on profile page

### Plan Entry
- [ ] Click "Мой план" (not logged in)
- [ ] See "Сохраните свой план" modal
- [ ] Login successfully
- [ ] See required onboarding (2-4 steps)
- [ ] Cannot skip onboarding
- [ ] Complete onboarding
- [ ] Land on plan page (with date if provided)

### Save Event Entry
- [ ] Click heart on activity (not logged in)
- [ ] See "Сохраните это событие" modal
- [ ] Login successfully
- [ ] See date picker (if entity has dates)
- [ ] Select date and add to plan
- [ ] See "Настроить профиль?" prompt
- [ ] Accept or decline onboarding
- [ ] Event is saved

### Save Event (No Dates)
- [ ] Click heart on article (not logged in)
- [ ] Login successfully
- [ ] Article saved to ideas immediately
- [ ] See deferred onboarding prompt
- [ ] Can decline

### Business User
- [ ] Select "Я представляю бизнес" in onboarding
- [ ] See business-specific steps (no child/interests)
- [ ] Complete business onboarding
- [ ] Land on intended destination

## Key Principles Implemented

1. ✅ **Intent Survives**: Intent preserved through auth steps
2. ✅ **No Blocking**: Save flow completes before onboarding
3. ✅ **Context-Aware**: Different behavior per entry point
4. ✅ **Single Orchestration**: One layer handles all transitions
5. ✅ **Continuity**: User never loses original action
6. ✅ **Clean Architecture**: Clear model/logic/UI separation

## File Structure

```
src/features/auth-flow/
├── index.ts                    # Public exports
├── README.md                   # Feature documentation
├── model/
│   ├── types.ts               # TypeScript types
│   ├── auth-flow-store.ts     # Zustand store
│   └── resolvers.ts           # Business logic
├── lib/
│   ├── post-auth-resolver.ts  # Post-auth orchestration
│   ├── save-flow-handler.ts   # Save flow logic
│   └── auth-modal-content.ts  # Dynamic texts
├── ui/
│   ├── AuthFlowOrchestrator.tsx      # Main orchestrator
│   ├── AuthModal.tsx                 # Auth modal
│   ├── OnboardingFlow.tsx            # Multi-step onboarding
│   ├── SaveDatePickerModal.tsx       # Date picker
│   ├── DeferredOnboardingPrompt.tsx  # Soft prompt
│   └── PostAuthResolver.tsx          # Post-auth logic
└── hooks/
    └── useAuthFlow.ts         # Entry point hooks

src/app/api/user/
├── onboarding/route.ts        # Onboarding endpoint
├── plan/items/route.ts        # Plan items endpoint
└── ideas/route.ts             # Ideas endpoint
```

## Next Steps

1. **Integrate Auth Forms**: Replace AuthModal placeholder with real forms
2. **Add Toast Notifications**: Replace console.log with toast
3. **Test All Flows**: Run through all 3 entry points
4. **Add Error Handling**: Improve error states and messages
5. **Add Loading States**: Show loading during API calls
6. **Persist Intent**: Add localStorage persistence if needed
7. **Analytics**: Track flow completion rates
8. **A/B Testing**: Test different onboarding modes

## Notes

- All components are client-side ("use client")
- Store uses Zustand for state management
- API endpoints use NextAuth for session management
- Onboarding steps are dynamic based on user state
- Business users get different onboarding flow
- Save flow handles both dated and non-dated entities
- Deferred onboarding doesn't block save action

## Support

For questions or issues:
1. Check README.md in `src/features/auth-flow/`
2. Review type definitions in `model/types.ts`
3. Trace flow in `AuthFlowOrchestrator.tsx`
4. Check resolvers in `lib/post-auth-resolver.ts`
