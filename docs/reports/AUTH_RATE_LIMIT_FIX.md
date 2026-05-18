# Security Report: Auth Rate Limiting

## Status
- **Date**: 2026-05-12
- **Area**: Authentication Security
- **Type**: Brute-force protection

## Issue Description
Previously, the `/api/auth/login` endpoint had no rate limiting, making it vulnerable to brute-force and credential stuffing attacks.

## Implemented Fix
A simple, robust in-memory rate limiter has been implemented to protect the login endpoint.

### 1. Rate Limit Helper (`src/lib/security/rateLimit.ts`)
- **Storage**: In-memory `Map`.
- **Cleanup**: Automatic expiration of old entries (every 5 minutes or on access).
- **Features**: Thread-safe (JS event loop), zero external dependencies.

### 2. Login Endpoint Integration (`src/app/api/auth/login/route.ts`)
- **Key Strategy**: `login:${ip}:${normalizedEmail}`
- **IP Extraction Hierarchy**:
  1. `cf-connecting-ip` (Cloudflare)
  2. `x-real-ip` (Proxies)
  3. `x-forwarded-for` (first entry)
  4. Fallback to `unknown`
- **Configuration**:
  - **Limit**: 5 attempts
  - **Window**: 15 minutes
- **Logic**:
  - Check performed **before** any database lookups or password verification.
  - Returns `429 Too Many Requests` with a clear Russian message for users.
  - Counter is **reset** on successful login to avoid locking out valid users who mistyped their password a few times.

## Verification
- **Unit Tests**: `src/lib/security/rateLimit.test.ts` (Passed).
- **Type Check**: `pnpm typecheck` (Pending).
- **Lint**: `pnpm lint` (Pending).

## Limitations
- **Multi-instance**: Since it's in-memory, the limit is per-process. In a horizontally scaled production environment without sticky sessions, the effective limit would be `limit * instances`. For the current single-instance/MVP setup, this is sufficient. For high-scale, Redis-backed rate limiting should be considered.
