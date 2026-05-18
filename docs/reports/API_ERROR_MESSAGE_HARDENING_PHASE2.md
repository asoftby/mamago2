# API Error Message Hardening — Phase 2

**Date:** 2026-05-13  
**Scope:** `src/app/api/billing`, `src/app/api/business`, `src/app/api/upload`, `src/app/api/ai`, `src/app/api/me`, `src/app/api/user`  
**Objective:** Ensure no `error.message` is leaked to the client in 500 responses

---

## Methodology

1. **Grep scans** for three patterns across all target directories:
   - `error instanceof Error ? error.message` — direct `error.message` exposure
   - `error.message` — any usage of the `.message` property
   - `status: 500` — all 500-response endpoints

2. **Manual review** of every match to determine if `error.message` is returned to the client in a 500 response.

---

## Results Summary

| File | Pattern Found | Status | Action Taken |
|------|--------------|--------|-------------|
| `src/app/api/business/places/[id]/archive/route.ts` | `error instanceof Error ? error.message` | 400 response | ✅ Skipped (non-500) |
| `src/app/api/business/verification/submit/route.ts` | `error instanceof Error ? error.message` | 400 response | ✅ Skipped (non-500) |
| `src/app/api/ai/rewrite/route.ts` | `error instanceof Error ? error.message` | 500, but message is already generic (`"Не удалось переписать текст..."`) | ✅ Already hardened |
| `src/app/api/business/places/[id]/location/google/route.ts` | `error.message.includes("validation")` / `message: error.message` | Control flow / 400 validation | ✅ Skipped (control flow + non-500) |
| `src/app/api/business/places/[id]/location/manual/route.ts` | `error.message.includes("validation")` / `message: error.message` | Control flow / 400 validation | ✅ Skipped (control flow + non-500) |
| `src/app/api/business/places/route.ts` | `error.message.includes("Unique constraint")` | Control flow only | ✅ Skipped (control flow) |
| `src/app/api/business/instagram/avatar/route.ts` | `error.message === "TIMEOUT"` | Control flow only | ✅ Skipped (control flow) |
| All other `status: 500` endpoints | — | Already use `"Internal server error"` or hardcoded generic strings | ✅ Already hardened |

---

## Detailed Findings

### ✅ Directories already clean (no changes needed)

The following directories already use `{ error: "Internal server error" }` consistently for all 500 responses:

- **`src/app/api/business/bookings/`** — all 7 endpoints
- **`src/app/api/business/reputation/`** — 1 endpoint
- **`src/app/api/business/instagram/`** — 1 endpoint
- **`src/app/api/me/`** — all 4 endpoints
- **`src/app/api/user/`** — 1 endpoint
- **`src/app/api/upload/`** — all 3 endpoints
- **`src/app/api/ai/detect-category/`** — 1 endpoint

### ✅ Files with `error.message` only in console.error (safe)

- `src/app/api/ai/rewrite/route.ts` — `console.error` logs `error.message` but response uses hardcoded generic message
- `src/app/api/business/places/[id]/location/google/route.ts` — logs `error.stack` to console only
- `src/app/api/business/places/[id]/location/manual/route.ts` — logs `error.stack` to console only

### ✅ Files using `error.message` for control flow (safe)

- `src/app/api/business/places/route.ts` — `error.message.includes("Unique constraint")` to decide 409 vs 500
- `src/app/api/business/places/[id]/location/google/route.ts` — `error.message.includes("validation")` to decide 400 vs 500
- `src/app/api/business/places/[id]/location/manual/route.ts` — `error.message.includes("validation")` to decide 400 vs 500
- `src/app/api/business/instagram/avatar/route.ts` — `error.message === "TIMEOUT"` to decide retry vs 500

---

## Lint & Typecheck

- **`pnpm lint`:** 39 errors / 525 warnings — all pre-existing (mostly `@typescript-eslint/no-explicit-any` and unused vars). No new issues introduced.
- **`npx tsc --noEmit`:** 4 errors — all pre-existing (sentry config, settings module import, signals utils). No new issues introduced.

---

## Conclusion

**No code changes were required.** All target directories (`billing`, `business`, `upload`, `ai`, `me`, `user`) were already hardened with respect to 500-response error message leakage. Every 500 response uses either `"Internal server error"` or a hardcoded generic string. No `error.message` is leaked to the client through any 500 response path.

The Phase 1 foundations (centralized error patterns) have been successfully maintained across the codebase.
