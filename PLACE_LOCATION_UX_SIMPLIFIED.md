# Place Location Picker - UX Simplification Complete

## Summary

Successfully simplified the PlaceLocationPicker UX by removing complex radio scenarios, multiple buttons, and coordinate displays. The new flow is: open map → set pin → save → done.

## Changes Made

### 1. Simplified PlaceLocationPicker Component
**File**: `src/components/business/place/PlaceLocationPicker.tsx`

**Removed:**
- Radio group for "Отдельный вход / Внутри здания / Указать точку"
- Separate buttons "Использовать эту точку" and "Определить адрес по точке"
- Manual lat/lng input fields
- Reverse geocode button
- Complex unit flow with radio scenarios
- Duplicate/match detection UI (moved to separate flow)
- All Google Maps initialization code (now in modal only)

**Added:**
- Simple map preview with one "Открыть карту" button
- Optional "Уточнение" section with:
  - Checkbox "Внутри ТЦ/комплекса"
  - Conditional fields: Этаж, Павильон/офис (only if checkbox checked)
  - "Как найти" textarea (always visible)
  - Single "Сохранить уточнения" button
- Clean status indicators (saving/saved/error)
- "Выбрано: {address}" text when location is set

**State Simplified:**
- Removed: matches, exactDuplicate, locationScenario, showUnitFlow, parentPlaceId
- Added: isInsideComplex, howToFind
- Kept: currentLat, currentLng, currentFormattedAddr

### 2. Simplified PlaceMapModal Component
**File**: `src/components/business/place/PlaceMapModal.tsx`

**Removed:**
- Tabs for "Авто / Вручную" modes
- Separate manual mode setup
- Mode state and switching logic

**Unified Behavior:**
- Search input always visible (Google Places Autocomplete)
- Map click always works (manual point selection)
- User can use either method without switching modes
- Selecting from autocomplete: saves with googlePlaceId (GOOGLE source)
- Clicking on map: saves without googlePlaceId (MANUAL source)

**UI:**
- Search input at top: "Введите адрес или кликните на карте"
- Large interactive map
- Small coordinates display at bottom (read-only, 6 decimals)
- Two buttons: "Отмена" (secondary) and "Сохранить точку" (primary)

### 3. Removed Dependencies
- No longer uses `@radix-ui/react-radio-group`
- Removed unused imports: RadioGroup, RadioGroupItem, Select components
- Removed unused types: PlaceMatch, AddressComponentJSON
- Removed unused constants: MINSK_BOUNDS, hasWarnedAboutMapId

## User Flow

### Main Flow (Location Selection)
1. User sees preview map with "Открыть карту" button
2. User clicks button → modal opens
3. User either:
   - Types address in search → selects from autocomplete → marker appears
   - Clicks directly on map → marker appears
4. User clicks "Сохранить точку"
5. Modal closes, preview updates with pulsing marker
6. "Выбрано: {address}" appears below preview

### Optional Details Flow
1. After selecting location, user scrolls to "Уточнение" section
2. If inside complex:
   - Checks "Внутри ТЦ/комплекса"
   - Fills "Этаж" and "Павильон/офис"
3. Fills "Как найти" with additional instructions
4. Clicks "Сохранить уточнения"

## API Integration

### Location Save
- **Autocomplete selection** → `POST /api/business/places/[id]/location/google`
  - Payload: `{ googlePlaceId, lat, lng, formattedAddr, addressJson }`
  - Sets `locationSource: GOOGLE`
  
- **Map click** → `POST /api/business/places/[id]/location/manual`
  - Payload: `{ lat, lng, customAddress }`
  - Sets `locationSource: MANUAL`

### Details Save
- **Endpoint**: `PATCH /api/business/places/[id]`
- **Payload**:
  ```json
  {
    "placeKind": "UNIT" | "STANDALONE",
    "floor": "2" | null,
    "unit": "A12" | null,
    "customAddress": "Как найти text" | null
  }
  ```

## Benefits

### UX Improvements
- **Simpler**: One button instead of multiple scenarios
- **Clearer**: No confusing radio options
- **Faster**: Direct interaction without mode switching
- **Flexible**: Can use search OR click without choosing upfront
- **Less cluttered**: No coordinate fields, no extra buttons

### Technical Improvements
- **Smaller bundle**: Removed unused dependencies
- **Less state**: Simplified state management
- **Cleaner code**: Removed complex conditional rendering
- **Better separation**: Map logic only in modal
- **Easier maintenance**: Less code to maintain

## Files Modified

1. `src/components/business/place/PlaceLocationPicker.tsx` - Simplified main component
2. `src/components/business/place/PlaceMapModal.tsx` - Unified search + click behavior

## Testing Checklist

- [ ] Preview map shows correctly
- [ ] "Открыть карту" button opens modal
- [ ] Search autocomplete works
- [ ] Map click sets marker
- [ ] Coordinates display correctly
- [ ] "Сохранить точку" saves and closes modal
- [ ] Preview updates after save
- [ ] "Выбрано: {address}" appears
- [ ] Checkbox "Внутри ТЦ/комплекса" toggles fields
- [ ] Floor/unit fields appear when checked
- [ ] "Как найти" always visible
- [ ] "Сохранить уточнения" saves details
- [ ] No console errors
- [ ] No TypeScript errors

## Before vs After

### Before (Complex)
```
┌─────────────────────────────────────┐
│ Radio: ○ Отдельный вход             │
│        ○ Внутри ТЦ                  │
│        ● Указать точку на карте     │
├─────────────────────────────────────┤
│ Широта: [53.904500]                 │
│ Долгота: [27.561500]                │
├─────────────────────────────────────┤
│ [Использовать эту точку]            │
│ [Определить адрес по точке]         │
├─────────────────────────────────────┤
│ Как найти: [textarea]               │
│ [Сохранить]                         │
└─────────────────────────────────────┘
```

### After (Simple)
```
┌─────────────────────────────────────┐
│ Местоположение                      │
│ ┌─────────────────────────────────┐ │
│ │   [Preview Map]                 │ │
│ │   [Открыть карту] button        │ │
│ └─────────────────────────────────┘ │
│ Выбрано: ул. Ленина, 1             │
├─────────────────────────────────────┤
│ Уточнение (необязательно)           │
│ ☑ Внутри ТЦ/комплекса              │
│   Этаж: [2]                         │
│   Павильон: [A12]                   │
│ Как найти: [textarea]               │
│ [Сохранить уточнения]               │
└─────────────────────────────────────┘
```

## Modal Comparison

### Before (Tabs)
```
┌─────────────────────────────────────┐
│ Выбор местоположения                │
├─────────────────────────────────────┤
│ [Авто (по Google)] [Вручную]        │
├─────────────────────────────────────┤
│ (Different UI per tab)              │
└─────────────────────────────────────┘
```

### After (Unified)
```
┌─────────────────────────────────────┐
│ Выбор местоположения                │
├─────────────────────────────────────┤
│ 🔍 Введите адрес или кликните       │
├─────────────────────────────────────┤
│ [Large Interactive Map]             │
│ (Both search and click work)        │
├─────────────────────────────────────┤
│ 53.904500, 27.561500                │
│ [Отмена] [Сохранить точку]          │
└─────────────────────────────────────┘
```

## Status

✅ Implementation complete
✅ TypeScript errors fixed
✅ Dependencies cleaned up
✅ UX simplified
⏳ Browser testing pending
