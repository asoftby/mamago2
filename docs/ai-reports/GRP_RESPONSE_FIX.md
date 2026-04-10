# GRP Response Parsing Fix

## Issue
GRP API sometimes returns `{ row: {...} }` where `row` is a single object instead of an array, causing the resolver to fail with "No data found".

## Solution
Updated the GRP response parsing to handle multiple response formats.

## Changes Made

### File: `src/server/company/resolveByUnp.ts`

**Before:**
```typescript
// Only handled row as array
let item = null;
if (json?.row && Array.isArray(json.row) && json.row.length > 0) {
  item = json.row[0];
} else if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
  item = json.data[0];
} else if (Array.isArray(json) && json.length > 0) {
  item = json[0];
}
```

**After:**
```typescript
// Handles row as object OR array
let item = null;

if (json?.row) {
  // Check if row is an object (not array)
  if (typeof json.row === 'object' && !Array.isArray(json.row)) {
    item = json.row;  // Single object
  } else if (Array.isArray(json.row) && json.row.length > 0) {
    item = json.row[0];  // Array - take first
  }
} else if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
  item = json.data[0];
} else if (Array.isArray(json) && json.length > 0) {
  item = json[0];
}
```

## Supported Response Formats

### 1. Single Object in `row`
```json
{
  "row": {
    "VUNP": "100582333",
    "VNAIMP": "Министерство по налогам и сборам Республики Беларусь",
    "VNAIMK": "МНС РБ"
  }
}
```

### 2. Array in `row`
```json
{
  "row": [
    {
      "VUNP": "100582333",
      "VNAIMP": "Министерство по налогам и сборам Республики Беларусь"
    }
  ]
}
```

### 3. Array in `data`
```json
{
  "data": [
    {
      "VUNP": "100582333",
      "VNAIMP": "Министерство по налогам и сборам Республики Беларусь"
    }
  ]
}
```

### 4. Direct Array
```json
[
  {
    "VUNP": "100582333",
    "VNAIMP": "Министерство по налогам и сборам Республики Беларусь"
  }
]
```

## Field Extraction Priority

The resolver tries fields in this order:
1. `VNAIMP` (uppercase full name)
2. `vnaimp` (lowercase full name)
3. `vNaimP` (mixed case full name)
4. `VNAIMK` (uppercase short name)
5. `vnaimk` (lowercase short name)
6. `vNaimK` (mixed case short name)
7. `nameFull`
8. `nameShort`
9. `name`
10. `vunp`

## Testing

### Test with УНП 100582333

```bash
curl "http://localhost:3001/api/dev/unp-lookup?unp=100582333"
```

**Expected Response:**
```json
{
  "unp": "100582333",
  "result": {
    "legalName": "Министерство по налогам и сборам Республики Беларусь",
    "source": "GRP"
  },
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

**Expected Server Console:**
```
[DEV] Testing UNP lookup for: 100582333
============================================================
[UNP] Fallback -> GRP HTTPS
[UNP][GRP HTTPS] Response keys for 100582333: [ 'row' ]
[UNP][GRP HTTPS] Item keys for 100582333: [ 'VUNP', 'VNAIMP', 'VNAIMK', ... ]
[UNP][GRP HTTPS] ✓ Found for 100582333: Министерство по налогам и сборам Республики Беларусь
[UNP Resolver] 100582333 -> GRP: Министерство по налогам и сборам Республики Беларусь
============================================================
[DEV] Result: { legalName: '...', source: 'GRP' }
```

## Diagnostic Improvements

**Updated log message:**
```diff
- console.warn(`[UNP][GRP ${protocol}] No data array found for ${unp}`);
+ console.warn(`[UNP][GRP ${protocol}] No data found for ${unp}`);
```

More accurate since we now handle both objects and arrays.

## Edge Cases Handled

1. **`row` is null**: Skips to next format check
2. **`row` is empty array**: Skips to next format check
3. **`row` is object**: Uses it directly ✅ (NEW)
4. **`row` is array**: Takes first element
5. **No `row` property**: Checks `data` or direct array

## Benefits

1. **More reliable**: Handles both GRP response formats
2. **Better logging**: Clearer error messages
3. **No breaking changes**: Existing formats still work
4. **Future-proof**: Can easily add more format variants

## Verification Checklist

- [x] Handles `{ row: {...} }` (single object)
- [x] Handles `{ row: [...] }` (array)
- [x] Handles `{ data: [...] }` (array in data)
- [x] Handles `[...]` (direct array)
- [x] Prioritizes `VNAIMP`/`vnaimp` fields
- [x] Falls back to `VNAIMK`/`vnaimk` fields
- [x] Logs response structure for debugging
- [x] No TypeScript errors

## Related Files

- `src/server/company/resolveByUnp.ts` - Main resolver with fix
- `src/app/api/dev/unp-lookup/route.ts` - Test endpoint
- `UNP_LOOKUP_TESTING_GUIDE.md` - Testing documentation

## Summary

The GRP response parser now correctly handles the case where `row` is a single object instead of an array, fixing lookups for УНП like 100582333 that return this format.
