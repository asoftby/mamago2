# Place Location Picker - UX Improvements Implementation Plan

## Status: 📋 PLANNING

## Overview

Comprehensive UX improvements for PlaceLocationPicker to support:
1. Search by address AND place name
2. Manual point selection mode
3. "How to find" field
4. Support for places inside malls/complexes
5. Minsk bias with Belarus-wide search

---

## Current State Analysis

### ✅ Already Implemented
- PlacesService.getDetails for precise coordinates
- Singleton initialization pattern
- Belarus bounds bias
- Controlled input state
- Error handling and validation
- Map ID support with AdvancedMarkerElement

### ✅ Database Schema Ready
```prisma
model Place {
  // Location fields
  googlePlaceId  String?
  lat            Float?
  lng            Float?
  formattedAddr  String?
  addressJson    Json?
  locationSource LocationSource // GOOGLE | MANUAL
  customAddress  String?        // ✅ For manual mode + "how to find"
  
  // Hierarchy (for places inside malls)
  placeKind     PlaceKind      // STANDALONE | COMPLEX | UNIT
  parentPlaceId String?
  unitLabel     String?        // ✅ Combined description
  floor         String?        // ✅ Floor number
  unit          String?        // ✅ Unit/pavilion number
}
```

### ✅ API Endpoints Ready
- `POST /api/business/places/[id]/location/google` - For Google Places
- `POST /api/business/places/[id]/location/manual` - For manual selection

---

## Implementation Sections

### SECTION 1: Search by Address AND Place Name ✅

**Changes to Autocomplete:**
```typescript
// BEFORE
types: ["address"]

// AFTER
types: ["geocode", "establishment"]
```

**Fields:**
```typescript
fields: [
  "place_id",
  "name",              // ✅ Add name
  "geometry",
  "formatted_address",
  "address_components",
]
```

**Placeholder:**
```
"Введите адрес или название места..."
```

**Impact:**
- Finds addresses (streets, buildings)
- Finds establishments (cafes, studios, malls, parks)
- Finds POIs (landmarks, organizations)

---

### SECTION 2: Minsk Bias (Belarus-wide search) ✅

**Minsk Bounds:**
```typescript
const MINSK_BOUNDS = {
  center: { lat: 53.9006, lng: 27.5590 },
  southwest: { lat: 53.70, lng: 27.20 },
  northeast: { lat: 54.10, lng: 27.95 },
};
```

**Apply Bias:**
```typescript
const minskBounds = new google.maps.LatLngBounds(
  new google.maps.LatLng(MINSK_BOUNDS.southwest.lat, MINSK_BOUNDS.southwest.lng),
  new google.maps.LatLng(MINSK_BOUNDS.northeast.lat, MINSK_BOUNDS.northeast.lng)
);

autocomplete.setBounds(minskBounds);
// strictBounds: false - allows search outside Minsk
```

**Result:**
- Minsk results prioritized
- Can still search Gomel, Brest, Vitebsk, etc.

---

### SECTION 3: Precise Coordinates ✅ (Already Done)

Current implementation already uses PlacesService.getDetails ✅

---

### SECTION 4: Save Data ✅ (Already Done)

Current implementation already saves:
- googlePlaceId
- lat/lng (no rounding)
- formattedAddr
- addressJson
- locationSource = GOOGLE

---

### SECTION 5: Manual Point Selection 🔨

**New State:**
```typescript
const [isManualMode, setIsManualMode] = useState(false);
const [manualCoords, setManualCoords] = useState<{lat: number, lng: number} | null>(null);
```

**UI:**
```tsx
<div className="flex items-center gap-2">
  <Checkbox
    id="manual-mode"
    checked={isManualMode}
    onCheckedChange={(checked) => setIsManualMode(!!checked)}
  />
  <Label htmlFor="manual-mode">
    Отметить местоположение вручную
  </Label>
</div>

{isManualMode && (
  <p className="text-sm text-gray-600">
    Кликните по карте чтобы поставить метку
  </p>
)}
```

**Map Click Handler:**
```typescript
if (isManualMode) {
  map.addListener("click", (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      setManualCoords({ lat, lng });
      addMarker(lat, lng, markerLib);
      map.panTo({ lat, lng });
      map.setZoom(17);
    }
  });
}
```

**Save Button:**
```tsx
{isManualMode && manualCoords && (
  <Button onClick={saveManualLocation}>
    Сохранить точку
  </Button>
)}
```

**Save Function:**
```typescript
const saveManualLocation = async () => {
  if (!manualCoords) return;
  
  const response = await fetch(
    `/api/business/places/${placeId}/location/manual`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: manualCoords.lat,
        lng: manualCoords.lng,
        customAddress: customAddressText, // From textarea
      }),
    }
  );
  
  // Handle response...
};
```

---

### SECTION 6: "How to Find" Field 🔨

**UI:**
```tsx
<div>
  <Label htmlFor="custom-address">
    Как найти (необязательно)
  </Label>
  <Textarea
    id="custom-address"
    placeholder="Например: 2 этаж, павильон 14, вход со стороны парковки"
    value={customAddressText}
    onChange={(e) => setCustomAddressText(e.target.value)}
    rows={2}
  />
</div>
```

**Save:**
- Include in both Google and Manual save functions
- Saves to `customAddress` field

---

### SECTION 7: Place Inside Mall/Complex 🔨

**New State:**
```typescript
const [isInsideComplex, setIsInsideComplex] = useState(false);
const [floor, setFloor] = useState("");
const [unit, setUnit] = useState("");
const [unitLabel, setUnitLabel] = useState("");
```

**UI:**
```tsx
<div className="flex items-center gap-2">
  <Checkbox
    id="inside-complex"
    checked={isInsideComplex}
    onCheckedChange={(checked) => setIsInsideComplex(!!checked)}
  />
  <Label htmlFor="inside-complex">
    Объект находится в ТЦ / комплексе
  </Label>
</div>

{isInsideComplex && (
  <div className="space-y-3 pl-6 border-l-2 border-gray-200">
    <div>
      <Label htmlFor="floor">Этаж</Label>
      <Input
        id="floor"
        value={floor}
        onChange={(e) => setFloor(e.target.value)}
        placeholder="Например: 2"
      />
    </div>
    
    <div>
      <Label htmlFor="unit">Павильон / офис</Label>
      <Input
        id="unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        placeholder="Например: A12"
      />
    </div>
    
    <div>
      <Label htmlFor="unit-label">Описание</Label>
      <Input
        id="unit-label"
        value={unitLabel}
        onChange={(e) => setUnitLabel(e.target.value)}
        placeholder="Например: Секция детских товаров"
      />
    </div>
  </div>
)}
```

**Save:**
- Include floor, unit, unitLabel in save payload
- Set `placeKind = UNIT` if isInsideComplex
- Set `placeKind = STANDALONE` otherwise

---

### SECTION 8: UX Structure 🔨

**Final Layout:**
```
┌─────────────────────────────────────┐
│ Поиск адреса или названия места     │
│ [autocomplete input]                │
├─────────────────────────────────────┤
│ Карта                               │
│ [map 320px height]                  │
│                                     │
│ ☑ Отметить вручную                  │
│   "Кликните по карте..."            │
├─────────────────────────────────────┤
│ Как найти (необязательно)           │
│ [textarea]                          │
├─────────────────────────────────────┤
│ ☑ Объект в ТЦ / комплексе           │
│   ├─ Этаж: [input]                  │
│   ├─ Павильон: [input]              │
│   └─ Описание: [input]              │
└─────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Update Autocomplete Types ✅
- Change `types: ["address"]` to `types: ["geocode", "establishment"]`
- Add `"name"` to fields
- Update placeholder text

### Step 2: Add Minsk Bias ✅
- Define MINSK_BOUNDS constant
- Apply bounds to autocomplete
- Keep strictBounds: false

### Step 3: Add Manual Mode UI 🔨
- Add Checkbox component
- Add manual mode state
- Add map click listener
- Add "Save Point" button
- Implement saveManualLocation function

### Step 4: Add "How to Find" Field 🔨
- Add Textarea component
- Add customAddressText state
- Include in save payloads

### Step 5: Add Complex/Mall Support 🔨
- Add Checkbox for "inside complex"
- Add floor, unit, unitLabel inputs
- Show/hide based on checkbox
- Include in save payloads

### Step 6: Update Save Functions 🔨
- Add customAddress to Google save
- Add floor/unit/unitLabel to both saves
- Set placeKind based on isInsideComplex

### Step 7: Testing ✅
- Test address search
- Test place name search
- Test manual point selection
- Test "how to find" field
- Test complex/mall fields
- Test Minsk bias
- Test Belarus-wide search

---

## API Payload Changes

### Google Location Save
```typescript
POST /api/business/places/[id]/location/google
{
  googlePlaceId: string,
  lat: number,
  lng: number,
  formattedAddr: string,
  addressJson: AddressComponentJSON[],
  customAddress?: string,      // NEW
  placeKind: "STANDALONE" | "UNIT",  // NEW
  floor?: string,              // NEW
  unit?: string,               // NEW
  unitLabel?: string,          // NEW
}
```

### Manual Location Save
```typescript
POST /api/business/places/[id]/location/manual
{
  lat: number,
  lng: number,
  customAddress?: string,
  placeKind: "STANDALONE" | "UNIT",
  floor?: string,
  unit?: string,
  unitLabel?: string,
}
```

---

## Completion Criteria

- [ ] Search finds addresses ✅
- [ ] Search finds place names ✅
- [ ] Minsk results prioritized ✅
- [ ] Can search all Belarus ✅
- [ ] Manual mode checkbox works
- [ ] Map clickable in manual mode
- [ ] Marker moves on map click
- [ ] "Save Point" button appears
- [ ] Manual save works
- [ ] "How to find" field saves
- [ ] Complex checkbox works
- [ ] Floor/unit fields appear
- [ ] Complex data saves correctly
- [ ] placeKind set correctly
- [ ] Coordinates precise (no rounding)
- [ ] googlePlaceId cleared in manual mode

---

**Date**: 2026-03-05  
**Status**: Planning Complete - Ready for Implementation  
**Estimated Lines**: ~200 new lines of code
