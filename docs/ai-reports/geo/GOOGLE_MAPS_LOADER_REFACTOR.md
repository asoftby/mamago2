# Google Maps Loader Refactor - Complete

## Summary

Полностью переработана интеграция Google Maps API для устранения предупреждений "loaded directly without loading=async" и стабилизации инициализации карты и Autocomplete.

## Problem

**Симптомы:**
- Warning в консоли: "Google Maps JavaScript API has been loaded directly without loading=async"
- Предупреждения: "Map ref is not available" и "Input ref is not available"
- Нестабильная инициализация карты и автокомплита
- Множественные загрузки скрипта Google Maps

**Причины:**
- Ручная загрузка Google Maps через `<script>` в компоненте
- Отсутствие singleton pattern для loader
- Input компонент не поддерживал forwardRef
- Отсутствие проверок на unmount компонента

## Solution

### 1. Создан Singleton Google Maps Loader

**Файл:** `src/lib/google-maps-loader.ts`

```typescript
class GoogleMapsLoader {
  private loader: Loader | null = null;
  private loadPromise: Promise<typeof google> | null = null;

  async load(): Promise<typeof google> {
    // Returns same promise for all calls (singleton)
  }
}

export const googleMapsLoader = new GoogleMapsLoader();
```

**Особенности:**
- Единственный экземпляр на весь проект
- Использует `@googlemaps/js-api-loader`
- Конфигурация: `version: "weekly"`, `libraries: ["places"]`
- Повторные вызовы `load()` возвращают тот же Promise
- Автоматическая обработка ошибок с возможностью retry

### 2. Исправлен Input Component

**Файл:** `src/components/ui/input.tsx`

**Изменения:**
- Добавлен `React.forwardRef` для поддержки ref
- Добавлен `displayName = "Input"`
- Теперь ref корректно передается на нативный `<input>`

**До:**
```typescript
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input ... />
}
```

**После:**
```typescript
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return <input ref={ref} ... />
  }
)
```

### 3. Переработан PlaceLocationPicker

**Файл:** `src/components/business/place/PlaceLocationPicker.tsx`

**Ключевые изменения:**

1. **Использование singleton loader:**
   ```typescript
   await googleMapsLoader.load();
   ```

2. **Защита от повторной инициализации:**
   ```typescript
   const mapInstanceRef = useRef<google.maps.Map | null>(null);
   const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
   
   if (mapInstanceRef.current) return; // Already initialized
   ```

3. **Защита от setState после unmount:**
   ```typescript
   const isCancelledRef = useRef(false);
   
   useEffect(() => {
     return () => {
       isCancelledRef.current = true;
     };
   }, []);
   
   if (isCancelledRef.current) return; // Don't update state
   ```

4. **Retry механизм для refs:**
   ```typescript
   if (!mapRef.current || !inputRef.current) {
     setTimeout(() => {
       if (!isCancelledRef.current && mapRef.current && inputRef.current) {
         initializeMap();
         initializeAutocomplete();
       }
     }, 100);
   }
   ```

5. **Cleanup listeners:**
   ```typescript
   return () => {
     isCancelledRef.current = true;
     if (autocompleteRef.current) {
       google.maps.event.clearInstanceListeners(autocompleteRef.current);
     }
   };
   ```

6. **Улучшенное логирование:**
   - Префикс `[PlaceLocationPicker]` для всех логов
   - Логи на каждом этапе инициализации
   - Детальные ошибки с контекстом

## Files Changed

### Created:
1. `src/lib/google-maps-loader.ts` - Singleton Google Maps loader

### Modified:
1. `src/components/ui/input.tsx` - Added forwardRef support
2. `src/components/business/place/PlaceLocationPicker.tsx` - Complete refactor

## Benefits

✅ **No more "loading=async" warning** - Using official @googlemaps/js-api-loader
✅ **Stable initialization** - Singleton pattern prevents multiple loads
✅ **No ref warnings** - Proper forwardRef + retry mechanism
✅ **Memory leak prevention** - Cleanup listeners + cancelled flag
✅ **Better error handling** - Detailed logging with context
✅ **Reusable** - googleMapsLoader can be used in other components

## Testing Checklist

- [ ] Open Place wizard, navigate to Step 2 (Location)
- [ ] Verify map is displayed correctly
- [ ] Type in autocomplete input, verify suggestions appear
- [ ] Select a place, verify marker appears on map
- [ ] Check console - no "loading=async" warning
- [ ] Check console - no "ref is not available" warnings
- [ ] Refresh page, verify everything still works
- [ ] Navigate away and back, verify no memory leaks

## Console Output (Expected)

```
[GoogleMapsLoader] API loaded successfully
[PlaceLocationPicker] Initializing map...
[PlaceLocationPicker] Map initialized successfully
[PlaceLocationPicker] Initializing autocomplete...
[PlaceLocationPicker] Autocomplete initialized successfully
[PlaceLocationPicker] Place selected: { lat: 53.9, lng: 27.5, ... }
```

## Migration Guide

If you need to use Google Maps in other components:

```typescript
import { googleMapsLoader } from "@/lib/google-maps-loader";

// In your component
useEffect(() => {
  const init = async () => {
    await googleMapsLoader.load();
    // Now google.maps is available
    const map = new google.maps.Map(mapRef.current, { ... });
  };
  
  init();
}, []);
```

## Dependencies

- `@googlemaps/js-api-loader` - Already installed (v2.0.2)
- `@types/google.maps` - Already installed (v3.58.1)

## Environment Variables

Required:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Status

✅ Complete and ready for testing
✅ All TypeScript checks passing
✅ No breaking changes to UX
✅ Backward compatible with existing code
