# User IA Restructure - Plan-Centric Home ✅

## Overview
Restructured the /me area to make Plan the main home for USER role, with clean information architecture and proper redirects.

## New Route Structure

### Canonical Routes
1. `/me` → redirects to `/me/plan`
2. `/me/plan` → User home (main landing page)
3. `/me/ideas` → Saved ideas (empty placeholder)
4. `/me/profile` → Account settings (moved from old /me)

## Implementation Details

### 1. /me/plan (New User Home)
**File**: `src/app/(public)/me/plan/page.tsx`

Features:
- Title: "Мой план"
- Week header placeholder (for future calendar)
- Onboarding card if user has 0 children:
  - "Добавьте ребёнка" heading
  - Reuses existing `AddChildForm` component
  - Explains personalization benefit
- Empty state:
  - "План пока пуст" message
  - "Перейти к событиям" button → `/minsk`
- Uses existing UI primitives: Container, Surface, H1, Body, PrimaryButton

### 2. /me/profile (Moved Content)
**File**: `src/app/(public)/me/profile/page.tsx`

Moved from old `/me` page:
- Email display
- Business link (if applicable)
- Children list with age calculation
- Add child form
- Logout button
- Title changed to "Настройки профиля"

### 3. /me/ideas (Placeholder)
**File**: `src/app/(public)/me/ideas/page.tsx`

Simple placeholder:
- Title: "Сохранённые идеи"
- Empty state: "У вас пока нет сохранённых идей"
- Ready for future Idea model implementation

### 4. /me (Redirect)
**File**: `src/app/(public)/me/page.tsx`

Simple redirect to `/me/plan` - ensures /me always lands on Plan home

## Auth Flow Updates

### Login Redirect Logic
**File**: `src/app/(public)/login/actions.ts`

Updated redirect priority:
1. If `next` param exists → redirect to `next`
2. If `from=business` → redirect to `/business-entry`
3. If user role is `USER` → redirect to `/me/plan` ✨ NEW
4. Otherwise → redirect to `/minsk`

Also added check in login page:
- If already authenticated as USER → redirect to `/me/plan`

### Register Redirect Logic
**File**: `src/app/(public)/register/actions.ts`

Updated redirect priority:
1. If `from=business` → redirect to `/business-entry`
2. If user role is `USER` → redirect to `/me/plan` ✨ NEW
3. Otherwise → redirect to `/minsk`

Also added check in register page:
- If already authenticated as USER → redirect to `/me/plan`

### Revalidation Paths
**File**: `src/app/(public)/me/actions.ts`

Updated `addChildAction` to revalidate:
- `/me/plan` (shows onboarding card based on children count)
- `/me/profile` (shows children list)

## Design Principles

### UI-LAB Rules Followed
✅ Reused existing primitives (Container, Surface, Typography, Button)
✅ No imports from /ui-lab into pages
✅ No one-off styles
✅ Consistent with existing design system

### Minimal Implementation
✅ No Idea/Plan models yet (placeholders only)
✅ Clean, simple layouts
✅ Focused on IA restructure, not feature implementation

## User Experience Flow

### New User Registration
1. Register → `/me/plan`
2. See onboarding card: "Добавьте ребёнка"
3. Fill form, add child
4. Onboarding card disappears
5. See empty plan state with CTA to browse events

### Returning User Login
1. Login → `/me/plan`
2. See their plan (currently empty state)
3. Can navigate to ideas or profile via navigation (future)

### Profile Access
- Users access profile settings via `/me/profile`
- No longer the default landing page
- Focused on account management, not main home

## Files Created
- `src/app/(public)/me/page.tsx` (redirect)
- `src/app/(public)/me/plan/page.tsx` (new home)
- `src/app/(public)/me/ideas/page.tsx` (placeholder)
- `src/app/(public)/me/profile/page.tsx` (moved content)

## Files Modified
- `src/app/(public)/me/actions.ts` (revalidation paths)
- `src/app/(public)/login/actions.ts` (redirect logic)
- `src/app/(public)/login/page.tsx` (auth check)
- `src/app/(public)/register/actions.ts` (redirect logic)
- `src/app/(public)/register/page.tsx` (auth check)

## Verification
✅ TypeScript diagnostics pass (0 errors)
✅ Build succeeds with no warnings
✅ All new routes appear in build output
✅ Redirect logic preserves business flow
✅ Reuses existing components (AddChildForm, LogoutButton)

## Next Steps (Future)
- Add navigation component to switch between /me/plan, /me/ideas, /me/profile
- Implement Plan model and actual plan functionality
- Implement Idea model and saved ideas functionality
- Add week calendar component to /me/plan
- Consider mobile navigation patterns for /me area
