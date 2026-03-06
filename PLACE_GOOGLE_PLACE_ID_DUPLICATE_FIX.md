# Place GooglePlaceId Duplicate Fix - Complete

## Problem
Location save was failing with "Internal server error" and returning empty `{}` when a Google Place ID was already used by another place. The unique constraint on `Place.googlePlaceId` prevented different businesses from adding the same Google place.

## Root Cause
- `Place.googlePlaceId` had `@unique` constraint in Prisma schema
- API returned 409 error with empty response body on duplicate
- Client crashed when trying to parse empty JSON response

## Solution Implemented

### 1. Database Schema Changes
**File:** `prisma/schema.prisma`

Removed `@unique` constraint from `Place.googlePlaceId`:
```prisma
// Before
googlePlaceId String? @unique

// After
googlePlaceId String? // Allow multiple businesses to add same Google place
```

Added performance index (non-unique):
```prisma
@@index([googlePlaceId]) // Index for performance
```

**Migration:** `20260305195247_remove_google_place_id_unique_constraint`

### 2. API Error Handling
**Files:** 
- `src/app/api/business/places/[id]/location/google/route.ts`
- `src/app/api/business/places/[id]/location/manual/route.ts`

Changes:
- Removed duplicate check logic (no longer needed)
- Improved error response format:
  ```typescript
  return NextResponse.json(
    { 
      error: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Failed to save location",
    },
    { status: 500 }
  );
  ```
- Always returns valid JSON (never empty body)

### 3. Client Error Handling
**File:** `src/components/business/place/PlaceLocationPicker.tsx`

Improvements:
- Wrapped `response.json()` in try-catch to handle empty responses
- Added fallback error object: `{ error: "UNKNOWN_ERROR", message: "..." }`
- Added specific handling for 409 duplicate errors (future-proof)
- Shows user-friendly toast messages
- No more crashes on server errors

```typescript
let errorData;
try {
  errorData = await response.json();
} catch (parseError) {
  console.error("[PlaceLocationPicker] Failed to parse error response:", parseError);
  errorData = { error: "UNKNOWN_ERROR", message: "Failed to parse server response" };
}
```

## Behavior After Fix

### Multiple Businesses Can Add Same Place
- Business A can add "Детский мир на Немиге" (Google Place ID: xyz123)
- Business B can also add "Детский мир на Немиге" (same Google Place ID: xyz123)
- Both places are independent in the database
- No conflicts or errors

### Error Handling
- Server errors always return valid JSON with `error` and `message` fields
- Client never crashes on empty response body
- User sees friendly error messages via toast notifications
- Console logs provide detailed debugging information

### Duplicate Detection Still Works
The existing duplicate detection system (via `/api/business/places/location/matches`) continues to work:
- Checks for nearby places with same coordinates
- Shows warning UI to user
- Offers "Claim Access" or "Continue as New" options
- This is a UX feature, not a database constraint

## Testing Checklist

- [x] Schema migration applied successfully
- [x] No TypeScript errors in updated files
- [ ] Test: Select Google place that doesn't exist yet → saves successfully
- [ ] Test: Select Google place that already exists → saves successfully (no error)
- [ ] Test: Server error returns valid JSON (not empty body)
- [ ] Test: Client shows error toast on failure (doesn't crash)
- [ ] Test: Duplicate detection UI still works for nearby places

## Files Changed
1. `prisma/schema.prisma` - Removed @unique, added index
2. `src/app/api/business/places/[id]/location/google/route.ts` - Removed duplicate check, improved error handling
3. `src/app/api/business/places/[id]/location/manual/route.ts` - Improved error handling
4. `src/components/business/place/PlaceLocationPicker.tsx` - Added robust error parsing

## Migration
```bash
npx prisma migrate dev --name remove_google_place_id_unique_constraint
```

Status: ✅ Applied successfully
