# Business Subdomain Auth Flow Fix

## Summary

Fixed the business subdomain authentication flow to prevent 404 errors and enable cross-subdomain session cookies.

## Problem

1. When redirecting from `business.localhost` to `/login`, it tried to access `business.localhost/login` which doesn't exist (404)
2. Session cookies were not shared across subdomains (localhost vs business.localhost)

## Solution

### 1. Environment Variables (`.env`)

Added configuration for app URL and cookie domain:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_COOKIE_DOMAIN=.localhost
```

**For Production:**
```env
NEXT_PUBLIC_APP_URL=https://mamago.by
NEXT_PUBLIC_COOKIE_DOMAIN=.mamago.by
```

### 2. Business Layout Redirect (`src/app/business/layout.tsx`)

**Changed:**
- Old: `redirect("/login")` → redirects to `business.localhost/login` (404)
- New: `redirect("http://localhost:3000/login?from=business")` → redirects to main domain

**Implementation:**
```typescript
if (!user) {
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL 
    ? `${process.env.NEXT_PUBLIC_APP_URL}/login?from=business`
    : "/login?from=business";
  redirect(loginUrl);
}
```

**Features:**
- Uses absolute URL to redirect to main domain
- Adds `?from=business` query parameter for context
- Fallback to relative URL if env var not set
- Onboarding redirects remain relative (within business subdomain)

### 3. Session Cookie Settings (`src/lib/auth/session.ts`)

**Updated `setSessionCookie()` function:**

```typescript
cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: "lax",
  maxAge: SESSION_DURATION / 1000,
  path: "/",
  ...(cookieDomain && { domain: cookieDomain }),
});
```

**Changes:**
- Added `domain: .localhost` (from env var) to share cookie across subdomains
- Changed `secure` logic: `process.env.NODE_ENV !== "development"` (was `=== "production"`)
- Cookie now accessible on:
  - `localhost:3000`
  - `business.localhost:3000`
  - `admin.localhost:3000`
  - Any other `*.localhost:3000` subdomain

## User Flow (Fixed)

### Scenario 1: Unauthenticated User Visits Business Subdomain

**Before (Broken):**
```
1. Visit: http://business.localhost:3000/
2. Business layout checks auth → not authenticated
3. Redirects to: /login
4. Browser navigates to: http://business.localhost:3000/login
5. Result: 404 (login page doesn't exist on business subdomain)
```

**After (Fixed):**
```
1. Visit: http://business.localhost:3000/
2. Business layout checks auth → not authenticated
3. Redirects to: http://localhost:3000/login?from=business
4. Browser navigates to main domain login page
5. User logs in
6. Cookie set with domain=.localhost (shared across subdomains)
7. Redirect to: http://business.localhost:3000/onboarding (or dashboard)
8. Business layout checks auth → authenticated (cookie accessible)
9. Success!
```

### Scenario 2: User Logs In on Main Domain, Then Visits Business

**Before (Broken):**
```
1. Login at: http://localhost:3000/login
2. Cookie set for: localhost (no domain specified)
3. Visit: http://business.localhost:3000/
4. Cookie NOT accessible (different subdomain)
5. Redirects to login again (infinite loop potential)
```

**After (Fixed):**
```
1. Login at: http://localhost:3000/login
2. Cookie set with domain=.localhost
3. Visit: http://business.localhost:3000/
4. Cookie IS accessible (shared domain)
5. Business layout checks auth → authenticated
6. Success!
```

## Technical Details

### Cookie Domain Behavior

**Without domain attribute:**
- Cookie: `mg_session=abc123` (no domain)
- Accessible on: `localhost:3000` only
- NOT accessible on: `business.localhost:3000`

**With domain=.localhost:**
- Cookie: `mg_session=abc123; domain=.localhost`
- Accessible on: `localhost:3000`, `business.localhost:3000`, `admin.localhost:3000`, etc.
- Leading dot (`.`) makes it available to all subdomains

### Security Considerations

✅ `httpOnly: true` - Prevents JavaScript access (XSS protection)
✅ `secure: true` in production - HTTPS only
✅ `sameSite: "lax"` - CSRF protection
✅ `path: "/"` - Available across entire site
✅ Domain scoped to `.localhost` in dev, `.mamago.by` in production

### Environment-Specific Configuration

**Development:**
- URL: `http://localhost:3000`
- Cookie Domain: `.localhost`
- Secure: `false` (allows HTTP)

**Production:**
- URL: `https://mamago.by`
- Cookie Domain: `.mamago.by`
- Secure: `true` (requires HTTPS)

## Files Modified

1. ✅ `.env` - Added `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_COOKIE_DOMAIN`
2. ✅ `src/app/business/layout.tsx` - Updated login redirect to use absolute URL
3. ✅ `src/lib/auth/session.ts` - Updated cookie settings to support cross-subdomain

## Testing Instructions

### Test 1: Unauthenticated Business Access
```bash
# Clear cookies
# Visit business subdomain
http://business.localhost:3000/

# Expected:
- Redirects to http://localhost:3000/login?from=business
- Shows login page (no 404)
```

### Test 2: Login and Business Access
```bash
# Login at main domain
http://localhost:3000/login
- Email: test@example.com
- Password: password123

# After login, visit business subdomain
http://business.localhost:3000/

# Expected:
- No redirect to login (cookie accessible)
- Shows business onboarding or dashboard
```

### Test 3: Cookie Verification
```bash
# Login at main domain
# Open DevTools → Application → Cookies
# Check cookie: mg_session

# Expected cookie attributes:
- Domain: .localhost
- Path: /
- HttpOnly: ✓
- Secure: (empty in dev)
- SameSite: Lax
```

### Test 4: Cross-Subdomain Session
```bash
# Login at: http://localhost:3000/login
# Visit: http://business.localhost:3000/
# Visit: http://admin.localhost:3000/

# Expected:
- All subdomains recognize the session
- No repeated login prompts
```

### Test 5: Business Registration Flow
```bash
# Click "Для бизнеса" on main site
# Register new account
# Expected:
- After registration, redirects to business.localhost:3000/onboarding
- Cookie accessible on business subdomain
- Onboarding form works
```

## Production Deployment Notes

### Environment Variables

Update `.env.production` or deployment platform:

```env
NEXT_PUBLIC_APP_URL=https://mamago.by
NEXT_PUBLIC_COOKIE_DOMAIN=.mamago.by
```

### DNS Configuration

Ensure wildcard subdomain or specific subdomains are configured:
- `mamago.by` → main app
- `business.mamago.by` → business cabinet
- `admin.mamago.by` → admin panel

### SSL/TLS Certificates

- Wildcard certificate: `*.mamago.by` (covers all subdomains)
- Or individual certificates for each subdomain

### Cookie Security

In production:
- `secure: true` (enforced automatically)
- HTTPS required for all subdomains
- Cookie only transmitted over secure connections

## Troubleshooting

### Issue: Cookie not shared across subdomains

**Check:**
1. `NEXT_PUBLIC_COOKIE_DOMAIN` is set correctly
2. Domain starts with dot: `.localhost` or `.mamago.by`
3. All subdomains use same port in development
4. Clear browser cookies and test again

### Issue: Still getting 404 on business login redirect

**Check:**
1. `NEXT_PUBLIC_APP_URL` is set correctly
2. No trailing slash in URL
3. Restart dev server after changing .env
4. Verify redirect URL in browser network tab

### Issue: Infinite redirect loop

**Check:**
1. Cookie domain is correct
2. Session is being created properly
3. `getCurrentUser()` can read the cookie
4. No middleware blocking cookie access

## Future Enhancements

1. **Session Refresh**
   - Auto-refresh sessions before expiration
   - Sliding window expiration

2. **Multi-Device Sessions**
   - Track active sessions per user
   - Allow users to revoke sessions

3. **Remember Me**
   - Optional longer session duration
   - Separate cookie for "remember me"

4. **Security Headers**
   - Add CSP headers
   - HSTS for production
   - X-Frame-Options

## Notes

- The `?from=business` query parameter preserves context for analytics
- Onboarding redirects remain relative (within business subdomain)
- Cookie domain is optional - only set if env var exists
- Build successful with 37 routes generated
