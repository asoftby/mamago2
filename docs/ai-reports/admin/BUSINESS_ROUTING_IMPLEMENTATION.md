# Business Subdomain Routing Implementation

## Overview
Implemented host-based routing for business subdomain in Next.js 16 App Router using middleware, with clean URLs (no /minsk redirect).

## Changes Made

### 1. Middleware Updates (`src/middleware.ts`)

**Added:**
- `isHost()` helper function to check host prefixes
- Business subdomain detection and rewriting
- Proper routing order: Business → Admin → Public

**Routing Logic:**
1. **Business Host** (`business.localhost`, `business.mamago.by`)
   - Rewrites to `/business/*` routes
   - NO redirect to `/minsk`
   - Clean URLs maintained

2. **Admin Host** (`admin.localhost`, `admin.mamago.by`)
   - Existing behavior preserved
   - Rewrites to `/admin/*` routes

3. **Public Host** (default)
   - Existing behavior preserved
   - Root `/` redirects to `/minsk`

**Matcher:**
```typescript
matcher: ["/((?!_next|api|favicon.ico).*)"]
```
Excludes Next.js internals, API routes, and static assets.

### 2. Business App Routes

**Created Files:**

#### `src/app/business/layout.tsx`
- Simple header with "Business Cabinet" branding
- Navigation links: Dashboard, Places, Offers
- Light theme with Tailwind CSS
- No authentication yet (Phase 2)

#### `src/app/business/page.tsx`
- Dashboard stub with placeholder content
- Debug info showing current host and pathname
- Quick links to Places, Offers, Analytics
- Includes smoke test instructions in comments

#### `src/app/business/places/page.tsx`
- Placeholder page for Places management
- Ready for Phase 2 implementation

#### `src/app/business/offers/page.tsx`
- Placeholder page for Offers management
- Ready for Phase 3 implementation

### 3. Bug Fixes

Fixed TypeScript errors in auth routes:
- `src/app/api/auth/login/route.ts`: Changed `error.errors` to `error.issues`
- `src/app/api/auth/register/route.ts`: Changed `error.errors` to `error.issues`

## Smoke Test Instructions

### 1. Start Dev Server
```bash
pnpm dev
```

### 2. Test Business Subdomain (NO /minsk redirect)
```
URL: http://business.localhost:3000/
Expected: Shows "Business Dashboard (stub)"
Host: business.localhost:3000
Pathname: /
```

✅ **Critical:** Should NOT redirect to `/minsk`

### 3. Test Admin Subdomain (Existing Behavior)
```
URL: http://admin.localhost:3000/
Expected: Admin area loads via /admin rewrite
```

✅ Existing admin functionality preserved

### 4. Test Public Host (Existing Behavior)
```
URL: http://localhost:3000/
Expected: Redirects to /minsk
```

✅ Public routing unchanged

### 5. Test Navigation
- Click "Places" on business.localhost:3000 → Should load `/places` (stub)
- Click "Offers" on business.localhost:3000 → Should load `/offers` (stub)
- Click "Dashboard" → Should return to `/`

### 6. Verify Middleware Rewrites
Check browser DevTools Network tab:
- business.localhost:3000/ → Rewrites to /business (internal, not visible in URL)
- business.localhost:3000/places → Rewrites to /business/places
- business.localhost:3000/offers → Rewrites to /business/offers

## File Structure

```
src/
├── middleware.ts (updated)
└── app/
    ├── business/
    │   ├── layout.tsx (new)
    │   ├── page.tsx (new)
    │   ├── places/
    │   │   └── page.tsx (new)
    │   └── offers/
    │       └── page.tsx (new)
    └── api/
        └── auth/
            ├── login/route.ts (fixed)
            └── register/route.ts (fixed)
```

## Next Steps

**Phase 1 Complete:**
- ✅ Task 1: Database schema and migrations
- ✅ Task 2: Middleware routing for business subdomain

**Phase 2 Next:**
- Task 3: Authentication and authorization helpers (already done!)
- Task 4: Business layout with auth check
- Task 5: Business CRUD operations
- Task 6: Place CRUD operations
- Task 7: Onboarding flow

## Technical Notes

### Why Named Relations?
Prisma requires reverse relations even for read-only foreign keys. We added:
- `City.places Place[] @relation("PlaceCity")`
- `MetroStation.places Place[] @relation("PlaceMetro")`
- `District.places Place[] @relation("PlaceDistrict")`

Named relations prevent conflicts with existing relations.

### Why isHost() Helper?
Reduces code duplication and makes it easy to add more subdomains in the future:
```typescript
function isHost(host: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => host.startsWith(prefix));
}
```

### Routing Order Matters
Business check must come BEFORE admin check to ensure correct precedence.

## Verification Commands

```bash
# Check TypeScript
npx tsc --noEmit

# Check for syntax errors
pnpm build --dry-run

# Start dev server
pnpm dev
```

## Production Considerations

1. **DNS Setup:** Ensure `business.mamago.by` points to your server
2. **SSL Certificates:** Configure for `*.mamago.by` wildcard
3. **Environment Variables:** May need different configs per subdomain
4. **Redirect Type:** Consider changing 307 to 308 for permanent redirects in production
