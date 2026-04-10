# Business Registration Context Enhancement

## Summary

Enhanced the registration system to support dynamic business registration context while maintaining a single unified authentication system.

## What Was Implemented

### 1. Dynamic Register Page (`src/app/(public)/register/page.tsx`)

**Changes:**
- Added `searchParams` prop to detect `?from=business` query parameter
- Detects business context: `const isBusiness = searchParams?.from === "business"`
- Dynamic header text:
  - Business: "Создать аккаунт для бизнеса"
  - Regular: "Создать аккаунт"
- Dynamic subtitle:
  - Business: "Зарегистрируйтесь, чтобы управлять вашим бизнесом в mamaGo"
  - Regular: "Присоединяйтесь к mamaGo"
- Passes `isBusiness` prop to RegisterForm

### 2. Enhanced RegisterForm (`src/app/(public)/register/RegisterForm.tsx`)

**Changes:**
- Accepts `isBusiness?: boolean` prop
- Adds hidden input field: `<input type="hidden" name="isBusiness" value={isBusiness ? "true" : "false"} />`
- Passes context to server action via form data

### 3. Updated Register Action (`src/app/(public)/register/actions.ts`)

**Changes:**
- Extracts `isBusiness` flag from formData: `const isBusiness = formData.get("isBusiness") === "true"`
- Conditional redirect after successful registration:
  - If `isBusiness === true` → `redirect("/business/onboarding")`
  - Otherwise → `redirect("/")`

### 4. Business Entry Link (`src/components/shell/PublicHeader.tsx`)

**Changes:**
- Added "Для бизнеса" link in public header
- Link: `/register?from=business`
- Styled as blue text button
- Hidden on mobile (`hidden md:inline-flex`)
- Positioned before search and profile icons

## User Flows

### Flow 1: Regular User Registration
```
1. User visits /register (or clicks register link)
2. Sees: "Создать аккаунт" / "Присоединяйтесь к mamaGo"
3. Fills email + password
4. Submits form
5. Redirects to "/" (homepage)
```

### Flow 2: Business User Registration
```
1. User clicks "Для бизнеса" in header
2. Redirects to /register?from=business
3. Sees: "Создать аккаунт для бизнеса" / "Зарегистрируйтесь, чтобы управлять вашим бизнесом в mamaGo"
4. Fills email + password
5. Submits form
6. Redirects to /business/onboarding (business creation flow)
```

### Flow 3: Direct Business Registration Link
```
1. User visits /register?from=business directly
2. Sees business-specific messaging
3. After registration → /business/onboarding
```

## Technical Details

### Query Parameter Detection
- Uses Next.js App Router `searchParams` prop
- Server-side detection (no client-side JS required)
- Works with static and dynamic rendering

### Form Data Passing
- Hidden input field passes context through form submission
- Server action reads from formData
- No URL manipulation needed during submission

### Redirect Logic
- Single registration endpoint
- Conditional redirect based on context
- No duplicate auth systems
- No role system modifications

## Testing Instructions

### Test 1: Regular Registration
```bash
# Visit regular registration
http://localhost:3000/register

# Expected:
- Title: "Создать аккаунт"
- Subtitle: "Присоединяйтесь к mamaGo"
- After registration → redirects to "/"
```

### Test 2: Business Registration
```bash
# Click "Для бизнеса" in header OR visit directly:
http://localhost:3000/register?from=business

# Expected:
- Title: "Создать аккаунт для бизнеса"
- Subtitle: "Зарегистрируйтесь, чтобы управлять вашим бизнесом в mamaGo"
- After registration → redirects to "/business/onboarding"
```

### Test 3: Business Entry Link
```bash
# Visit any public page
http://localhost:3000/minsk

# Expected:
- Header shows "Для бизнеса" link (desktop only)
- Click link → redirects to /register?from=business
- Shows business registration context
```

### Test 4: Query Parameter Persistence
```bash
# Visit with query parameter
http://localhost:3000/register?from=business

# Refresh page
# Expected: Query parameter persists, business context maintained
```

## Files Modified

1. ✅ `src/app/(public)/register/page.tsx` - Added searchParams detection
2. ✅ `src/app/(public)/register/RegisterForm.tsx` - Added isBusiness prop and hidden input
3. ✅ `src/app/(public)/register/actions.ts` - Added conditional redirect logic
4. ✅ `src/components/shell/PublicHeader.tsx` - Added business entry link

## Design Decisions

### Why Query Parameter Instead of Separate Route?
- Single source of truth for registration
- No code duplication
- Easy to maintain
- SEO-friendly (single /register URL)
- Can add more contexts in future (e.g., ?from=partner)

### Why Hidden Input Instead of URL State?
- Form submission doesn't require JavaScript
- Progressive enhancement
- Simpler state management
- No URL manipulation during submission

### Why Conditional Redirect in Action?
- Server-side logic (secure)
- Single action handler
- Easy to test
- Clear separation of concerns

## Future Enhancements

### Potential Additions
1. **Analytics Tracking**
   - Track business vs regular registrations
   - Conversion funnel analysis

2. **Additional Contexts**
   - `?from=partner` for partner registrations
   - `?from=event` for event-based signups
   - `?from=promo` for promotional campaigns

3. **Pre-fill Data**
   - Accept additional query params (e.g., `?email=...`)
   - Pre-populate form fields

4. **Mobile Business Link**
   - Show "Для бизнеса" in mobile menu
   - Add to footer for better visibility

5. **A/B Testing**
   - Test different messaging
   - Optimize conversion rates

## Security Considerations

✅ No security changes - uses existing auth system
✅ Query parameters are read-only (no user input)
✅ Hidden input is validated server-side
✅ Redirect logic is server-side only
✅ No client-side auth bypasses

## Compatibility

- ✅ Works with existing auth system
- ✅ Compatible with business onboarding flow
- ✅ No breaking changes to existing flows
- ✅ Progressive enhancement (works without JS)
- ✅ Mobile responsive (link hidden on mobile for now)

## Notes

- The "Для бизнеса" link is currently hidden on mobile (`hidden md:inline-flex`)
- Can be added to mobile menu or footer if needed
- Business context is purely for UX - no backend role changes
- All users are created with `role: "USER"` by default
- Business ownership is determined by Business model relationship, not user role
