# Business UNP Auto-Lookup via EGR API

## Overview
Implemented automatic company name lookup from Belarus official EGR (Unified State Register) when user enters УНП (9-digit tax ID) during business onboarding.

## Architecture

### Primary Source: EGR API (egr.gov.by)
- Official Belarus state registry
- No authentication required
- Direct lookup by registration number (УНП)

## Implementation

### 1. Server Utility (`src/server/egr/lookupByUnp.ts`)

**New server-side function:**
```typescript
export async function lookupLegalNameByUnp(
  unp: string
): Promise<{ legalName: string | null }>
```

**Features:**
- Validates УНП format (exactly 9 digits)
- Cleans input (strips non-digits, trims whitespace)
- Calls EGR API: `http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/{УНП}`
- Returns unified response: `{ legalName: string | null }`
- Implements in-memory cache (10 minutes TTL) to reduce API calls
- 8-second timeout for API requests
- Proper error handling with graceful degradation

**API Endpoint:**
```
GET http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/{regNum}
```

**Response Field Mapping:**
The function tries multiple possible field names from the EGR response:
1. `vNaimUl` (most common in EGR responses)
2. `nameFull`
3. `nameShort`
4. `fullName`
5. `shortName`
6. `name`

**Caching Strategy:**
- Cache key: Cleaned УНП (9 digits)
- Cache value: `{ v: string | null, ts: number }`
- TTL: 10 minutes
- Caches both successful and failed lookups to avoid repeated requests

### 2. Server Action Export (`src/app/business/onboarding/actions.ts`)

**Re-exported for client use:**
```typescript
import { lookupLegalNameByUnp } from "@/server/egr/lookupByUnp";
export { lookupLegalNameByUnp };
```

### 3. Client Form Integration (`src/app/business/onboarding/OnboardingForm.tsx`)

**Updated to use EGR lookup:**
- Imports `lookupLegalNameByUnp` instead of old dual-source function
- Same UX: debounce (600ms), loading state, smart prefill
- Simplified error handling (no validation errors, just not found)

**User Flow:**
1. User enters УНП (9 digits)
2. After 600ms or on blur, calls `lookupLegalNameByUnp`
3. Shows "Поиск компании…" during lookup
4. If found: Auto-fills "Юридическое название"
5. If not found: Shows amber hint message
6. User can always edit or override

**Error Message:**
```
"Не удалось определить компанию по УНП. Проверьте номер или заполните название вручную."
```

## Key Features

1. **Server-Side Only**: No CORS issues, secure API calls
2. **Input Cleaning**: Strips non-digits and trims before validation
3. **Smart Caching**: 10-minute TTL reduces API load
4. **Graceful Degradation**: Null result doesn't block form submission
5. **Non-Blocking UX**: User can always proceed with manual entry
6. **Smart Prefill**: Only updates if user hasn't manually edited
7. **Timeout Protection**: 8-second limit prevents hanging

## Testing

### Test with Real УНП
To verify the implementation works with a real company:

```typescript
// Example УНП: 691868900
const result = await lookupLegalNameByUnp("691868900");
console.log(result.legalName); // Should return company name if exists in EGR
```

### Test Cases
- [ ] Enter valid 9-digit УНП → auto-fills legal name
- [ ] Enter УНП 691868900 → returns company name from EGR
- [ ] Invalid УНП format → returns null, shows hint
- [ ] Edit legal name manually → subsequent lookups don't overwrite
- [ ] API timeout/error → returns null, form still usable
- [ ] Fast typing → debounce prevents multiple API calls
- [ ] Same УНП twice → uses cache (check network tab)
- [ ] Cache expiry → re-fetches after 10 minutes

## API Reference

### EGR API
- **Base URL**: `http://egr.gov.by/api/v2/egr`
- **Endpoint**: `GET /getBaseInfoByRegNum/{regNum}`
- **Parameter**: `regNum` - УНП (9 digits)
- **Auth**: None required
- **Response**: JSON with company base information
- **Common Fields**: `vNaimUl`, `nameFull`, `nameShort`

### Example Request
```bash
curl http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/691868900
```

### Example Response Structure
```json
{
  "vNaimUl": "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \"КОМПАНИЯ\"",
  "vUnp": "691868900",
  // ... other fields
}
```

## Performance Optimizations

1. **Debouncing**: 600ms delay prevents excessive API calls while typing
2. **Caching**: In-memory cache stores results for 10 minutes
3. **Timeout**: 8-second limit prevents hanging requests
4. **Smart Prefill**: Only updates if user hasn't manually edited
5. **Failed Request Caching**: Caches null results to avoid repeated failures

## Error Handling

- **Invalid format**: Returns `{ legalName: null }` silently
- **API error**: Logs error, caches null, returns `{ legalName: null }`
- **Timeout**: Logs timeout, caches null, returns `{ legalName: null }`
- **Network error**: Logs error, caches null, returns `{ legalName: null }`
- **Not found**: Returns `{ legalName: null }` (normal case)

All errors result in the same user-facing message:
```
"Не удалось определить компанию по УНП. Проверьте номер или заполните название вручную."
```

## User Experience

**Successful Lookup:**
1. User types УНП: `691868900`
2. After 600ms: "Поиск компании…"
3. Legal name field auto-fills with company name
4. User can edit if needed

**Failed Lookup:**
1. User types УНП: `123456789`
2. After 600ms: "Поиск компании…"
3. Amber hint: "Не удалось определить компанию по УНП. Проверьте номер или заполните название вручную."
4. User manually enters legal name
5. Form submission works normally

## Database Schema

**No changes needed** - Business model already has required fields:
- `unp: String?`
- `legalName: String?`
- `phone: String?`

## Environment Variables

**None required** - EGR API is public and doesn't require authentication.

## Migration from Previous Implementation

**Removed:**
- Dual-source lookup (GRP + DaData)
- `lookupCompanyByUnp` function
- `tryGrpLookup` function
- `tryDaDataLookup` function
- `DADATA_TOKEN` environment variable (no longer needed)

**Added:**
- Single-source EGR lookup
- `lookupLegalNameByUnp` function
- Simplified error handling
- Shorter cache TTL (10 min vs 1 hour)

**Benefits:**
- Simpler implementation (one API instead of two)
- No external dependencies (no DaData token needed)
- Official government source (more authoritative)
- Faster response (direct lookup, no fallback delay)
