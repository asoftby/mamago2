# Event Location CUID Detection Fix - COMPLETE

## Problem

Event Location показывал ошибки 404 с сообщением:
```
[loadDistricts] Error details: {"error":"City not found: cmmj3p3uh0011ws3mmxhskmsf"}
[loadMetroStations] Error details: {"error":"City not found: cmmj3p3uh0011ws3mmxhskmsf"}
```

## Root Cause Analysis

1. **CUID vs UUID Detection**: Приложение использует CUID (не стандартный UUID) для идентификаторов
   - CUID format: `cmmj3p3uh0011ws3mmxhskmsf` (25 символов, начинается с 'c')
   - UUID format: `550e8400-e29b-41d4-a716-446655440000` (36 символов с дефисами)

2. **Неправильное регулярное выражение**: Код проверял только стандартный UUID формат
   ```typescript
   // НЕПРАВИЛЬНО - не распознает CUID
   const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cityIdOrSlug);
   ```

3. **API параметры**: CUID передавался как slug вместо cityId

## Solution Applied

### 1. Fixed CUID/UUID Detection

**eventLocationUtils.ts:**
```typescript
// ПРАВИЛЬНО - распознает и CUID и UUID
const isCUID = /^c[a-z0-9]{24}$/i.test(cityIdOrSlug);
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cityIdOrSlug);
const isId = isCUID || isUUID;

const param = isId ? `cityId=${encodeURIComponent(cityIdOrSlug)}` : `citySlug=${encodeURIComponent(cityIdOrSlug)}`;
```

### 2. Enhanced Logging

```typescript
console.log('[loadDistricts] Using param:', param, 'for input:', cityIdOrSlug);
```

### 3. Updated Both Functions

- `loadDistricts()` - теперь правильно определяет CUID
- `loadMetroStations()` - теперь правильно определяет CUID

## Testing Results

### CUID Detection Logic
```bash
npx tsx scripts/manual-tests/test-cuid-detection.ts
```

✅ CUID from database: `cmmj3p3uh0011ws3mmxhskmsf` → `cityId`  
✅ City slug: `minsk` → `citySlug`  
✅ Standard UUID: `550e8400-e29b-41d4-a716-446655440000` → `cityId`  
✅ Cyrillic slug: `москва` → `citySlug`  
✅ Slug with dash: `new-york` → `citySlug`  

### API Testing with CUID
```bash
npx tsx scripts/manual-tests/test-api-with-cuid.ts
```

✅ Districts API with CUID: 9 districts  
✅ Metro stations API with CUID: 36 stations  
✅ Both slug and CUID return same results  

### Database Verification
```bash
npx tsx scripts/diagnostics/check-city-data.ts
```

✅ Минск (minsk) - ID: `cmmj3p3uh0011ws3mmxhskmsf`  
✅ Districts: 9, Metro: 36, HasMetro: true  

## Data Flow

### Before Fix
```
enrichEventLocation() returns cityId: "cmmj3p3uh0011ws3mmxhskmsf"
↓
EventLocationPicker uses cityId as parameter
↓
loadDistricts("cmmj3p3uh0011ws3mmxhskmsf")
↓
Regex fails to detect CUID → treats as slug
↓
API call: /api/geo/districts?citySlug=cmmj3p3uh0011ws3mmxhskmsf
↓
❌ Error: "City not found: cmmj3p3uh0011ws3mmxhskmsf"
```

### After Fix
```
enrichEventLocation() returns cityId: "cmmj3p3uh0011ws3mmxhskmsf"
↓
EventLocationPicker uses cityId as parameter
↓
loadDistricts("cmmj3p3uh0011ws3mmxhskmsf")
↓
Regex detects CUID → treats as cityId
↓
API call: /api/geo/districts?cityId=cmmj3p3uh0011ws3mmxhskmsf
↓
✅ Success: Returns 9 districts
```

## Supported ID Formats

| Format | Example | Detection | API Parameter |
|--------|---------|-----------|---------------|
| CUID | `cmmj3p3uh0011ws3mmxhskmsf` | `/^c[a-z0-9]{24}$/i` | `cityId` |
| UUID | `550e8400-e29b-41d4-a716-446655440000` | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` | `cityId` |
| Slug | `minsk` | Not ID format | `citySlug` |
| Cyrillic | `москва` | Not ID format | `citySlug` |
| With dash | `new-york` | Not ID format | `citySlug` |

## Result

✅ **CUID Recognition**: Правильно определяет CUID формат  
✅ **API Calls**: Использует правильные параметры для API  
✅ **Districts Loading**: 9 районов загружается корректно  
✅ **Metro Loading**: 36 станций метро загружается корректно  
✅ **Backward Compatibility**: Поддерживает UUID и slug форматы  
✅ **Error Handling**: Детальные логи для диагностики  

## Files Modified

- `src/components/business/wizard/event/steps/location/eventLocationUtils.ts`
- `scripts/manual-tests/test-cuid-detection.ts` (новый)
- `scripts/manual-tests/test-api-with-cuid.ts` (новый)

Event Location теперь правильно работает с CUID идентификаторами! 🎉

## Usage

В браузере теперь должно работать:
1. Выбор адреса через Google Places → автоматическое определение района и метро
2. Выбор точки на карте → автоматическое определение района и метро  
3. Ручной выбор района и метро из выпадающих списков
4. Fallback к mock данным в development режиме при ошибках API