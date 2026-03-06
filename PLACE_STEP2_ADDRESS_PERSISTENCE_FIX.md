# Place Step 2 - Address Persistence Fix ✅

## Problem
1. After selecting address on Step 2 and navigating to Step 3, then back to Step 2 → address field was empty
2. Location data was stored in localDraft but not restored in the input field

## Root Cause
`PlaceSearchInput` component didn't accept or display initial value. It only handled new selections from Google Autocomplete, but couldn't restore previously selected addresses.

## Solution

### 1. Enhanced PlaceSearchInput ✅
**File:** `src/components/business/place/PlaceSearchInput.tsx`

**Added:**
- `initialValue?: string` prop
- useEffect to set input value when initialValue changes
- Restores address in input field on component mount

**Before:**
```typescript
interface PlaceSearchInputProps {
  onPlaceSelect: (...) => void;
  disabled?: boolean;
}
```

**After:**
```typescript
interface PlaceSearchInputProps {
  onPlaceSelect: (...) => void;
  disabled?: boolean;
  initialValue?: string; // NEW: Initial address to display
}

export function PlaceSearchInput({ onPlaceSelect, disabled, initialValue }) {
  // NEW: Set initial value when component mounts
  useEffect(() => {
    if (inputRef.current && initialValue) {
      inputRef.current.value = initialValue;
    }
  }, [initialValue]);
  // ...
}
```

### 2. Updated PlaceLocationPicker ✅
**File:** `src/components/business/place/PlaceLocationPicker.tsx`

**Changed:**
```typescript
<PlaceSearchInput
  onPlaceSelect={handlePlaceSelect}
  disabled={isSaving}
  initialValue={location?.address || initialLocation?.formattedAddr || ""}
/>
```

**Logic:**
- If `location.address` exists (current session) → use it
- Else if `initialLocation.formattedAddr` exists (from DB/localDraft) → use it
- Else → empty string

## How It Works Now

### Flow 1: New Place (NewPlaceWizard)
```
Step 1 → fill title
  ↓
Step 2 → select address "ул. Ленина 1, Минск"
  ↓
handlePlaceSelect() called
  ↓
onUpdate({ lat, lng, googlePlaceId, formattedAddr, addressJson })
  ↓
localDraft updated with location data
  ↓
Navigate to Step 3
  ↓
Step2Location unmounts
  ↓
Navigate back to Step 2
  ↓
Step2Location mounts again
  ↓
mockPlace created from localDraft (includes formattedAddr)
  ↓
initialLocation = { formattedAddr: "ул. Ленина 1, Минск", ... }
  ↓
PlaceSearchInput receives initialValue="ул. Ленина 1, Минск"
  ↓
useEffect sets input.value = "ул. Ленина 1, Минск"
  ↓
Address visible in input field ✅
```

### Flow 2: Existing Place (PlaceWizard with DB ID)
```
Load place from DB
  ↓
place.formattedAddr = "ул. Ленина 1, Минск"
  ↓
Step2Location receives place
  ↓
initialLocation = { formattedAddr: "ул. Ленина 1, Минск", ... }
  ↓
PlaceLocationPicker mounts
  ↓
location state initialized from initialLocation
  ↓
PlaceSearchInput receives initialValue="ул. Ленина 1, Минск"
  ↓
Address visible in input field ✅
```

## Data Flow

### localDraft in NewPlaceWizard
```typescript
interface LocalDraft {
  // Step 2 location fields
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  formattedAddr: string | null;  // ← This is the key field
  addressJson: any | null;
  customAddress: string | null;
  // ...
}
```

### mockPlace Creation
```typescript
const mockPlace: PlaceWithImages = {
  id: "new",
  ...localDraft,  // ← Spreads all localDraft fields including formattedAddr
  // ...
};
```

### Step2Location Props
```typescript
<Step2Location
  place={mockPlace}  // ← Contains formattedAddr from localDraft
  onUpdate={handleUpdate}
  // ...
/>
```

### PlaceLocationPicker Initialization
```typescript
const initialLocation = hasLocation
  ? {
      formattedAddr: place.formattedAddr || undefined,  // ← From mockPlace
      // ...
    }
  : null;

<PlaceLocationPicker
  initialLocation={initialLocation}  // ← Passed to component
  // ...
/>
```

### PlaceSearchInput Display
```typescript
<PlaceSearchInput
  initialValue={location?.address || initialLocation?.formattedAddr || ""}
  // ← Uses initialLocation.formattedAddr on mount
/>
```

## Files Modified

1. ✅ `src/components/business/place/PlaceSearchInput.tsx`
   - Added `initialValue` prop
   - Added useEffect to set input value

2. ✅ `src/components/business/place/PlaceLocationPicker.tsx`
   - Pass `initialValue` to PlaceSearchInput
   - Uses `location?.address || initialLocation?.formattedAddr`

## Testing

### Test 1: New Place - Address Persistence ✅
```
1. Open /business/places/new
2. Go to Step 2
3. Select address "ул. Ленина 1, Минск"
4. Verify: address shows in input
5. Click "Далее" → Step 3
6. Click "Назад" → Step 2
7. Verify: address still shows in input ✅
```

### Test 2: Existing Place - Address Display ✅
```
1. Create place with address
2. Save draft
3. Open /business/places/{id}/edit?step=2
4. Verify: address shows in input ✅
```

### Test 3: Change Address ✅
```
1. On Step 2 with existing address
2. Select new address
3. Verify: new address shows in input
4. Navigate away and back
5. Verify: new address persists ✅
```

## Remaining Issues

### Geo Enrichment Not Triggered
**Status:** NOT FIXED in this PR

**Problem:**
- City, district, metro are not computed when selecting address in NewPlaceWizard
- These are only computed when place is saved to DB via location API endpoints
- NewPlaceWizard doesn't have DB ID yet, so can't call `/api/business/places/[id]/location/google`

**Solution (Future):**
- Option A: Call geo enrichment when creating place (POST /api/business/places)
- Option B: Add geo enrichment to client-side (compute cityId from addressJson)
- Option C: Show geo fields only after place is created

**Current Behavior:**
- Address persists ✅
- Lat/lng persist ✅
- City/district/metro NOT computed until place is saved to DB ⚠️

### Manual Save on Step 2
**Status:** NOT IMPLEMENTED in this PR

**Current:**
- Step 2 location changes update localDraft immediately
- No explicit save button on Step 2
- Changes saved when clicking "Далее" or "Сохранить черновик"

**Future Enhancement:**
- Add "Сохранить" button on Step 2 (like other steps)
- Trigger geo enrichment on save
- Show computed city/district/metro after save

## Related Documents

- `PLACE_WIZARD_MANUAL_SAVE_COMPLETE.md` - Manual save implementation
- `PLACE_CREATION_ZERO_DB_COMPLETE.md` - Zero DB until save
- `PLACE_GEO_ENRICHMENT_MVP_COMPLETE.md` - Geo enrichment pipeline

---

**Status:** ✅ Address persistence fixed
**Date:** 2026-03-06
**Impact:** Step 2 address now persists across navigation
**Remaining:** Geo enrichment needs separate fix
