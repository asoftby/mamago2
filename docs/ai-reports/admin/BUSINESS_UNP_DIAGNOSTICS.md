# UNP Resolver Diagnostics & Improvements

## Overview
Enhanced the UNP resolver with comprehensive diagnostics, HTTPS-first approach, and a dev test endpoint to troubleshoot company name lookup issues.

## Changes Made

### 1. Enhanced Diagnostics (`src/server/company/resolveByUnp.ts`)

**Added comprehensive logging:**

```typescript
// On HTTP errors
console.warn(`[UNP][EGR]`, { 
  unp, 
  url, 
  status: res.status, 
  statusText: res.statusText,
  body: text.slice(0, 300) 
});

// On JSON parse errors
console.error(`[UNP][EGR] JSON parse error for ${unp}:`, parseError);
console.warn(`[UNP][EGR] Response preview:`, text.slice(0, 300));

// On successful response
console.log(`[UNP][EGR] Response keys for ${unp}:`, Object.keys(json));
console.log(`[UNP][EGR] ✓ Found for ${unp}: ${legalName}`);

// When no name found
console.warn(`[UNP][EGR] No name field found for ${unp} in response`);
```

**Benefits:**
- See exact HTTP status codes and error messages
- View first 300 chars of response body on errors
- Log available JSON keys to identify correct field names
- Track which source (EGR/GRP) succeeded
- Identify JSON parsing issues

### 2. HTTPS-First Approach

**EGR API:**
```typescript
const urls = [
  `https://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/${unp}`, // Try HTTPS first
  `http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/${unp}`,  // Fallback to HTTP
];
```

**GRP API:**
```typescript
const url = `https://grp.nalog.gov.by/api/grp-public/data?unp=${unp}&charset=UTF-8&type=json`;
// Already HTTPS
```

**Benefits:**
- More secure connections
- Better compatibility with modern infrastructure
- Automatic fallback if HTTPS fails

### 3. Robust JSON Parsing

**EGR - Added more field variants:**
```typescript
const legalName = pickFirstNonEmpty([
  json?.nameFull,
  json?.fullName,
  json?.nameShort,
  json?.shortName,
  json?.name,
  json?.VNAIMP,
  json?.VNAIMK,
  json?.vNaimUl,
  json?.vunp,      // Added
  json?.naimk,     // Added
  json?.naimp,     // Added
]);
```

**GRP - Handle multiple response formats:**
```typescript
// Handle { row: [...] }, { data: [...] }, or array directly
let item = null;
if (json?.row && Array.isArray(json.row) && json.row.length > 0) {
  item = json.row[0];
} else if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
  item = json.data[0];  // Added
} else if (Array.isArray(json) && json.length > 0) {
  item = json[0];
}
```

**GRP - Check both uppercase and lowercase:**
```typescript
const legalName = pickFirstNonEmpty([
  item?.VNAIMP,
  item?.vnaimp,
  item?.vNaimP,    // Added
  item?.VNAIMK,
  item?.vnaimk,
  item?.vNaimK,    // Added
  item?.nameFull,
  item?.nameShort,
  item?.name,
  item?.vunp,      // Added
]);
```

### 4. Node.js Runtime (`src/app/business/onboarding/actions.ts`)

**Added runtime export:**
```typescript
// Ensure Node.js runtime for fetch compatibility
export const runtime = "nodejs";
```

**Why:**
- Ensures fetch API works correctly
- Avoids Edge runtime limitations
- Better compatibility with external APIs

### 5. Dev Test Endpoint (`src/app/api/dev/unp-lookup/route.ts`)

**New endpoint for testing:**
```
GET /api/dev/unp-lookup?unp=691868900
```

**Features:**
- Only works in development (NODE_ENV=development)
- Returns 404 in production
- Calls `resolveCompanyByUnp` and returns JSON
- Logs detailed diagnostics to server console

**Response:**
```json
{
  "unp": "691868900",
  "result": {
    "legalName": "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \"КОМПАНИЯ\"",
    "source": "EGR"
  },
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

## Testing Instructions

### 1. Test via API Endpoint

```bash
# Test with УНП 691868900
curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"

# Test with another УНП
curl "http://localhost:3001/api/dev/unp-lookup?unp=123456789"

# Test with invalid УНП
curl "http://localhost:3001/api/dev/unp-lookup?unp=invalid"
```

### 2. Check Server Console

Watch for detailed logs:

```
[DEV] Testing UNP lookup for: 691868900
============================================================
[UNP][EGR] Response keys for 691868900: [ 'vunp', 'nameFull', 'address', ... ]
[UNP][EGR] ✓ Found for 691868900: ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "КОМПАНИЯ"
[UNP Resolver] 691868900 -> EGR: ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "КОМПАНИЯ"
============================================================
[DEV] Result: { legalName: '...', source: 'EGR' }
```

### 3. Test in Onboarding Form

1. Navigate to business onboarding
2. Enter УНП: `691868900`
3. Wait 700ms or blur field
4. Check server console for logs
5. Legal name should auto-fill

## Diagnostic Log Examples

### Success (EGR)
```
[UNP][EGR] Response keys for 691868900: [ 'vunp', 'nameFull', 'status' ]
[UNP][EGR] ✓ Found for 691868900: ООО "КОМПАНИЯ"
[UNP Resolver] 691868900 -> EGR: ООО "КОМПАНИЯ"
```

### Success (GRP Fallback)
```
[UNP][EGR] { unp: '123456789', url: 'https://egr.gov.by/...', status: 404, statusText: 'Not Found', body: '' }
[UNP][EGR] { unp: '123456789', url: 'http://egr.gov.by/...', status: 404, statusText: 'Not Found', body: '' }
[UNP][GRP] Response keys for 123456789: [ 'row' ]
[UNP][GRP] Item keys for 123456789: [ 'VUNP', 'VNAIMP', 'VNAIMK' ]
[UNP][GRP] ✓ Found for 123456789: ООО "ТЕСТ"
[UNP Resolver] 123456789 -> GRP: ООО "ТЕСТ"
```

### Not Found
```
[UNP][EGR] { unp: '999999999', url: 'https://egr.gov.by/...', status: 404, statusText: 'Not Found', body: '' }
[UNP][EGR] { unp: '999999999', url: 'http://egr.gov.by/...', status: 404, statusText: 'Not Found', body: '' }
[UNP][GRP] { unp: '999999999', url: 'https://grp.nalog.gov.by/...', status: 404, statusText: 'Not Found', body: '' }
[UNP Resolver] 999999999 -> Not found
```

### JSON Parse Error
```
[UNP][EGR] JSON parse error for 691868900: SyntaxError: Unexpected token < in JSON at position 0
[UNP][EGR] Response preview: <!DOCTYPE html><html>...
```

### Timeout
```
[UNP][EGR] Timeout for 691868900 at https://egr.gov.by/... (attempt 1)
[UNP][EGR] Timeout for 691868900 at https://egr.gov.by/... (attempt 2)
```

## Troubleshooting Guide

### Issue: УНП not found but company exists

**Check logs for:**
1. HTTP status codes (404, 500, etc.)
2. Response keys - are they different from expected?
3. JSON structure - is it wrapped differently?

**Solutions:**
- Add new field names to `pickFirstNonEmpty` array
- Handle new response structure variants
- Check if API endpoint changed

### Issue: JSON parse error

**Check logs for:**
1. Response preview (first 300 chars)
2. Is it HTML instead of JSON?
3. Is it empty?

**Solutions:**
- API might be down or returning error page
- Check if URL is correct
- Verify API is accessible from server

### Issue: Timeout

**Check logs for:**
1. Which URL timed out (HTTPS or HTTP)
2. How many attempts were made

**Solutions:**
- Increase timeout from 6000ms
- Check network connectivity
- Try different API endpoint

### Issue: Wrong field name

**Check logs for:**
1. "Response keys" - shows all available keys
2. "Item keys" (for GRP) - shows keys in data item

**Solutions:**
- Add the correct field name to `pickFirstNonEmpty`
- Update field priority order

## Performance Impact

**Additional overhead:**
- Logging: ~1-5ms per request
- HTTPS fallback: +6s max if HTTPS fails (rare)
- Text parsing for errors: ~1ms

**Benefits:**
- Faster debugging (minutes vs hours)
- Better error visibility
- Easier maintenance

## Production Considerations

**Logging in production:**
- Consider reducing log verbosity
- Use structured logging (JSON)
- Send to logging service (not console)

**Dev endpoint:**
- Already protected (NODE_ENV check)
- Returns 404 in production
- No security risk

**HTTPS-first:**
- Safe for production
- Improves security
- Minimal performance impact

## Next Steps

1. **Test with real УНП**: `curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"`
2. **Check server logs**: Look for diagnostic output
3. **Identify issue**: Use logs to find root cause
4. **Fix if needed**: Add missing fields or handle new formats
5. **Remove dev endpoint**: Optional, already protected

## Summary

The enhanced resolver now provides:
- ✅ Comprehensive diagnostics
- ✅ HTTPS-first approach
- ✅ Robust JSON parsing
- ✅ Multiple response format support
- ✅ Dev test endpoint
- ✅ Node.js runtime guarantee
- ✅ Better error visibility

This should help identify why УНП 691868900 (or any other) is not being found and provide the data needed to fix it.
