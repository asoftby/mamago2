# Business UNP Auto-Lookup Implementation

## Overview
Implemented automatic company name lookup from Belarus official registries when user enters УНП (9-digit tax ID) during business onboarding. Uses dual-source strategy with fallback for reliability.

## Architecture

### Primary Source: GRP API (nalog.gov.by)
- Official Belarus tax registry
- No authentication required
- Fast and reliable

### Fallback Source: DaData API
- Commercial data provider with Belarus support
- Requires API token (optional)
- Used only if GRP fails or returns no data

## Changes Made

### 1. Server Action: Dual-Source UNP Lookup (`src/app/business/onboarding/actions.ts`)

**Enhanced `lookupCompanyByUnp` server action:**
- Validates УНП format (exactly 9 digits)
- **Primary**: Calls GRP API first
- **Fallback**: If GRP fails, tries DaData API (if token configured)
- Returns unified response: `{ legalName?: string; error?: string }`
- Implements in-memory cache (1 hour TTL) to reduce API calls
- 6-second timeout per API request
- Proper error handling with user-friendly messages

**GRP API Implementation (`tryGrpLookup`):**
- Endpoint: `https://grp.nalog.gov.by/api/grp-public/data?unp={УНП}&charset=UTF-8&type=json`
- Parses: `{ row: [{ VNAIMK, VNAIMP }] }`
- Prefers short name (VNAIMK) over full name (VNAIMP)

**DaData API Implementation (`tryDaDataLookup`):**
- Endpoint: `https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party`
- Requires: `DADATA_TOKEN` environment variable
- Filters: Belarus only (`locations: [{ country: "BY" }]`)
- Validates: INN matches УНП
- Parses: `{ suggestions: [{ data: { inn, name: { short, full } } }] }`
- Prefers short name over full name

### 2. Client Form: Simplified Response (`src/app/business/onboarding/OnboardingForm.tsx`)

**Updated to use unified response:**
- Receives `{ legalName?: string; error?: string }`
- Auto-fills legal name if found
- Shows error if both sources fail
- Maintains smart prefill logic (respects user edits)

### 3. Environment Configuration (`.env`)

**Added optional DaData token:**
```env
# DaData API (optional - fallback for UNP lookup if GRP fails)
# Get token from: https://dadata.ru/profile/#info
DADATA_TOKEN=
```

**Note**: System works without DaData token (GRP only). Add token for improved reliability.

## User Flow

1. User enters УНП (9 digits)
2. After 600ms or on blur, system calls `lookupCompanyByUnp`
3. **Primary attempt**: GRP API lookup (6s timeout)
4. **Fallback attempt**: If GRP fails and token exists, DaData API lookup (6s timeout)
5. If found: Legal name field auto-fills
6. If not found: Shows error "Компания с таким УНП не найдена"
7. User can edit legal name at any time

## Error Handling

- Invalid УНП format: "Неверный формат УНП"
- Both APIs fail: "Компания с таким УНП не найдена"
- Network errors: Logged to console, fallback attempted
- Timeouts: 6 seconds per API, automatic fallback

## Performance Optimizations

1. **Dual-source reliability**: Primary + fallback ensures high success rate
2. **Debouncing**: 600ms delay prevents excessive API calls
3. **Caching**: In-memory cache stores results for 1 hour
4. **Timeouts**: 6-second limit per API prevents hanging
5. **Smart fallback**: Only calls DaData if GRP fails
6. **Graceful degradation**: Works without DaData token

## API References

### GRP (налог.gov.by) REST API
- **Endpoint**: `https://grp.nalog.gov.by/api/grp-public/data`
- **Method**: GET
- **Query**: `?unp={9-digit-number}&charset=UTF-8&type=json`
- **Auth**: None required
- **Response**: `{ row: [{ VUNP, VNAIMK, VNAIMP }] }`
- **Documentation**: https://grp.nalog.gov.by/grp/rest-api

### DaData Party Suggest API
- **Endpoint**: `https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party`
- **Method**: POST
- **Auth**: `Authorization: Token {DADATA_TOKEN}`
- **Body**: `{ query: "УНП", count: 1, locations: [{ country: "BY" }] }`
- **Response**: `{ suggestions: [{ value, data: { inn, name: { short, full } } }] }`
- **Documentation**: https://dadata.ru/api/suggest/party/
- **Get Token**: https://dadata.ru/profile/#info

## Environment Variables

### Required
None - system works with GRP API only

### Optional
- `DADATA_TOKEN`: DaData API token for fallback lookup
  - Improves reliability when GRP is unavailable
  - Get from: https://dadata.ru/profile/#info
  - Free tier available

## Testing Checklist

- [ ] Enter valid УНП → auto-fills legal name (GRP)
- [ ] GRP down → falls back to DaData (if token configured)
- [ ] No DaData token → works with GRP only
- [ ] Invalid УНП → shows validation error
- [ ] Edit legal name manually → subsequent lookups don't overwrite
- [ ] Both APIs fail → shows error, form still usable
- [ ] Fast typing → debounce prevents multiple API calls
- [ ] Same УНП twice → uses cache (check network tab)
- [ ] GRP timeout → falls back to DaData within 6s

## Database Schema

**No changes needed** - Business model already has required fields:
- `unp: String?`
- `legalName: String?`
- `phone: String?`
