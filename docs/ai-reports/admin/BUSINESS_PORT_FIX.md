# Business Navigation Port Fix

## Problem
The "Для бизнеса" button was sending users to `http://localhost:3001/login?from=business` while the app/session was running on `http://localhost:3000`. This caused the `mg_session` cookie to not be shared across ports, making logged-in users see the login form.

## Solution
Unified the development environment to use a single port (3000) and updated the navigation flow to use a business entry route instead of directly linking to login.

## Changes Made

### 1. Environment Configuration
**File**: `.env`
- Changed `NEXT_PUBLIC_APP_URL` from `http://localhost:3001` to `http://localhost:3000`
- This ensures all server-side redirects use the correct port

### 2. Public Header Navigation
**File**: `src/components/shell/PublicHeader.tsx`
- Changed "Для бизнеса" link from `/login?from=business` to `/business-entry`
- This allows the business entry page to handle authentication logic

### 3. Business Entry Page
**File**: `src/app/business-entry/page.tsx`
- Updated unauthenticated redirect from `/register?from=business` to `/login?from=business`
- Flow now:
  - Logged in + has business → `/business/dashboard`
  - Logged in + no business → `/business/onboarding`
  - Not logged in → `/login?from=business`

### 4. Logout Route
**File**: `src/app/api/auth/logout/route.ts`
- Fixed hardcoded port fallback from `3001` to `3000`
- Now uses `http://localhost:3000` when `NEXT_PUBLIC_APP_URL` is not set

### 5. Middleware
**File**: `src/middleware.ts`
- Removed dynamic port detection logic
- Fixed hardcoded fallback to use `http://localhost:3000`
- Simplified redirect logic for business subdomain auth routes

## User Flow

### Logged Out User
1. User clicks "Для бизнеса" on public site
2. Navigates to `/business-entry`
3. Business entry page detects no authentication
4. Redirects to `/login?from=business`
5. User logs in
6. Login action redirects back to `/business-entry`
7. Business entry page checks for business profile
8. Redirects to `/business/onboarding` or `/business/dashboard`

### Logged In User (No Business)
1. User clicks "Для бизнеса"
2. Navigates to `/business-entry`
3. Business entry page detects authentication
4. Checks for business profile (none found)
5. Redirects to `/business/onboarding`

### Logged In User (Has Business)
1. User clicks "Для бизнеса"
2. Navigates to `/business-entry`
3. Business entry page detects authentication
4. Checks for business profile (found)
5. Redirects to `/business/dashboard`

## Testing

### Development
1. Start dev server: `pnpm dev` (should run on port 3000)
2. Test logged out: Click "Для бизнеса" → should redirect to login
3. Test logged in without business: Click "Для бизнеса" → should go to onboarding
4. Test logged in with business: Click "Для бизнеса" → should go to dashboard

### Verify Session Persistence
1. Log in on `http://localhost:3000`
2. Click "Для бизнеса"
3. Should NOT see login form (session should persist)
4. Should land in business area based on profile status

## Production Considerations

### Environment Variables
Ensure production `.env` has:
```
NEXT_PUBLIC_APP_URL=https://mamago.by
NEXT_PUBLIC_COOKIE_DOMAIN=.mamago.by
```

### Subdomain Setup
- Public: `mamago.by` or `www.mamago.by`
- Business: `business.mamago.by`
- Cookie domain: `.mamago.by` (allows sharing across subdomains)

## Files Modified
1. `.env` - Updated port from 3001 to 3000
2. `src/components/shell/PublicHeader.tsx` - Changed link to `/business-entry`
3. `src/app/business-entry/page.tsx` - Updated redirect for unauthenticated users
4. `src/app/api/auth/logout/route.ts` - Fixed port fallback
5. `src/middleware.ts` - Fixed port fallback and simplified logic

## Build Status
✅ Build successful
✅ No TypeScript errors
✅ All routes compiled correctly
