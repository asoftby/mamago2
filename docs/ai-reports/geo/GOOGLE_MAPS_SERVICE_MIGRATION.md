# Google Maps Service Migration - Complete

## Summary

Migrated from deprecated `new Loader()` API to the new `setOptions/importLibrary` API from `@googlemaps/js-api-loader`. Created a centralized singleton service for all Google Maps functionality.

## Problem

**Error:**
```
@googlemaps/js-api-loader: The Loader class is no longer available in this version. 
Please use setOptions() and importLibrary().
```

**Issues:**
- Using deprecated `new Loader()` API
- Multiple script injections causing race conditions
- No centralized Google Maps management
- Risk of double-loading the API

## Solution

### 1. Created Google Maps Service

**Files Created:**
- `src/services/googleMaps/googleMaps.service.ts` - Core service implementation
- `src/services/googleMaps/index.ts` - Public exports

**Architecture:**
```typescript
class GoogleMapsServiceClass {
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  // Ensures Google Maps is initialized once
  private async ensureInitialized(): Promise<void> {
    // Uses setOptions() with singleton pattern
  }

  // Library getters
  async getMapsLibrary(): Promise<google.maps.MapsLibrary>
  async getPlacesLibrary(): Promise<google.maps.PlacesLibrary>
  async getMarkerLibrary(): Promise<google.maps.MarkerLibrary>
  async getGeocodingLibrary(): Promise<google.maps.GeocodingLibrary>
}

export const GoogleMapsService = new GoogleMapsServiceClass();
```

**Key Features:**
- ✅ Singleton pattern - one initialization for entire app
- ✅ Uses new `setOptions()` and `importLibrary()` API
- ✅ SSR-safe - throws clear error if used on server
- ✅ Lazy loading - only loads when first requested
- ✅ Type-safe - full TypeScript support
- ✅ Error handling - clear messages for missing API key
- ✅ Retry support - resets on error for retry attempts

### 2. Updated PlaceLocationPicker

**File:** `src/components/business/place/PlaceLocationPicker.tsx`

**Changes:**

**Before:**
```typescript
import { googleMapsLoader } from "@/lib/google-maps-loader";

// In useEffect
await googleMapsLoader.load();
const map = new google.maps.Map(...);
const autocomplete = new google.maps.places.Autocomplete(...);
```

**After:**
```typescript
import { GoogleMapsService } from "@/services/googleMaps";

// In useEffect
const [mapsLib, placesLib] = await Promise.all([
  GoogleMapsService.getMapsLibrary(),
  GoogleMapsService.getPlacesLibrary(),
]);

const map = new mapsLib.Map(...);
const autocomplete = new placesLib.Autocomplete(...);
```

**Benefits:**
- Explicit library imports
- Better tree-shaking
- Type-safe library access
- No global `google` namespace pollution

### 3. Removed Old Loader

**Deleted:**
- `src/lib/google-maps-loader.ts` - Old loader using deprecated `new Loader()` API

## API Usage

### Basic Usage

```typescript
import { GoogleMapsService } from '@/services/googleMaps';

// In a client component
const initMap = async () => {
  try {
    // Load maps library
    const mapsLib = await GoogleMapsService.getMapsLibrary();
    
    // Create map
    const map = new mapsLib.Map(element, {
      center: { lat: 53.9, lng: 27.5 },
      zoom: 12,
    });
  } catch (error) {
    console.error('Failed to load Google Maps:', error);
  }
};
```

### With Autocomplete

```typescript
const initAutocomplete = async () => {
  const placesLib = await GoogleMapsService.getPlacesLibrary();
  
  const autocomplete = new placesLib.Autocomplete(inputElement, {
    fields: ['place_id', 'geometry', 'formatted_address'],
    componentRestrictions: { country: 'by' },
  });
  
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    // Handle place selection
  });
};
```

### Multiple Libraries

```typescript
const [mapsLib, placesLib, markerLib] = await Promise.all([
  GoogleMapsService.getMapsLibrary(),
  GoogleMapsService.getPlacesLibrary(),
  GoogleMapsService.getMarkerLibrary(),
]);
```

## Configuration

### Environment Variable

Required in `.env.local`:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Error Messages

**Missing API Key:**
```
[GoogleMapsService] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not defined. 
Please add it to your .env.local file.
```

**Server-Side Usage:**
```
[GoogleMapsService] Google Maps can only be loaded in the browser
```

## Files Changed

### Created:
1. ✅ `src/services/googleMaps/googleMaps.service.ts` - Service implementation
2. ✅ `src/services/googleMaps/index.ts` - Public exports

### Modified:
1. ✅ `src/components/business/place/PlaceLocationPicker.tsx` - Updated to use service

### Deleted:
1. ✅ `src/lib/google-maps-loader.ts` - Old deprecated loader

## Migration Checklist

- [x] Created GoogleMapsService with new API
- [x] Updated PlaceLocationPicker to use service
- [x] Removed old loader
- [x] Added proper TypeScript types
- [x] Added SSR protection
- [x] Added error handling
- [x] Tested initialization flow
- [x] Verified no "Loader class" error
- [x] Verified no "loading=async" warning

## Testing

### Manual Test Steps:

1. **Open Place Wizard Step 2 (Location)**
   - Navigate to `/business/places/[id]/edit?step=2`

2. **Verify Map Loads**
   - Map should display correctly
   - No console errors

3. **Test Autocomplete**
   - Type in search input
   - Suggestions should appear
   - Select a place
   - Marker should appear on map

4. **Check Console**
   - ✅ No "Loader class is no longer available" error
   - ✅ No "loaded directly without loading=async" warning
   - ✅ No "ref is not available" warnings

5. **Test Error Handling**
   - Remove API key from `.env.local`
   - Reload page
   - Should see clear error message

### Expected Console Output:

```
[PlaceLocationPicker] Refs not available, retrying... (if refs not ready)
[PlaceLocationPicker] Place has no geometry (if invalid place selected)
[PlaceLocationPicker] Save location error: ... (if save fails)
```

## Benefits

✅ **No Deprecation Warnings** - Uses latest API
✅ **Centralized Management** - Single source of truth
✅ **Type Safety** - Full TypeScript support
✅ **Better Performance** - Lazy loading, singleton pattern
✅ **Easier Maintenance** - One place to update
✅ **Reusable** - Can be used in any component
✅ **SSR Safe** - Clear error messages
✅ **Better DX** - Explicit library imports

## Future Enhancements

Potential additions to the service:

```typescript
// Geocoding
async geocodeAddress(address: string): Promise<google.maps.GeocoderResult[]>

// Reverse geocoding
async reverseGeocode(lat: number, lng: number): Promise<google.maps.GeocoderResult[]>

// Distance matrix
async getDistanceMatrix(origins: string[], destinations: string[]): Promise<google.maps.DistanceMatrixResponse>

// Directions
async getDirections(origin: string, destination: string): Promise<google.maps.DirectionsResult>
```

## Dependencies

- `@googlemaps/js-api-loader` v2.0.2 (already installed)
- `@types/google.maps` v3.58.1 (already installed)

## Status

✅ **Complete and Production Ready**
- All code migrated to new API
- No breaking changes to UX
- Fully typed and tested
- Ready for deployment
