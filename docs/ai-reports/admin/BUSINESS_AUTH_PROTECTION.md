# Business Layout Authentication & Onboarding Protection

## Overview
Implemented authentication and onboarding gating for all `/business/*` routes using server-side checks in the layout component.

## Implementation

### 1. Created Business Helper (`src/server/business/getMyBusiness.ts`)

**Purpose:** Fetch the Business record for the current user (one business per owner for MVP)

```typescript
export async function getMyBusiness(userId: string): Promise<Business | null>
```

**Logic:**
- Queries `prisma.business.findUnique` where `ownerUserId = userId`
- Returns `Business | null`
- Uses unique constraint (one business per owner)

### 2. Updated Business Layout (`src/app/business/layout.tsx`)

**Added Authentication & Onboarding Gates:**

#### Step 1: Authentication Check
```typescript
const user = await getCurrentUser();
if (!user) {
  redirect("/login");
}
```
- Checks if user is authenticated
- Redirects to `/login` if not authenticated
- Uses existing `getCurrentUser()` helper

#### Step 2: Onboarding Gate
```typescript
const business = await getMyBusiness(user.id);
if (!business && pathname !== "/business/onboarding") {
  redirect("/onboarding");
}
```
- Checks if Business record exists for user
- Allows access to `/onboarding` page without Business
- Redirects to `/onboarding` if no Business exists
- Prevents access to other business routes until onboarding complete

#### Step 3: UI Enhancements
- Added user email display in header
- Added logout button (POST to `/api/auth/logout`)
- Shows current user context

### 3. Created Onboarding Page (`src/app/business/onboarding/page.tsx`)

**Features:**
- ✅ Authentication check (redirects to login if not authenticated)
- ✅ Displays current user info (email, role, user ID)
- ✅ Shows onboarding steps preview
- ✅ Placeholder "Create Business" button (disabled)
- ✅ Clear messaging about next phase implementation

**Debug Info Displayed:**
- User email
- User role
- User ID (for debugging)

**Next Steps Preview:**
1. Creating Business profile
2. Adding first Place
3. Setting up first Offer

## Authentication Flow

### Scenario 1: Unauthenticated User
```
User visits: business.localhost:3000/
↓
Layout checks: getCurrentUser() → null
↓
Redirect to: /login
```

### Scenario 2: Authenticated User, No Business
```
User visits: business.localhost:3000/
↓
Layout checks: getCurrentUser() → User
↓
Layout checks: getMyBusiness(user.id) → null
↓
Pathname check: "/" !== "/business/onboarding"
↓
Redirect to: /onboarding
```

### Scenario 3: Authenticated User, Has Business
```
User visits: business.localhost:3000/
↓
Layout checks: getCurrentUser() → User
↓
Layout checks: getMyBusiness(user.id) → Business
↓
Render: Dashboard (normal flow)
```

### Scenario 4: Onboarding Page Access
```
User visits: business.localhost:3000/onboarding
↓
Layout checks: getCurrentUser() → User
↓
Layout checks: getMyBusiness(user.id) → null
↓
Pathname check: "/business/onboarding" === "/business/onboarding"
↓
Render: Onboarding page (allowed without Business)
```

## Files Created/Modified

### Created:
- `src/server/business/getMyBusiness.ts` - Business lookup helper
- `src/app/business/onboarding/page.tsx` - Onboarding stub page

### Modified:
- `src/app/business/layout.tsx` - Added auth + onboarding gates

## Testing Instructions

### Test 1: Unauthenticated Access
```bash
# Clear cookies or use incognito
# Visit: http://business.localhost:3000/
# Expected: Redirects to /login
```

### Test 2: Authenticated, No Business
```bash
# 1. Register new user at /register
# 2. Visit: http://business.localhost:3000/
# Expected: Redirects to /onboarding
# Expected: Shows user email and onboarding stub
```

### Test 3: Try to Access Other Routes Without Business
```bash
# As authenticated user without Business
# Visit: http://business.localhost:3000/places
# Expected: Redirects to /onboarding
```

### Test 4: Logout
```bash
# Click "Logout" button in header
# Expected: Redirects to /login
# Expected: Cannot access business routes anymore
```

### Test 5: Onboarding Page Direct Access
```bash
# As authenticated user without Business
# Visit: http://business.localhost:3000/onboarding
# Expected: Shows onboarding page (no redirect loop)
```

## Security Considerations

### Server-Side Only
- ✅ All checks happen in server components (RSC)
- ✅ No client-side auth hacks
- ✅ No exposed auth state to client
- ✅ Redirects happen before rendering

### Protection Scope
- ✅ Entire `/business/*` route tree protected
- ✅ Layout wraps all business pages
- ✅ Cannot bypass by direct URL access

### Session Validation
- ✅ Uses existing session validation
- ✅ Checks httpOnly cookie
- ✅ Validates token hash in database
- ✅ Checks session expiration

## Next Steps

**Phase 2 - Business & Place Management:**
- ✅ Task 3: Authentication helpers (done!)
- ✅ Task 4: Business layout with auth check (done!)
- ⏭️ Task 5: Implement Business CRUD operations
  - Create Business form in onboarding
  - Update Business name
  - Delete Business (admin only)
- ⏭️ Task 6: Implement Place CRUD operations
- ⏭️ Task 7: Complete onboarding flow
  - Business creation
  - First Place creation
  - Redirect to dashboard

## Technical Notes

### Why Check Pathname?
```typescript
if (!business && pathname !== "/business/onboarding")
```
- Prevents redirect loop
- Allows onboarding page to render without Business
- All other routes require Business to exist

### Why Use headers()?
```typescript
const headersList = await headers();
const pathname = headersList.get("x-invoke-path") || "/";
```
- Server components don't have direct access to URL
- Next.js provides pathname via headers
- Fallback to "/" if header missing

### One Business Per Owner (MVP)
- `Business.ownerUserId` is `@unique`
- Simplifies MVP implementation
- `getMyBusiness()` uses `findUnique` (faster than `findFirst`)
- Can be relaxed in future versions

## Verification

```bash
# Check TypeScript
npx tsc --noEmit

# Start dev server
pnpm dev

# Test authentication flow
# 1. Visit business.localhost:3000 (should redirect to login)
# 2. Register new user
# 3. Should redirect to onboarding
# 4. Try to visit /places (should redirect back to onboarding)
```

## Production Considerations

1. **Session Duration:** Currently 30 days, may want to shorten for business users
2. **Role-Based Access:** Consider adding BUSINESS_OWNER role check
3. **Multi-Business Support:** If needed, update schema and remove @unique constraint
4. **Audit Logging:** Log business access attempts for security
5. **Rate Limiting:** Add rate limiting to prevent brute force attacks
