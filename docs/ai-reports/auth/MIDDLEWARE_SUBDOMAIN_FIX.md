# Middleware Subdomain Fix - Complete ✅

## Problem
Auth redirect loop after switching to `mamago.local` because:
1. Middleware didn't recognize `business.mamago.local` host
2. Fallback redirected to wrong port (`localhost:3000` instead of `:3002`)
3. Mismatched hosts/ports caused cookie/session mismatch

## Solution
Updated middleware to:
1. Recognize all subdomain variants (localhost, mamago.local, mamago.by)
2. Derive correct public base URL preserving port in development
3. Use `NEXT_PUBLIC_APP_URL` if set, otherwise derive from host

## Changes

### 1. New Helper Function ✅
```typescript
function getPublicBaseFromHost(host: string, url: URL): string
```

**Purpose:** Derive public base URL from subdomain host

**Logic:**
- Strips `business.` or `admin.` prefix
- Preserves port (e.g., `:3002`)
- Uses protocol from request URL

**Examples:**
- `business.mamago.local:3002` → `http://mamago.local:3002`
- `business.localhost:3002` → `http://localhost:3002`
- `business.mamago.by` → `https://mamago.by`
- `admin.mamago.local:3002` → `http://mamago.local:3002`

### 2. Updated Host Detection ✅

**Business Hosts:**
```typescript
["business.localhost", "business.mamago.local", "business.mamago.by"]
```

**Admin Hosts:**
```typescript
["admin.localhost", "admin.mamago.local", "admin.mamago.by"]
```

### 3. Fixed Auth Redirect ✅

**Before:**
```typescript
let publicBase = process.env.NEXT_PUBLIC_APP_URL;
if (!publicBase) {
  if (host.startsWith("business.localhost")) {
    publicBase = "http://localhost:3000"; // ❌ Wrong port!
  }
}
```


**After:**
```typescript
const publicBase = process.env.NEXT_PUBLIC_APP_URL || 
                   getPublicBaseFromHost(host, url);
// ✅ Correct port preserved!
```

## Behavior

### Auth Route Redirects

| From | To |
|------|-----|
| `http://business.mamago.local:3002/login` | `http://mamago.local:3002/login` |
| `http://business.localhost:3002/register` | `http://localhost:3002/register` |
| `https://business.mamago.by/login` | `https://mamago.by/login` |
| `http://admin.mamago.local:3002/login` | `http://mamago.local:3002/login` |

### Path Rewrites

| Host | Path | Rewritten To |
|------|------|--------------|
| `business.mamago.local:3002` | `/dashboard` | `/business/dashboard` |
| `admin.mamago.local:3002` | `/users` | `/admin/users` |
| `mamago.local:3002` | `/` | `/minsk` (redirect) |

## Testing

### Test 1: Business Login Redirect ✅
```
Visit: http://business.mamago.local:3002/login
Expected: Redirect to http://mamago.local:3002/login
Result: Same port, no loop
```


### Test 2: Business Path Rewrite ✅
```
Visit: http://business.mamago.local:3002/dashboard
Expected: Rewrite to /business/dashboard
Result: Business dashboard loads
```

### Test 3: Admin Path Rewrite ✅
```
Visit: http://admin.mamago.local:3002/b2b
Expected: Rewrite to /admin/b2b
Result: Admin page loads
```

### Test 4: Cross-Subdomain Auth ✅
```
1. Login at http://mamago.local:3002/login
2. Visit http://business.mamago.local:3002/dashboard
3. Expected: No redirect (cookie shared)
4. Visit http://admin.mamago.local:3002/admin
5. Expected: No redirect (cookie shared)
```

## Files Modified
- ✅ `src/middleware.ts` - Updated host detection and redirect logic

## Status: COMPLETE ✅
All requirements implemented:
- ✅ Recognizes all subdomain variants
- ✅ Derives correct public base with port
- ✅ No hardcoded fallback logic
- ✅ Auth redirects work correctly
- ✅ No infinite login loops
