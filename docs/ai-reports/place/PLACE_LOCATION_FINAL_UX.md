# Place Location Picker - Final UX Implementation

## Summary

Completely redesigned PlaceLocationPicker with a clean, intuitive UX flow:
- Always show search input
- Offer manual mode as fallback
- Handle duplicates with clear choices
- Show details only when user chooses "other place"

## User Flow

### 1. Search First (Default)
```
┌─────────────────────────────────────┐
│ Адрес или название места            │
│ [🔍 Search Input]                   │
│ Отметить местоположение вручную     │
└─────────────────────────────────────┘
```

User types → selects from autocomplete → system checks for duplicates

### 2. Manual Mode (Fallback)
```
┌─────────────────────────────────────┐
│ Координаты                          │
│ [53.904500] [27.561500]             │
├─────────────────────────────────────┤
│ [Preview Map]                       │
│ [Открыть карту] button              │
└─────────────────────────────────────┘
```

User clicks "Отметить вручную" → shows coordinates + preview → opens modal → sets pin → saves

### 3. Duplicate Detection
```
┌─────────────────────────────────────┐
│ ⚠️ Похоже, это место уже есть      │
├─────────────────────────────────────┤
│ [Place Card]                        │
│ Title: Детский центр "Радуга"       │
│ Address: ул. Ленина, 1              │
├─────────────────────────────────────┤
│ [Это моё место — запросить доступ]  │
│ [Это другое место по этому адресу]  │
└─────────────────────────────────────┘
```

### 4. Details (Only if "Other Place")
```
┌─────────────────────────────────────┐
│ Уточнение (необязательно)           │
│ ☑ Внутри ТЦ/комплекса              │
│   Этаж: [2]                         │
│   Павильон: [A12]                   │
│ Как найти: [textarea]               │
│ [Сохранить уточнения]               │
└─────────────────────────────────────┘
```

## Components Created

### 1. PlaceSearchInput.tsx
**Purpose**: Google Places Autocomplete search input

**Features**:
- Autocomplete with types: ["geocode", "establishment"]
- Country restriction: "by" (Belarus)
- Returns: googlePlaceId, lat, lng, formattedAddr, addressJson
- Clean callback interface

**Usage**:
```tsx
<PlaceSearchInput
  onPlaceSelect={(data) => {
    // Handle place selection
  }}
  disabled={isSaving}
/>
```

### 2. PlaceDuplicateBlock.tsx
**Purpose**: Show duplicate place with action choices

**Features**:
- Displays found place (title + address)
- Two action buttons:
  - "Это моё место — запросить доступ"
  - "Это другое место по этому адресу"
- Loading state support

**Usage**:
```tsx
<PlaceDuplicateBlock
  place={duplicatePlace}
  onClaimAccess={handleClaimAccess}
  onContinueAsNew={handleContinueAsNew}
  isLoading={isSaving}
/>
```

### 3. PlaceLocationPicker.tsx (Redesigned)
**Purpose**: Main location selection component

**State Management**:
- `manualMode`: Toggle between search and manual
- `pendingLocation`: Store location before duplicate check
- `duplicatePlace`: Found duplicate place
- `showDetails`: Show details section (only after "continue as new")
- `currentLat/Lng/FormattedAddr`: Current selected location

**Flow Logic**:
1. User selects from search → `handlePlaceSelect`
2. Check for duplicates → `checkForDuplicates`
3. If duplicate found → show `PlaceDuplicateBlock`
4. User chooses:
   - "Claim access" → `handleClaimAccess` → POST /claim
   - "Continue as new" → `handleContinueAsNew` → `saveLocation` + show details
5. If no duplicate → `saveLocation` directly

## API Integration

### Duplicate Check
**Endpoint**: `GET /api/business/places/location/matches`

**Query Params**:
- `placeId`: Current place ID
- `lat`, `lng`: Coordinates
- `formattedAddr`: Address string
- `googlePlaceId`: (optional) Google Place ID

**Response**:
```json
{
  "exactDuplicate": {
    "id": "...",
    "title": "...",
    "formattedAddr": "...",
    "customAddress": "..."
  },
  "matches": [...]
}
```

### Claim Access
**Endpoint**: `POST /api/business/places/[id]/claim`

**Payload**:
```json
{
  "message": "Запрос доступа к месту"
}
```

**Response**:
```json
{
  "success": true
}
```

**Creates**: PlaceClaimRequest record with status PENDING

### Save Location (Google)
**Endpoint**: `POST /api/business/places/[id]/location/google`

**Payload**:
```json
{
  "googlePlaceId": "ChIJ...",
  "lat": 53.904500,
  "lng": 27.561500,
  "formattedAddr": "ул. Ленина, 1",
  "addressJson": [...]
}
```

### Save Location (Manual)
**Endpoint**: `POST /api/business/places/[id]/location/manual`

**Payload**:
```json
{
  "lat": 53.904500,
  "lng": 27.561500,
  "customAddress": "Точка выбрана"
}
```

### Save Details
**Endpoint**: `PATCH /api/business/places/[id]`

**Payload**:
```json
{
  "placeKind": "UNIT" | "STANDALONE",
  "floor": "2",
  "unit": "A12",
  "customAddress": "Как найти text"
}
```

## Key Features

### 1. Always Show Search
- Search input is always visible at the top
- Primary method for location selection
- Supports both addresses and establishment names

### 2. Manual Mode Fallback
- Link: "Отметить местоположение вручную"
- Shows read-only coordinates
- Shows map preview with "Открыть карту" button
- Opens fullscreen modal for pin placement

### 3. Duplicate Detection
- Automatic check after place selection
- Shows clear UI with found place
- Two explicit choices:
  - Claim access (creates PlaceClaimRequest)
  - Continue as new place

### 4. Conditional Details
- Details section ONLY shows if user chose "continue as new"
- Checkbox for "Внутри ТЦ/комплекса"
- Conditional fields: floor, unit (only if checkbox checked)
- Always visible: "Как найти" textarea

### 5. Single Save Point
- No save on every click/selection
- Save only when:
  - User clicks "Сохранить точку" in modal (manual mode)
  - User confirms after duplicate check (auto mode)
- Unified save mechanism

## Technical Details

### No New Dependencies
- Does NOT use `@radix-ui/react-radio-group`
- Uses existing UI components (Input, Button, Checkbox, etc.)
- Uses existing GoogleMapsService

### Google Maps Integration
- Uses `GoogleMapsService.getPlacesLibrary()`
- Autocomplete with proper configuration
- Map ID from env: `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
- AdvancedMarkerElement with fallback to Marker

### State Flow
```
Search → Select → Check Duplicates
                      ↓
              ┌───────┴───────┐
              ↓               ↓
         Duplicate        No Duplicate
              ↓               ↓
      Show Choices        Save Location
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
Claim Access      Continue as New
    ↓                   ↓
POST /claim      Save + Show Details
```

## Files Modified/Created

### Created
1. `src/components/business/place/PlaceSearchInput.tsx` - Autocomplete search
2. `src/components/business/place/PlaceDuplicateBlock.tsx` - Duplicate UI

### Modified
3. `src/components/business/place/PlaceLocationPicker.tsx` - Complete redesign

### Existing (Used)
4. `src/components/business/place/PlaceMapPreview.tsx` - Map preview
5. `src/components/business/place/PlaceMapModal.tsx` - Fullscreen map modal
6. `src/app/api/business/places/[id]/claim/route.ts` - Claim endpoint
7. `src/app/api/business/places/location/matches/route.ts` - Duplicate check
8. `src/services/googleMaps/googleMaps.service.ts` - Maps service

## Testing Checklist

- [ ] Search input always visible
- [ ] Autocomplete shows addresses and establishments
- [ ] "Отметить вручную" link toggles manual mode
- [ ] Manual mode shows coordinates (read-only)
- [ ] Manual mode shows map preview
- [ ] "Открыть карту" opens modal
- [ ] Modal allows pin placement
- [ ] "Сохранить точку" saves and closes modal
- [ ] Duplicate check runs after selection
- [ ] Duplicate block shows found place
- [ ] "Запросить доступ" creates claim request
- [ ] "Это другое место" saves location + shows details
- [ ] Details section only visible after "continue as new"
- [ ] Checkbox toggles floor/unit fields
- [ ] "Сохранить уточнения" saves details
- [ ] No console errors
- [ ] No TypeScript errors

## Benefits

### UX Improvements
- **Clearer**: Search is primary, manual is fallback
- **Simpler**: No confusing radio options
- **Explicit**: Duplicate handling with clear choices
- **Contextual**: Details only when needed
- **Consistent**: Single save mechanism

### Technical Improvements
- **Modular**: Separate components for search, duplicates
- **Clean state**: Clear flow with pendingLocation
- **No extra deps**: Uses existing components
- **Maintainable**: Clear separation of concerns

## Status

✅ Components created
✅ PlaceLocationPicker redesigned
✅ TypeScript errors fixed
✅ No new dependencies added
✅ Duplicate detection integrated
✅ Claim access flow implemented
⏳ Browser testing pending
