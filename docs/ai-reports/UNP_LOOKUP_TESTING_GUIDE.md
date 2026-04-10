# UNP Lookup Testing & Diagnostics Guide

## Overview
The UNP resolver is fully instrumented with diagnostics. This guide shows how to test and troubleshoot company name lookups.

## Quick Test

### 1. Start Dev Server
```bash
pnpm run dev
```

### 2. Test УНП Lookup
```bash
# Test with УНП 691868900
curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"

# Test with another УНП
curl "http://localhost:3001/api/dev/unp-lookup?unp=100144153"

# Test with invalid УНП
curl "http://localhost:3001/api/dev/unp-lookup?unp=123456789"
```

### 3. Check Server Console
The server will log detailed diagnostics:

```
[DEV] Testing UNP lookup for: 691868900
============================================================
[UNP][EGR] Response keys for 691868900: [ 'vunp', 'nameFull', ... ]
[UNP][EGR] ✓ Found for 691868900: ООО "КОМПАНИЯ"
[UNP Resolver] 691868900 -> EGR: ООО "КОМПАНИЯ"
============================================================
[DEV] Result: { legalName: '...', source: 'EGR' }
```

## What Gets Logged

### Success Case (EGR)
```
[UNP][EGR] Response keys for 691868900: [ 'vunp', 'nameFull', 'status' ]
[UNP][EGR] ✓ Found for 691868900: ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "КОМПАНИЯ"
[UNP Resolver] 691868900 -> EGR: ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "КОМПАНИЯ"
```

### Success Case (GRP Fallback)
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

### Blocked (403)
```
[UNP][EGR] { 
  unp: '691868900', 
  url: 'https://egr.gov.by/...', 
  status: 403, 
  statusText: 'Forbidden',
  body: '<!DOCTYPE html><html><head><title>Access Denied</title>...'
}
```

### Timeout
```
[UNP][EGR] Timeout for 691868900 at https://egr.gov.by/... (attempt 1)
[UNP][EGR] Timeout for 691868900 at https://egr.gov.by/... (attempt 2)
```

### JSON Parse Error
```
[UNP][EGR] JSON parse error for 691868900: SyntaxError: Unexpected token < in JSON at position 0
[UNP][EGR] Response preview: <!DOCTYPE html><html>...
```

### Wrong Field Names
```
[UNP][EGR] Response keys for 691868900: [ 'id', 'companyName', 'registrationNumber' ]
[UNP][EGR] No name field found for 691868900 in response
```

## Diagnostic Features

### 1. HTTPS-First with HTTP Fallback
- **EGR**: Tries HTTPS first, falls back to HTTP
- **GRP**: Uses HTTPS (can add HTTP fallback if needed)

### 2. Response Body Preview
- Logs first 300 characters of response on errors
- Helps identify HTML error pages vs JSON errors

### 3. JSON Structure Logging
- Logs available keys in response
- Helps identify correct field names

### 4. Retry Logic
- 1 retry per URL with 300ms delay
- Logs each attempt

### 5. Timeout Protection
- 6-second hard limit per request
- Prevents hanging indefinitely

## Troubleshooting Common Issues

### Issue: 403 Forbidden

**Symptoms:**
```
[UNP][EGR] { status: 403, statusText: 'Forbidden', body: '<!DOCTYPE html>...' }
```

**Possible Causes:**
- API blocking requests from your IP/server
- Missing required headers
- Rate limiting

**Solutions:**
1. Check if API requires authentication
2. Try from different network
3. Add User-Agent header
4. Contact API provider

### Issue: Timeout

**Symptoms:**
```
[UNP][EGR] Timeout for 691868900 at https://egr.gov.by/... (attempt 1)
```

**Possible Causes:**
- API is slow or down
- Network connectivity issues
- Firewall blocking outbound requests

**Solutions:**
1. Increase timeout (currently 6s)
2. Check network connectivity: `curl https://egr.gov.by`
3. Try HTTP fallback (already implemented)

### Issue: HTML Instead of JSON

**Symptoms:**
```
[UNP][EGR] JSON parse error: Unexpected token < in JSON at position 0
[UNP][EGR] Response preview: <!DOCTYPE html><html>...
```

**Possible Causes:**
- API endpoint changed
- Error page being returned
- Wrong URL

**Solutions:**
1. Check API documentation for correct endpoint
2. Verify URL is correct
3. Check if API is operational

### Issue: Wrong Field Names

**Symptoms:**
```
[UNP][EGR] Response keys: [ 'id', 'companyName', 'registrationNumber' ]
[UNP][EGR] No name field found
```

**Possible Causes:**
- API changed response structure
- Different field names than expected

**Solutions:**
1. Look at logged keys
2. Add new field names to `pickFirstNonEmpty` array
3. Update field priority

### Issue: Empty Response

**Symptoms:**
```
[UNP][GRP] No data array found for 691868900
```

**Possible Causes:**
- УНП not in registry
- Wrong response format

**Solutions:**
1. Verify УНП exists in registry manually
2. Check response structure
3. Handle new response format

## Testing Different Scenarios

### Test Valid УНП (Should Find)
```bash
# Known valid УНП
curl "http://localhost:3001/api/dev/unp-lookup?unp=100144153"
curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"
```

### Test Invalid УНП (Should Not Find)
```bash
# Invalid format
curl "http://localhost:3001/api/dev/unp-lookup?unp=123"
curl "http://localhost:3001/api/dev/unp-lookup?unp=abc123456"

# Valid format but doesn't exist
curl "http://localhost:3001/api/dev/unp-lookup?unp=999999999"
```

### Test Cache
```bash
# First request (should hit API)
curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"

# Second request (should use cache - instant)
curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"
```

Check server logs - second request should not show API calls.

## Expected Response Format

### Success
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

### Not Found
```json
{
  "unp": "999999999",
  "result": {
    "legalName": null,
    "source": null
  },
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

### Invalid УНП
```json
{
  "unp": "123",
  "result": {
    "legalName": null,
    "source": null
  },
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

## API Endpoints Being Used

### EGR (Primary)
```
HTTPS: https://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/{УНП}
HTTP:  http://egr.gov.by/api/v2/egr/getBaseInfoByRegNum/{УНП}
```

**Expected Fields:**
- `nameFull`, `fullName` (full legal name)
- `nameShort`, `shortName` (short name)
- `name` (generic name)
- `VNAIMP`, `VNAIMK` (alternative fields)
- `vNaimUl`, `vunp`, `naimk`, `naimp` (lowercase variants)

### GRP (Fallback)
```
HTTPS: https://grp.nalog.gov.by/api/grp-public/data?unp={УНП}&charset=UTF-8&type=json
```

**Expected Structure:**
- `{ row: [...] }` - array in row property
- `{ data: [...] }` - array in data property
- `[...]` - direct array

**Expected Fields:**
- `VNAIMP`, `vnaimp`, `vNaimP` (full name)
- `VNAIMK`, `vnaimk`, `vNaimK` (short name)
- `nameFull`, `nameShort`, `name`

## Next Steps After Diagnostics

1. **Run test**: `curl "http://localhost:3001/api/dev/unp-lookup?unp=691868900"`
2. **Check logs**: Look for status codes, response bodies, field names
3. **Identify issue**: Use logs to determine root cause
4. **Fix if needed**: 
   - Add missing field names
   - Handle new response formats
   - Adjust timeouts
   - Add authentication if required
5. **Test again**: Verify fix works

## Production Considerations

### Remove Dev Endpoint
The endpoint is already protected:
```typescript
if (process.env.NODE_ENV !== "development") {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### Reduce Logging
Consider reducing log verbosity in production:
- Keep error logs
- Remove debug logs (response keys, body previews)
- Use structured logging service

### Monitor Performance
- Track success rates per source
- Monitor timeout frequency
- Alert on high failure rates

## Summary

The UNP resolver is fully instrumented with:
- ✅ Dev test endpoint
- ✅ Detailed status logging
- ✅ Response body previews (300 chars)
- ✅ JSON structure logging
- ✅ HTTPS-first with HTTP fallback
- ✅ Retry logic with delays
- ✅ Timeout protection
- ✅ Multiple field name variants
- ✅ Multiple response format support

Use the test endpoint and server logs to diagnose any lookup issues.
