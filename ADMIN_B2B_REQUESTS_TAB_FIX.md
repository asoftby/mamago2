# Admin B2B Requests Tab Navigation Fix

**Date:** March 3, 2026  
**Status:** ✅ Complete

---

## 🐛 Problem

Tab navigation in the B2B Requests page was incorrectly navigating to a different route:

### Before (Broken)
- User on: `/admin/b2b/requests`
- Clicks "Одобрено" tab
- URL changes to: `/admin/business/verification?status=APPROVED` ❌
- Wrong route, breaks navigation consistency

### After (Fixed)
- User on: `/admin/b2b/requests`
- Clicks "Одобрено" tab
- URL stays: `/admin/b2b/requests?status=APPROVED` ✅
- Correct route, smooth tab switching

---

## ✅ Solution

### 1. Fixed Tab Navigation Logic

**File:** `src/app/admin/business/verification/BusinessVerificationList.tsx`

**Changes:**
- Added `usePathname()` hook to get current path
- Updated `handleStatusChange()` to use current pathname instead of hardcoded route
- Changed `router.push()` to `router.replace()` with `scroll: false` for smooth transitions

**Before:**
```typescript
const handleStatusChange = (status: string) => {
  setActiveStatus(status);
  router.push(`/admin/business/verification?status=${status}`);
};
```

**After:**
```typescript
const pathname = usePathname();

const handleStatusChange = (status: string) => {
  setActiveStatus(status);
  // Stay on current path, only change query param
  router.replace(`${pathname}?status=${status}`, { scroll: false });
};
```

### 2. Added Legacy Route Redirect

**File:** `src/app/admin/business/verification/page.tsx` (new)

Created a redirect page for backward compatibility:
- Old route: `/admin/business/verification?status=X`
- Redirects to: `/admin/b2b/requests?status=X`
- Maintains any existing bookmarks or links

---

## 🔗 Route Behavior

### Canonical Route
`/admin/b2b/requests` - Business verification queue

### Query Parameters
- `?status=PENDING` - На проверке (default)
- `?status=APPROVED` - Одобрено
- `?status=REJECTED` - Отклонено
- `?status=DRAFT` - Черновик

### Tab Switching
- Tabs stay on `/admin/b2b/requests`
- Only query parameter changes
- No full page reload
- Smooth, instant transitions
- Active tab styling works correctly

### Deep Linking
All these URLs work correctly:
- `/admin/b2b/requests` → Shows PENDING tab
- `/admin/b2b/requests?status=APPROVED` → Shows APPROVED tab
- `/admin/b2b/requests?status=REJECTED` → Shows REJECTED tab
- `/admin/b2b/requests?status=DRAFT` → Shows DRAFT tab

### Legacy Route Redirect
- `/admin/business/verification` → `/admin/b2b/requests`
- `/admin/business/verification?status=APPROVED` → `/admin/b2b/requests?status=APPROVED`
- Maintains backward compatibility

---

## 📁 Files Changed

### Modified
1. **`src/app/admin/business/verification/BusinessVerificationList.tsx`**
   - Added `usePathname()` import
   - Updated `handleStatusChange()` to use current pathname
   - Changed `router.push()` to `router.replace()` with `scroll: false`

### Created
2. **`src/app/admin/business/verification/page.tsx`**
   - Legacy route redirect
   - Redirects to `/admin/b2b/requests` with same status param

---

## ✅ Verification

### Tab Navigation
- [x] Clicking "На проверке" stays on `/admin/b2b/requests?status=PENDING`
- [x] Clicking "Одобрено" stays on `/admin/b2b/requests?status=APPROVED`
- [x] Clicking "Отклонено" stays on `/admin/b2b/requests?status=REJECTED`
- [x] Clicking "Черновик" stays on `/admin/b2b/requests?status=DRAFT`

### UI Behavior
- [x] No full page reload when switching tabs
- [x] Active tab styling works correctly
- [x] Table content updates based on status
- [x] Empty state messages work ("Нет бизнесов со статусом...")
- [x] Loading states work correctly

### Deep Linking
- [x] `/admin/b2b/requests` opens with PENDING tab active
- [x] `/admin/b2b/requests?status=APPROVED` opens with APPROVED tab active
- [x] `/admin/b2b/requests?status=REJECTED` opens with REJECTED tab active
- [x] `/admin/b2b/requests?status=DRAFT` opens with DRAFT tab active

### Legacy Route
- [x] `/admin/business/verification` redirects to `/admin/b2b/requests`
- [x] `/admin/business/verification?status=X` redirects to `/admin/b2b/requests?status=X`

### Build
- [x] Build passes: `pnpm build` (3.7s)
- [x] TypeScript check passes
- [x] No diagnostics errors

---

## 🎯 Benefits

### Before Fix
- ❌ Inconsistent routing (switches between two different paths)
- ❌ Confusing URL changes
- ❌ Breaks navigation expectations
- ❌ Full page reloads on tab switch

### After Fix
- ✅ Consistent routing (stays on one path)
- ✅ Clean URL structure
- ✅ Predictable navigation
- ✅ Smooth tab transitions (no reload)
- ✅ Backward compatibility maintained

---

## 🔧 Technical Details

### Router.replace() vs Router.push()
- `router.replace()` - Updates URL without adding to history stack
- `scroll: false` - Prevents scroll to top on navigation
- Perfect for tab switching within same page

### usePathname() Hook
- Returns current pathname without query params
- Allows component to work on any route
- Makes component reusable

### Shallow Navigation
- Only query params change
- No server-side re-render
- Client-side state preserved
- Instant transitions

---

## 📝 Testing Notes

### How to Test

1. **Navigate to B2B Requests**
   - Go to `/admin/b2b/requests`
   - Should show "На проверке" tab active by default

2. **Switch Tabs**
   - Click "Одобрено" tab
   - URL should change to `/admin/b2b/requests?status=APPROVED`
   - Page should NOT reload
   - Table should update to show approved businesses

3. **Test All Tabs**
   - Click each tab: На проверке, Одобрено, Отклонено, Черновик
   - URL should always stay on `/admin/b2b/requests`
   - Only `?status=X` parameter should change

4. **Test Deep Links**
   - Open `/admin/b2b/requests?status=APPROVED` in new tab
   - Should show "Одобрено" tab as active
   - Should show approved businesses

5. **Test Legacy Route**
   - Navigate to `/admin/business/verification`
   - Should redirect to `/admin/b2b/requests`
   - Try `/admin/business/verification?status=APPROVED`
   - Should redirect to `/admin/b2b/requests?status=APPROVED`

---

## 🚀 Future Enhancements

- [ ] Add URL state for search/filters
- [ ] Add pagination with URL params
- [ ] Add sorting with URL params
- [ ] Preserve scroll position on tab switch

---

**Fixed By:** Tab navigation refactoring  
**Date:** March 3, 2026  
**Status:** ✅ Complete and Verified
