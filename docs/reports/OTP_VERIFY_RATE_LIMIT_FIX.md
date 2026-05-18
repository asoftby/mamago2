# Security Report: OTP Verify Rate Limiting

## Status
- **Date**: 2026-05-13
- **Area**: Authentication Security — Phone OTP Verification
- **Type**: Brute-force protection

## Issue Description
Previously, the `/api/auth/phone/verify-otp` endpoint had no rate limiting, making it vulnerable to brute-force attacks against the 4-digit OTP code. The only protection was the per-OTP-record `attempts` counter (max 3 attempts per OTP), which could be bypassed by simply requesting a new OTP code repeatedly.

## Implemented Fix
An in-memory rate limiter has been added to the OTP verify endpoint, using the same [`checkRateLimit`](src/lib/security/rateLimit.ts) utility already used by the login endpoint.

### Changes to [`src/app/api/auth/phone/verify-otp/route.ts`](src/app/api/auth/phone/verify-otp/route.ts)

1. **Imports**: Added [`checkRateLimit`](src/lib/security/rateLimit.ts:43) and [`resetRateLimit`](src/lib/security/rateLimit.ts:95) from `@/lib/security/rateLimit`.

2. **IP Extraction**: Added [`getClientIp()`](src/app/api/auth/phone/verify-otp/route.ts:13) helper (same pattern as login endpoint) with support for:
   - `cf-connecting-ip` (Cloudflare)
   - `x-real-ip` (Proxies)
   - `x-forwarded-for` (first entry)
   - Fallback to `unknown`

3. **Rate Limit Configuration**:
   - **Key**: `otp_verify:${ip}:${phoneE164}`
   - **Limit**: 5 attempts
   - **Window**: 10 minutes
   - **Position**: Checked **before** any database OTP lookup or code verification (line 54)

4. **429 Response**: Returns HTTP 429 with Russian error message:
   ```json
   { "error": "Слишком много попыток. Попробуйте позже." }
   ```

5. **Reset on Success**: [`resetRateLimit(rateLimitKey)`](src/app/api/auth/phone/verify-otp/route.ts:118) is called after successful OTP verification to prevent legitimate users from being locked out.

6. **Existing Protection Preserved**: The per-OTP-record [`attempts` counter](src/app/api/auth/phone/verify-otp/route.ts:85) (max 3 attempts per OTP code) remains intact as a second layer of defense.

## Verification
- **Lint**: `pnpm lint` (Pending).
- **Type Check**: `pnpm typecheck` (Pending).

## Limitations
- **Multi-instance**: Since it's in-memory, the limit is per-process. In a horizontally scaled production environment without sticky sessions, the effective limit would be `limit * instances`. For the current single-instance/MVP setup, this is sufficient. For high-scale, Redis-backed rate limiting should be considered.