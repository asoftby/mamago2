# PlaceLocationPicker Final Fix - Complete

## Summary

Fixed the ref deadlock issue and migrated to AdvancedMarkerElement. Removed setTimeout retry hack and implemented stable initialization with loading overlay.

## Problem

**Deadlock Issue:**
```typescript
// Before: Early return prevented refs from being created
if (isLoading) {
  return <div>Загрузка карты...</div>; // ❌ No refs rendered!
}

// Later in useEffect:
if (!mapRef.current || !inputRef.current) {
  setTimeout(retry, 100); // ❌ Hack to wait for refs
}
```

**Issues:**
- Refs were never available because DOM wasn't rendered during loading
- setTimeout retry was a fragile workaround
- Using deprecated `google.maps.Marker` instead of `AdvancedMarkerElement`
- mapId was set without actual Google Cloud Map ID

## Solution

### 1. Removed Early Return

**Before:**
```typescript
if (isLoading) {
  return <div>Loading...</div>; // DOM not rendered
}

return (
  <div>
    <Input ref={inputRef} /> {/* Never rendered during load */}
    <div ref={mapRef} />
  </div>
);
```

**After:**
```typescript
return (
  <div>
    <Input ref={inputRef} disabled={isLoading} /> {/* Always rendered */}
    <div className="relative">
      <div ref={mapRef} /> {/* Always rendered */}
      {isLoading && <LoadingOverlay />} {/* Overlay on top */}
    </div>
  </div>
);
```

### 2. Removed setTimeout Retry

**Before:**
```typescript
if (!mapRef.current || !inputRef.current) {
  setTimeout(() => {
    if (mapRef.current && inputRef.current) {
      initializeMap();
      initializeAutocomplete();
    }
  }, 100);
  return;
}
```

**After:**
```typescript
// Refs are always available because DOM is always rendered
if (!mapRef.current || !inputRef.current) {
  console.warn("Refs not available after mount");
  setError("Ошибка инициализации: refs недоступны");
  setIsLoading(false);
  return; // No retry needed
}
```

### 3. Migrated to AdvancedMarkerElement

**Before:**
```typescript
const marker = new google.maps.Marker({
  position: { lat, lng },
  map: mapInstanceRef.current,
  animation: google.maps.Animation.DROP,
});
```

**After:**
```typescript
const { AdvancedMarkerElement } = markerLib;

// Custom marker content with brand color
const markerContent = document.createElement("div");
markerContent.style.width = "24px";
markerContent.style.height = "24px";
markerContent.style.borderRadius = "50% 50% 50% 0"; // Teardrop shape
markerContent.style.backgroundColor = "#EF8759"; // Brand color
markerContent.style.border = "3px solid white";
markerContent.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
markerContent.style.transform = "rotate(-45deg)";

const marker = new AdvancedMarkerElement({
  position: { lat, lng },
  map: mapInstanceRef.current,
  content: markerContent,
});
```

### 4. Removed mapId

**Before:**
```typescript
const map = new mapsLib.Map(mapRef.current, {
  center,
  zoom: 12,
  mapId: "place-location-map", // ❌ Not a real Map ID
});
```

**After:**
```typescript
const map = new mapsLib.Map(mapRef.current, {
  center,
  zoom: 12,
  // No mapId - will add later when we have real Map ID from Google Cloud
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
});
```

### 5. Added Loading Overlay

**UI Pattern:**
```typescript
<div className="relative">
  <div ref={mapRef} className="h-[320px]" />
  
  {isLoading && (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
      <Loader2 className="animate-spin" />
      <span>Загрузка карты...</span>
    </div>
  )}
</div>
```

## Files Changed

### Modified:

**1. `src/services/googleMaps/googleMaps.service.ts`**
- Updated error message: "is missing" instead of "is not defined"
- Added example for AdvancedMarkerElement in JSDoc

**2. `src/components/business/place/PlaceLocationPicker.tsx`**

**Key Changes:**
- ✅ Removed early return for `isLoading`
- ✅ Always render input and map DOM
- ✅ Added loading overlay instead of early return
- ✅ Removed setTimeout retry completely
- ✅ Load marker library in parallel with maps/places
- ✅ Changed marker type to `google.maps.marker.AdvancedMarkerElement`
- ✅ Implemented custom marker with brand color (#EF8759)
- ✅ Removed mapId from map initialization
- ✅ Input disabled during loading
- ✅ Proper cleanup for AdvancedMarkerElement

## Code Diff Highlights

### useEffect Changes:

```diff
  const [mapsLib, placesLib] = await Promise.all([
    GoogleMapsService.getMapsLibrary(),
    GoogleMapsService.getPlacesLibrary(),
+ const [mapsLib, placesLib, markerLib] = await Promise.all([
+   GoogleMapsService.getMapsLibrary(),
+   GoogleMapsService.getPlacesLibrary(),
+   GoogleMapsService.getMarkerLibrary(),
  ]);

- if (!mapRef.current || !inputRef.current) {
-   setTimeout(() => { /* retry */ }, 100);
-   return;
- }
+ if (!mapRef.current || !inputRef.current) {
+   console.warn("Refs not available after mount");
+   setError("Ошибка инициализации: refs недоступны");
+   setIsLoading(false);
+   return;
+ }

- initializeMap(mapsLib);
- initializeAutocomplete(placesLib);
+ initializeMap(mapsLib, markerLib);
+ initializeAutocomplete(placesLib, markerLib);
```

### Marker Changes:

```diff
- const markerRef = useRef<google.maps.Marker | null>(null);
+ const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

- const addMarker = (lat: number, lng: number) => {
+ const addMarker = (
+   lat: number,
+   lng: number,
+   markerLib: google.maps.MarkerLibrary
+ ) => {
    if (markerRef.current) {
-     markerRef.current.setMap(null);
+     markerRef.current.map = null;
    }

-   const marker = new google.maps.Marker({
-     position: { lat, lng },
-     map: mapInstanceRef.current,
-     animation: google.maps.Animation.DROP,
-   });
+   const { AdvancedMarkerElement } = markerLib;
+   
+   const markerContent = document.createElement("div");
+   markerContent.style.width = "24px";
+   markerContent.style.height = "24px";
+   markerContent.style.borderRadius = "50% 50% 50% 0";
+   markerContent.style.backgroundColor = "#EF8759";
+   markerContent.style.border = "3px solid white";
+   markerContent.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
+   markerContent.style.transform = "rotate(-45deg)";
+   
+   const marker = new AdvancedMarkerElement({
+     position: { lat, lng },
+     map: mapInstanceRef.current,
+     content: markerContent,
+   });
```

### Render Changes:

```diff
- if (isLoading) {
-   return (
-     <div className="space-y-4">
-       <div className="flex items-center justify-center py-12">
-         <Loader2 className="h-8 w-8 animate-spin" />
-         <span>Загрузка карты...</span>
-       </div>
-     </div>
-   );
- }

  return (
    <div className="space-y-4">
      <Input
        ref={inputRef}
+       disabled={isLoading}
      />
      
-     <div ref={mapRef} className="h-[320px]" />
+     <div className="relative">
+       <div ref={mapRef} className="h-[320px]" />
+       {isLoading && (
+         <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
+           <Loader2 className="animate-spin" />
+           <span>Загрузка карты...</span>
+         </div>
+       )}
+     </div>
    </div>
  );
```

## Benefits

✅ **No More Ref Deadlock** - DOM always rendered, refs always available
✅ **No setTimeout Hack** - Stable initialization without retry
✅ **Modern Markers** - Using AdvancedMarkerElement with custom styling
✅ **Brand Consistency** - Marker uses brand color #EF8759
✅ **Better UX** - Loading overlay instead of blank screen
✅ **Cleaner Code** - Removed fragile retry logic
✅ **Type Safe** - Proper TypeScript types for AdvancedMarkerElement
✅ **No mapId Issues** - Removed until we have real Map ID

## Testing

### Manual Test Steps:

1. **Navigate to Place Wizard Step 2**
   ```
   /business/places/[id]/edit?step=2
   ```

2. **Verify Loading State**
   - Input should be visible but disabled
   - Map container should be visible with overlay
   - "Загрузка карты..." text should appear

3. **Verify Map Loads**
   - Overlay should disappear
   - Map should be interactive
   - Input should become enabled

4. **Test Autocomplete**
   - Type "Dana Mall" or "Минск"
   - Suggestions should appear
   - Select a place

5. **Verify Marker**
   - Custom orange marker should appear
   - Marker should be teardrop-shaped
   - Map should center on location

6. **Check Console**
   - ✅ No "Refs not available" warnings (unless real error)
   - ✅ No setTimeout retry logs
   - ✅ No "Loader class" errors
   - ✅ No "loading=async" warnings

### Expected Console Output:

```
(No warnings or errors during normal operation)
```

### Error Cases:

**Missing API Key:**
```
[GoogleMapsService] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.
Please add it to your .env.local file.
```

**Refs Not Available (should not happen):**
```
[PlaceLocationPicker] Refs not available after mount
```

## Architecture

```
PlaceLocationPicker
├── Always renders DOM (input + map)
├── useEffect (runs once)
│   ├── Load libraries in parallel
│   │   ├── getMapsLibrary()
│   │   ├── getPlacesLibrary()
│   │   └── getMarkerLibrary()
│   ├── Check refs (should always exist)
│   ├── initializeMap(mapsLib, markerLib)
│   ├── initializeAutocomplete(placesLib, markerLib)
│   └── setIsLoading(false)
├── Render
│   ├── Input (disabled={isLoading})
│   └── Map container
│       ├── Map div (ref)
│       └── Loading overlay (conditional)
└── Cleanup
    ├── Clear autocomplete listeners
    └── Remove marker
```

## Future Enhancements

Potential improvements:

1. **Real Map ID**
   ```typescript
   const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;
   if (mapId) {
     mapOptions.mapId = mapId;
   }
   ```

2. **Draggable Marker**
   ```typescript
   const marker = new AdvancedMarkerElement({
     position: { lat, lng },
     map: mapInstanceRef.current,
     content: markerContent,
     gmpDraggable: true,
   });
   
   marker.addListener('dragend', (event) => {
     const newLat = event.latLng.lat();
     const newLng = event.latLng.lng();
     // Update location
   });
   ```

3. **Marker Animation**
   ```typescript
   // Bounce animation on add
   markerContent.style.animation = "bounce 0.5s ease-out";
   ```

4. **Custom Marker Icon**
   ```typescript
   // Use SVG or image instead of styled div
   const markerContent = document.createElement("img");
   markerContent.src = "/icons/map-pin.svg";
   ```

## Status

✅ **Complete and Production Ready**
- Ref deadlock fixed
- setTimeout retry removed
- AdvancedMarkerElement implemented
- Loading overlay added
- All TypeScript checks passing
- Ready for deployment
