# Place Location Picker - Preview + Modal Refactor Complete

## Summary

Successfully refactored PlaceLocationPicker to use a preview map + fullscreen modal architecture for better UX. The inline map with complex controls has been replaced with a simple preview and a dedicated modal for all map interactions.

## Changes Made

### 1. Created Tabs Component
- **File**: `src/components/ui/tabs.tsx`
- **Package**: Installed `@radix-ui/react-tabs@1.1.13`
- Shadcn-style tabs component for mode selection in modal

### 2. Fixed PlaceMapModal Component
- **File**: `src/components/business/place/PlaceMapModal.tsx`
- Fixed TypeScript type errors (marker cleanup logic)
- Fixed tabs onValueChange type annotation
- Two modes: "auto" (Google autocomplete) and "manual" (click on map)
- Fullscreen/large modal with interactive map
- Save/Cancel buttons at bottom
- Shows coordinates when point selected

### 3. Fixed PlaceMapPreview Component
- **File**: `src/components/business/place/PlaceMapPreview.tsx`
- Fixed marker cleanup logic (setMap vs map property)
- Small preview map (280px height)
- Disabled all controls (gestureHandling="none")
- Shows pulsing marker if location set
- Single "Открыть карту" button to open modal

### 4. Refactored PlaceLocationPicker
- **File**: `src/components/business/place/PlaceLocationPicker.tsx`
- Removed all inline map code (Google Maps initialization, autocomplete, markers, etc.)
- Removed old state variables (isLoading, query, selectedAddress, etc.)
- Simplified to use PlaceMapPreview + PlaceMapModal components
- Added `handleMapSave` callback that:
  - Determines endpoint based on googlePlaceId presence
  - Calls `/location/google` for auto mode
  - Calls `/location/manual` for manual mode
  - Updates local state (currentLat, currentLng, currentFormattedAddr)
- Removed center pin overlay (now in modal)
- Removed MAP scenario inline controls (now in modal)
- Clean separation: preview for display, modal for interaction

### 5. Fixed API Route
- **File**: `src/app/api/business/places/[id]/location/manual/route.ts`
- Updated params type to `Promise<{ id: string }>` for Next.js 16 compatibility

## Architecture

```
PlaceLocationPicker (container)
├── PlaceMapPreview (display only)
│   ├── Small map (280px)
│   ├── No controls
│   ├── Pulsing marker if location set
│   └── "Открыть карту" button
│
└── PlaceMapModal (interaction)
    ├── Fullscreen/large modal
    ├── Tabs: Auto / Manual
    ├── Auto mode: Google autocomplete search
    ├── Manual mode: Click on map
    ├── Shows coordinates
    └── Save / Cancel buttons
```

## User Flow

1. User sees small preview map with current location (if set)
2. User clicks "Открыть карту" button
3. Modal opens with full interactive map
4. User chooses mode:
   - **Auto**: Search for address/place via Google autocomplete
   - **Manual**: Click on map to set point
5. User clicks "Сохранить точку"
6. Modal closes, preview updates with new location
7. Data saved to appropriate endpoint:
   - Auto mode → `/location/google` (with googlePlaceId)
   - Manual mode → `/location/manual` (without googlePlaceId)

## Benefits

- **Cleaner UI**: Preview map is simple and uncluttered
- **Better UX**: Full modal provides space for map interaction
- **Lazy Loading**: Modal map only loads when opened
- **Clear Modes**: Tabs make auto/manual distinction obvious
- **Maintainable**: Separation of concerns (preview vs interaction)
- **Performance**: No heavy map initialization on every render

## Files Modified

1. `src/components/ui/tabs.tsx` (created)
2. `src/components/business/place/PlaceMapPreview.tsx` (fixed)
3. `src/components/business/place/PlaceMapModal.tsx` (fixed)
4. `src/components/business/place/PlaceLocationPicker.tsx` (refactored)
5. `src/app/api/business/places/[id]/location/manual/route.ts` (fixed)

## Testing Checklist

- [ ] Preview map shows current location if set
- [ ] Preview map shows default (Minsk) if no location
- [ ] "Открыть карту" button opens modal
- [ ] Modal auto mode: search works, marker appears
- [ ] Modal manual mode: click sets marker
- [ ] Coordinates display correctly
- [ ] Save button calls correct endpoint
- [ ] Preview updates after save
- [ ] Modal closes after save
- [ ] No console errors
- [ ] No TypeScript errors

## Next Steps

- Test in browser to ensure all interactions work
- Verify API calls are successful
- Check that preview updates correctly after save
- Ensure modal lazy loads map (performance)
- Test on mobile (responsive)

## Status

✅ Implementation complete
✅ TypeScript errors fixed
✅ API routes compatible with Next.js 16
⏳ Browser testing pending
