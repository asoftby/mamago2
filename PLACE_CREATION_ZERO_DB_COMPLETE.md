# Place Creation - Zero DB Until Save ✅

## Summary
Radical simplification of Place creation flow. Opening "Add place" creates ZERO database records. Places are created ONLY when user explicitly clicks "Сохранить черновик" or "Отправить на модерацию".

## Implementation Complete

### 1. Database Schema - Idempotency ✅
**File:** `prisma/schema.prisma`

Added `createRequestId` field to Place model:
```prisma
model Place {
  // ...
  createRequestId String? // Idempotency key for creation
  // ...
  
  @@unique([ownerUserId, createRequestId]) // Prevent duplicates
}
```

**Migration:** `20260305210945_add_place_create_request_id`

### 2. Multi-Step Local Wizard ✅
**File:** `src/app/business/(protected)/places/new/NewPlaceWizard.tsx`

**Features:**
- All 4 steps work in local React state
- No DB writes while navigating/typing
- Generates unique `createRequestId` on mount
- Two save actions:
  - "Сохранить черновик" → creates DRAFT
  - "Отправить на модерацию" → creates PENDING
- Beforeunload warning if dirty
- Full validation before creation

**Local State Structure:**
```typescript
interface LocalDraft {
  // Step 1
  title, category, shortDesc, description
  ageTags, visitFormats, activityTypes
  
  // Step 2
  lat, lng, googlePlaceId, formattedAddr
  cityId, districtAutoId, metroAutoId, etc.
  
  // Step 3
  logoImageId, images[]
  
  // Step 4
  phone, website, instagramHandle
  
  // Hierarchy
  placeKind, floor, unit
}
```

### 3. Idempotent Creation API ✅
**File:** `src/app/api/business/places/route.ts`

**POST /api/business/places**

**Request:**
```json
{
  "createRequestId": "uuid-v4",
  "status": "DRAFT" | "PENDING",
  "data": {
    // All fields from LocalDraft
  }
}
```

**Logic:**
1. Validate createRequestId, status, required fields
2. Check if place with (ownerUserId, createRequestId) exists
3. If exists → return existing place (idempotent)
4. If not → create new place with all provided data
5. Return created place

**Response:**
```json
{
  "place": {
    "id": "cuid",
    "status": "DRAFT" | "PENDING",
    // ... all fields
  }
}
```

### 4. Routes

#### /business/places/new ✅
- Local-only wizard
- No DB record until save
- All 4 steps functional
- Manual save buttons only

#### /business/places/[id]/edit ✅
- Edits existing place (unchanged)
- Manual save (no autosave)
- Submit for moderation

#### /business/places ✅
- Lists all places (unchanged)
- Shows only created places

## User Flow

### Creating New Place

```
User clicks "Добавить место"
  ↓
Navigate to /business/places/new
  ↓
NewPlaceWizard renders (local state only)
  ↓
User fills Step 1 (title, category, desc)
  ↓
User clicks "Далее" → navigate to Step 2
  ↓
User fills Step 2 (location)
  ↓
User clicks "Далее" → navigate to Step 3
  ↓
User fills Step 3 (photos)
  ↓
User clicks "Далее" → navigate to Step 4
  ↓
User fills Step 4 (contacts)
  ↓
User clicks "Отправить на модерацию"
  ↓
POST /api/business/places (creates PENDING)
  ↓
Redirect to /business/places?status=PENDING
  ↓
Toast: "Место отправлено на модерацию"
```

### Saving Draft

```
User on any step
  ↓
User clicks "Сохранить черновик"
  ↓
POST /api/business/places (creates DRAFT)
  ↓
Redirect to /business/places/{id}/edit?step={currentStep}
  ↓
Toast: "Черновик создан"
  ↓
Continue editing with existing wizard
```

## Idempotency Protection

### Scenario: User clicks "Save" twice quickly

```
Click 1:
  POST /api/business/places
  createRequestId: "abc-123"
  → Creates place with id "place-1"
  → Returns { place: { id: "place-1" } }

Click 2 (before redirect):
  POST /api/business/places
  createRequestId: "abc-123" (same!)
  → Finds existing place "place-1"
  → Returns { place: { id: "place-1" } } (same)
  
Result: Only ONE place created ✅
```

### Scenario: User refreshes page

```
Page load 1:
  NewPlaceWizard mounts
  createRequestId: "abc-123" (generated)
  User fills form
  User clicks save
  → Creates place "place-1"

Page refresh:
  NewPlaceWizard mounts again
  createRequestId: "def-456" (NEW uuid)
  Form is empty (local state reset)
  User fills form again
  User clicks save
  → Creates NEW place "place-2"
  
Result: Two places, but user intended this ✅
```

## Verification Steps

### 1. Open /business/places/new ✅

```bash
# Start dev server
pnpm dev

# Open browser
http://localhost:3002/business/places

# Click "Добавить место"
# Navigate to /business/places/new
```

**Expected:**
- Page loads instantly
- Shows Step 1 form
- NO API calls in Network tab
- NO new records in database

**Verify in DB:**
```sql
SELECT COUNT(*) FROM "Place" WHERE "ownerUserId" = 'YOUR_USER_ID';
-- Should not increase
```

### 2. Navigate Steps Without Saving ✅

```bash
# Fill Step 1 fields
# Click "Далее" → Step 2
# Fill location
# Click "Далее" → Step 3
# Click "Далее" → Step 4
```

**Expected:**
- All steps work
- NO API calls to /api/business/places
- NO new records in database
- Can navigate back and forth

### 3. Click "Сохранить черновик" ✅

```bash
# Go back to Step 1
# Fill required fields:
# - Title: "Test Place"
# - Category: "cafe"
# - Short description: "Test"

# Click "Сохранить черновик"
```

**Expected:**
- ONE POST request to /api/business/places
- Request body includes createRequestId
- Success toast: "Черновик создан"
- Redirect to /business/places/{id}/edit?step=1
- Exactly ONE new Place record in DB with status=DRAFT

**Verify in DB:**
```sql
SELECT id, title, status, "createRequestId", "createdAt" 
FROM "Place" 
WHERE "ownerUserId" = 'YOUR_USER_ID' 
AND title = 'Test Place';
-- Should return exactly 1 row
```

### 4. Repeat Save Click Quickly ✅

```bash
# Go to /business/places/new
# Fill Step 1
# Click "Сохранить черновик" multiple times quickly
```

**Expected:**
- First click creates place
- Subsequent clicks return same place (idempotent)
- Still only ONE place in DB
- No duplicates

**Verify in DB:**
```sql
SELECT COUNT(*) 
FROM "Place" 
WHERE "ownerUserId" = 'YOUR_USER_ID' 
AND "createRequestId" = 'THE_REQUEST_ID';
-- Should return 1
```

### 5. Submit for Moderation ✅

```bash
# Go to /business/places/new
# Fill all 4 steps
# Click "Отправить на модерацию" on Step 4
```

**Expected:**
- ONE POST request to /api/business/places
- Request body: status="PENDING"
- Success toast: "Место отправлено на модерацию"
- Redirect to /business/places?status=PENDING
- Exactly ONE new Place record with status=PENDING

**Verify in DB:**
```sql
SELECT id, title, status, "createRequestId" 
FROM "Place" 
WHERE "ownerUserId" = 'YOUR_USER_ID' 
AND status = 'PENDING'
ORDER BY "createdAt" DESC 
LIMIT 1;
-- Should show the new place
```

### 6. React StrictMode Safety ✅

```bash
# Ensure React StrictMode is enabled in development
# Open /business/places/new
# Check Network tab
```

**Expected:**
- Component mounts twice (StrictMode behavior)
- Still NO API calls
- Still NO DB records created
- createRequestId generated once per mount (different each time)

## Files Modified

### Created
1. ✅ `src/app/business/(protected)/places/new/NewPlaceWizard.tsx` - Multi-step local wizard
2. ✅ `prisma/migrations/20260305210945_add_place_create_request_id/` - DB migration

### Modified
3. ✅ `prisma/schema.prisma` - Added createRequestId field
4. ✅ `src/app/api/business/places/route.ts` - Idempotent creation API
5. ✅ `src/app/business/(protected)/places/new/page.tsx` - Use NewPlaceWizard

### Disabled
6. ✅ `src/app/business/(protected)/places/new/CreatePlaceRedirect.tsx.DISABLED` - Old auto-create

## Code Paths That Create Places

### ✅ Explicit User Actions (Allowed)
1. User clicks "Сохранить черновик" in NewPlaceWizard
   - `POST /api/business/places` with status="DRAFT"
   
2. User clicks "Отправить на модерацию" in NewPlaceWizard
   - `POST /api/business/places` with status="PENDING"

### ❌ Automatic Actions (Removed)
1. ~~Opening /business/places/new~~ - REMOVED
2. ~~useEffect on mount~~ - REMOVED
3. ~~Auto-create on navigation~~ - REMOVED
4. ~~Autosave while typing~~ - REMOVED

## API Contract

### POST /api/business/places

**Request:**
```typescript
{
  createRequestId: string; // UUID v4, generated client-side
  status: "DRAFT" | "PENDING";
  data: {
    // Step 1
    title: string;
    category: string;
    shortDesc: string;
    description?: string;
    ageTags?: string[];
    visitFormats?: string[];
    activityTypes?: string[];
    
    // Step 2
    lat?: number;
    lng?: number;
    googlePlaceId?: string;
    formattedAddr?: string;
    addressJson?: any;
    customAddress?: string;
    cityId?: string;
    districtAutoId?: string;
    districtManualId?: string;
    metroAutoId?: string;
    metroAutoDistanceM?: number;
    metroManualId?: string;
    metroManualDistanceM?: number;
    
    // Step 3
    logoImageId?: string;
    
    // Step 4
    phone?: string;
    website?: string;
    instagramHandle?: string;
    instagramUrl?: string;
    
    // Hierarchy
    placeKind?: "STANDALONE" | "COMPLEX" | "UNIT";
    floor?: string;
    unit?: string;
  };
}
```

**Response (Success):**
```typescript
{
  place: {
    id: string;
    status: "DRAFT" | "PENDING";
    // ... all fields
  }
}
```

**Response (Error):**
```typescript
{
  error: "VALIDATION_ERROR" | "UNAUTHORIZED" | "DUPLICATE_REQUEST" | "INTERNAL_SERVER_ERROR";
  message: string;
}
```

## Benefits

### Before (Auto-Create) ❌
- Empty drafts created on page load
- Refresh = new empty draft
- StrictMode = 2 empty drafts
- Database trash
- No user control
- Duplicates possible

### After (Explicit Create) ✅
- Zero DB writes until save
- Refresh = clean slate
- StrictMode safe
- No database trash
- Full user control
- Duplicates impossible (idempotency)

## Edge Cases Handled

### 1. User Navigates Away Without Saving
- Beforeunload warning shown
- Local state lost (intended)
- No orphaned DB records

### 2. User Clicks Save Multiple Times
- Idempotency prevents duplicates
- Same createRequestId = same place
- Returns existing place

### 3. Network Error During Save
- Error toast shown
- User can retry
- Same createRequestId used
- Will create or return existing

### 4. User Refreshes During Creation
- New createRequestId generated
- Form is empty (local state reset)
- If user saves again, creates NEW place (intended)

### 5. React StrictMode Double Mount
- Each mount gets own createRequestId
- No API calls on mount
- Safe from double creation

## Testing Checklist

- [x] Open /business/places/new → no DB record
- [x] Navigate all 4 steps → no DB record
- [x] Refresh page → no DB record
- [x] Click "Сохранить черновик" → exactly 1 record
- [x] Click save multiple times → still 1 record
- [x] Click "Отправить на модерацию" → 1 record with PENDING
- [x] Verify idempotency with same createRequestId
- [x] Verify new createRequestId creates new place
- [x] React StrictMode → no double creation
- [x] Network tab → no POST on page load
- [x] Database → no empty drafts
- [x] TypeScript → no errors
- [x] Prisma migration → applied successfully

## Related Documents

- `PLACE_NO_AUTO_CREATE_COMPLETE.md` - Initial auto-create removal
- `PLACE_WIZARD_MANUAL_SAVE_COMPLETE.md` - Manual save implementation
- `PLACE_SINGLE_DRAFT_LIMIT_COMPLETE.md` - Single draft enforcement

---

**Status:** ✅ Complete and verified
**Date:** 2026-03-06
**Impact:** Zero automatic Place creation, full idempotency, radical simplification
**Risk:** Low (only affects new place creation, existing places unchanged)
