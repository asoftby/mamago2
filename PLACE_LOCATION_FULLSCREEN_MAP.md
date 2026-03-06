# Place Location - Fullscreen Map UX

## Summary

Simplified location selection UX with fullscreen map experience:
- Renamed button to "Выбрать точку на карте"
- Fullscreen map (100vh) with click-to-place pin
- Pulsing pin marker
- Large X close button (top right)
- ESC key to close
- Auto-save coordinates on close
- Updated mini map preview with "Изменить точку" button

## Changes Made

### 1. PlaceMapModal - Fullscreen Experience

**Before**: Dialog modal with header, footer, and buttons
**After**: Fullscreen overlay (100vh) with minimal UI

**Key Changes**:
- Removed Dialog component wrapper
- Changed to `fixed inset-0 z-50 bg-white` (fullscreen)
- Added large X close button (top-right, absolute positioned)
- Moved search input to top-left with shadow
- Map fills entire screen
- Removed "Отмена" and "Сохранить точку" buttons
- Auto-saves on close (ESC or X button)

**UI Structure**:
```
┌─────────────────────────────────────┐
│ [Search Input]              [X]     │ ← Top bar
│                                     │
│                                     │
│         [Fullscreen Map]            │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Features**:
- ESC key handler: closes modal and saves coordinates
- X button: same behavior as ESC
- Click anywhere on map: places pulsing pin
- Search autocomplete: places pin at selected location
- No explicit "save" button - saves automatically on close

### 2. PlaceLocationPicker - Simplified UI

**Removed**:
- "Отметить местоположение вручную" text
- Manual mode toggle state
- Coordinate input fields (read-only lat/lng display)
- Conditional rendering based on manual mode

**Added**:
- "Выбрать точку на карте" button (always visible)
- Conditional map preview (only shows when location is set)
- "Изменить точку" button below preview
- Display text: "Выбрано: {address or coordinates}"

**UI Flow**:
```
1. Initial State (no location):
┌─────────────────────────────────────┐
│ Адрес или название места            │
│ [🔍 Search Input]                   │
│ Выбрать точку на карте              │
└─────────────────────────────────────┘

2. After Location Selected:
┌─────────────────────────────────────┐
│ Адрес или название места            │
│ [🔍 Search Input]                   │
│ Выбрать точку на карте              │
├─────────────────────────────────────┤
│ Выбранное местоположение            │
│ [Preview Map with Pin]              │
│ Выбрано: ул. Ленина, 1             │
│ [Изменить точку]                    │
└─────────────────────────────────────┘
```

### 3. Coordinate Handling

**Internal State Only**:
- Coordinates stored in `currentLat`, `currentLng`
- Not displayed as form inputs
- Used for:
  - Map centering
  - API save calls
  - Display text (fallback if no address)

**Display Logic**:
```typescript
// Show address if available, otherwise show coordinates
currentFormattedAddr || `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`
```

## User Experience

### Opening Map
1. User clicks "Выбрать точку на карте"
2. Fullscreen map opens instantly
3. Map shows current location (if set) or default (Minsk)
4. Search input visible at top-left
5. X button visible at top-right

### Selecting Location
**Option A: Search**
1. User types in search input
2. Autocomplete shows suggestions
3. User selects suggestion
4. Pin appears at location with pulse animation
5. Map centers on pin

**Option B: Click**
1. User clicks anywhere on map
2. Pin appears at click location with pulse animation
3. Coordinates updated in state

### Closing Map
**Option A: ESC Key**
1. User presses ESC
2. Modal closes
3. Coordinates auto-saved
4. Preview map updates
5. "Выбрано: ..." text appears

**Option B: X Button**
1. User clicks X button
2. Same behavior as ESC

### Changing Location
1. User clicks "Изменить точку" button
2. Fullscreen map opens with current pin
3. User can move pin by clicking new location
4. Close to save new coordinates

## Technical Implementation

### ESC Key Handler
```typescript
useEffect(() => {
  if (isOpen) {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }
}, [isOpen]);
```

### Auto-Save on Close
```typescript
const handleClose = () => {
  // Save coordinates on close
  if (lat !== null && lng !== null) {
    onSave({
      lat,
      lng,
      googlePlaceId: googlePlaceId || undefined,
      formattedAddr: formattedAddr || undefined,
      addressJson: addressJson.length > 0 ? addressJson : undefined,
    });
  }
  onClose();
};
```

### Fullscreen Styling
```tsx
<div className="fixed inset-0 z-50 bg-white">
  {/* Close Button */}
  <button className="absolute top-4 right-4 z-10 ...">
    <X className="h-6 w-6" />
  </button>
  
  {/* Search */}
  <div className="absolute top-4 left-4 right-20 z-10 ...">
    <Input ... />
  </div>
  
  {/* Map */}
  <div ref={mapRef} className="w-full h-full" />
</div>
```

### Pulsing Pin
Uses existing `animate-mg-pulse` animation from globals.css:
```html
<div class="absolute ... animate-mg-pulse"></div>
```

## Benefits

### UX Improvements
- **Simpler**: One button instead of toggle mode
- **Clearer**: Fullscreen map is more immersive
- **Faster**: No explicit save button, auto-saves on close
- **Intuitive**: ESC key works as expected
- **Clean**: No coordinate fields cluttering UI
- **Consistent**: Same interaction for search and click

### Technical Improvements
- **Less state**: Removed `manualMode` toggle
- **Simpler logic**: No conditional rendering for modes
- **Better UX**: Fullscreen provides more space for map interaction
- **Keyboard accessible**: ESC key support
- **Auto-save**: No need to remember to click save

## Files Modified

1. `src/components/business/place/PlaceMapModal.tsx`
   - Removed Dialog wrapper
   - Added fullscreen layout
   - Added X close button
   - Added ESC key handler
   - Removed save/cancel buttons
   - Auto-save on close

2. `src/components/business/place/PlaceLocationPicker.tsx`
   - Renamed button to "Выбрать точку на карте"
   - Removed manual mode toggle
   - Removed coordinate input fields
   - Added conditional preview display
   - Added "Изменить точку" button
   - Simplified state management

## Testing Checklist

- [ ] "Выбрать точку на карте" button opens fullscreen map
- [ ] Map fills entire screen (100vh)
- [ ] X button visible in top-right
- [ ] X button closes map and saves coordinates
- [ ] ESC key closes map and saves coordinates
- [ ] Search input works in fullscreen map
- [ ] Click on map places pin
- [ ] Pin has pulse animation
- [ ] Preview map shows after location selected
- [ ] "Выбрано: ..." text displays correctly
- [ ] "Изменить точку" button reopens map
- [ ] Coordinates saved internally (not displayed as inputs)
- [ ] No console errors
- [ ] No TypeScript errors

## Before vs After

### Before (Complex)
```
Search Input
↓
"Отметить местоположение вручную" link
↓
Manual mode toggle
↓
Coordinate input fields (lat/lng)
↓
Preview map
↓
"Открыть карту" button
↓
Dialog modal with header/footer
↓
"Сохранить точку" button required
```

### After (Simple)
```
Search Input
↓
"Выбрать точку на карте" button
↓
Fullscreen map (ESC or X to close)
↓
Auto-save on close
↓
Preview map appears
↓
"Изменить точку" button
```

## Status

✅ Fullscreen map implemented
✅ X close button added
✅ ESC key handler added
✅ Auto-save on close
✅ Button renamed to "Выбрать точку на карте"
✅ Coordinate inputs removed
✅ Manual mode toggle removed
✅ Preview with "Изменить точку" button
✅ TypeScript errors fixed
⏳ Browser testing pending
