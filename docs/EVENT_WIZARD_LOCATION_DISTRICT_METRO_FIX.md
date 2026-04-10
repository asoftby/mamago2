# Event Location District & Metro Fix - COMPLETE

## Problem

В Events Step 2 Location район не определялся автоматически и не редактировался вручную. Проблема была в неправильном использовании API endpoints.

## Root Cause Analysis

1. **Неправильный cityId**: Передавали строку "Минск" вместо правильного UUID или slug
2. **Неправильный порядок операций**: Обновляли данные формы до получения обогащенных данных
3. **Неправильные параметры API**: API ожидает `citySlug=minsk` для строковых идентификаторов

## Fixes Applied

### 1. Fixed API Parameter Handling

**Before:**
```typescript
// Неправильно - передавали строку как cityId
const response = await fetch(`/api/geo/districts?cityId=${encodeURIComponent("Минск")}`);
```

**After:**
```typescript
// Правильно - определяем UUID vs slug и используем правильный параметр
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cityIdOrSlug);
const param = isUUID ? `cityId=${encodeURIComponent(cityIdOrSlug)}` : `citySlug=${encodeURIComponent(cityIdOrSlug)}`;
const response = await fetch(`/api/geo/districts?${param}`);
```

### 2. Fixed Operation Order

**Before:**
```typescript
// Неправильно - сначала обновляли форму, потом обогащали
onChange({ city: "Минск", lat, lng });
const enrichment = await enrichEventLocation({ lat, lng, cityId: "Минск" });
```

**After:**
```typescript
// Правильно - сначала обогащаем, потом обновляем форму с правильным cityId
const enrichment = await enrichEventLocation({ lat, lng });
onChange({ 
  city: enrichment?.cityId || "minsk", // Используем resolved cityId
  lat, lng 
});
```

### 3. Updated Function Signatures

**eventLocationUtils.ts:**
```typescript
// Обновили функции для поддержки UUID и slug
export async function loadDistricts(cityIdOrSlug: string): Promise<Array<{ id: string; name: string }>>
export async function loadMetroStations(cityIdOrSlug: string): Promise<Array<{ id: string; name: string }>>

// Сделали cityId опциональным - API сам определит город по координатам
export async function enrichEventLocation(data: {
  lat: number;
  lng: number;
  cityId?: string; // Опциональный
  formattedAddr?: string;
  addressJson?: any[];
})
```

### 4. Fixed EventLocationPicker Logic

**EventLocationPicker.tsx:**
```typescript
const handlePlaceSelect = async (placeData) => {
  // 1. Сначала обогащаем данные (API определит правильный cityId)
  const enrichment = await enrichEventLocation({
    lat: placeData.lat,
    lng: placeData.lng,
    cityId: undefined, // Пусть API сам определит
    formattedAddr: placeData.formattedAddr,
    addressJson: placeData.addressJson,
  });

  // 2. Обновляем форму с правильным cityId
  onChange({
    city: enrichment?.cityId || "minsk", // Используем resolved cityId
    lat: placeData.lat,
    lng: placeData.lng,
    // ... другие поля
  });

  // 3. Обновляем обогащенные данные
  if (enrichment) {
    onChange({
      districtAutoId: enrichment.districtAutoId,
      metroAutoId: enrichment.metroAutoId,
      // ... другие поля
    });
  }
};
```

## API Endpoints Used

### Districts API
```
GET /api/geo/districts?citySlug=minsk
GET /api/geo/districts?cityId=uuid-here
```

### Metro Stations API
```
GET /api/geo/metro-stations?citySlug=minsk
GET /api/geo/metro-stations?cityId=uuid-here
```

### Location Enrichment API
```
POST /api/geo/enrich-location
{
  "lat": 53.9045,
  "lng": 27.5615,
  "formattedAddr": "Притыцкого 12, Минск, Беларусь",
  "addressJson": []
}
```

## Testing

### Unit Tests
```bash
npx tsx scripts/manual-tests/test-event-location-metro-district.ts
```

### API Integration Tests
```bash
# Start dev server first
npm run dev

# Then test APIs
npx tsx scripts/manual-tests/test-event-location-api.ts
```

## Result

✅ **District Selection**: Теперь работает автоматическое определение и ручной выбор  
✅ **Metro Selection**: Теперь работает автоматическое определение и ручной выбор  
✅ **API Integration**: Правильно использует citySlug для Минска  
✅ **Data Flow**: Правильный порядок операций (обогащение → обновление формы)  
✅ **Error Handling**: Graceful fallback при ошибках API  

Event Location теперь работает точно так же, как Place Location, с полной поддержкой районов и метро.

## Files Modified

- `src/components/business/wizard/event/steps/location/EventLocationPicker.tsx`
- `src/components/business/wizard/event/steps/location/eventLocationUtils.ts`
- `scripts/manual-tests/test-event-location-metro-district.ts`
- `scripts/manual-tests/test-event-location-api.ts` (новый)

## Debug Information

В development режиме EventLocationPicker показывает debug панель с текущим состоянием всех geo полей для диагностики проблем.