# Profile Icon Redirect Flicker Fix

## Problem
When clicking the profile icon, users briefly saw the regular user profile page before being redirected to the business dashboard (for BUSINESS_OWNER role). This created a visible flicker and felt like a bug.

## Solution
Implemented server-side role-based routing through a universal account entry route that performs redirects BEFORE rendering any UI.

## Changes Made

### 1. Created Universal Account Entry Route
**File:** `src/app/account/page.tsx`

- Server-side page that detects user role using `getCurrentUser()`
- Performs instant redirects based on role:
  - Not logged in → `/login`
  - ADMIN → `/admin`
  - BUSINESS_OWNER → `/business`
  - USER → `/me`
- Zero client-side rendering = zero flicker

### 2. Updated Desktop Header Profile Icon
**File:** `src/components/site/header/SiteHeader.desktop.tsx`

Changed profile icon link from:
```tsx
href="/me/profile"
```

To:
```tsx
href="/account"
```

### 3. Updated Mobile Bottom Navigation Profile Icon
**File:** `src/components/mobile/MobileBottomNav.tsx`

Changed profile navigation item from:
```tsx
href: "/me/profile"
```

To:
```tsx
href: "/account"
```

Also updated `isActive` logic to highlight the profile icon when on business or admin pages:
```tsx
isActive: pathname.startsWith("/me/profile") || pathname.startsWith("/business") || pathname.startsWith("/admin")
```

## How It Works

### Before (with flicker):
1. User clicks profile icon
2. Browser navigates to `/me/profile`
3. Page renders
4. Client-side useEffect detects BUSINESS_OWNER role
5. Client-side redirect to `/business`
6. **Visible flicker during steps 3-5**

### After (no flicker):
1. User clicks profile icon
2. Browser navigates to `/account`
3. Server detects role and redirects BEFORE rendering
4. User lands directly on correct dashboard
5. **Zero flicker - instant redirect**

## Benefits

1. **No Flicker:** Server-side redirect happens before any UI renders
2. **Universal Entry Point:** Single route handles all role-based routing
3. **Clean Architecture:** Separation of concerns - routing logic in one place
4. **Better UX:** Feels instant and professional
5. **No Auth Changes:** Uses existing `getCurrentUser()` utility
6. **Future-Proof:** Easy to add new roles or routing logic

## Testing

To test the fix:

1. **As Regular User:**
   - Click profile icon → Should go directly to `/me`

2. **As Business Owner:**
   - Click profile icon → Should go directly to `/business` (no flicker)

3. **As Admin:**
   - Click profile icon → Should go directly to `/admin`

4. **Not Logged In:**
   - Click profile icon → Should redirect to `/login`

## Technical Details

- Uses Next.js 13+ App Router server components
- Leverages `redirect()` from `next/navigation` for server-side redirects
- No client-side JavaScript needed for routing
- Works on both desktop and mobile
- Maintains active state highlighting in mobile bottom nav
