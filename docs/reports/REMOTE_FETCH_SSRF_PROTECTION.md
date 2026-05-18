# Remote Fetch SSRF Protection

**Date:** 2026-05-13  
**Objective:** Add SSRF protection for all server-side remote image fetches (Instagram avatar imports, image import pipeline)

---

## Problem

Two server-side functions perform `fetch()` against external URLs that originate from external API responses:

| Function | File | Origin of URL |
|----------|------|---------------|
| [`uploadImageFromUrl`](src/lib/upload/uploadFromUrl.ts) | Instagram avatar import | Instagram GraphQL API (`hd_profile_pic_url_info.url`) |
| [`optimizeImportedImage`](src/server/media/imported-image-optimizer.ts) | Import publish pipeline | External import data (`coverImageUrl`) |

Without validation, an attacker who controls the upstream data could make the server fetch arbitrary URLs (SSRF), including:

- `localhost` / `127.0.0.1` — internal services
- `169.254.169.254` — cloud metadata endpoints (AWS/GCP/Azure)
- `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x` — private network
- `metadata.google.internal` — GCP metadata
- Arbitrary external domains — data exfiltration

---

## Solution

### New helper: [`src/lib/security/assertSafeRemoteUrl.ts`](src/lib/security/assertSafeRemoteUrl.ts)

A strict URL validation function that enforces:

| Rule | Implementation |
|------|---------------|
| **Protocol** | HTTPS only (`https:`) — rejects `http:`, `ftp:`, etc. |
| **Hostname whitelist** | Must end with `.fbcdn.net`, `.cdninstagram.com`, or `.instagram.com` |
| **Private IPs** | Blocks `10.*`, `127.*`, `172.16-31.*`, `192.168.*`, `0.*`, `100.64-127.*` (CGNAT) |
| **Link-local** | Blocks `169.254.x.x`, `fe80::/10` (IPv6 link-local) |
| **Loopback** | Blocks `localhost`, `127.0.0.0/8`, `::1`, `0.0.0.0` |
| **Cloud metadata** | Blocks `metadata.google.internal`, `169.254.169.254` |
| **Raw IPs** | Any raw IPv4 or IPv6 address is rejected — a hostname is required |
| **Invalid URLs** | Empty strings, whitespace, unparseable input — all rejected |

All violations throw `new Error("Unsafe remote URL")` — a single, unambiguous message that does not reveal the reason (avoiding information leakage).

### Integration points

The helper is called **before** every remote `fetch()`:

1. [`src/lib/upload/uploadFromUrl.ts`](src/lib/upload/uploadFromUrl.ts) — `uploadImageFromUrl()`
   - Called from Instagram avatar import route with `picUrl` from Instagram GraphQL API

2. [`src/server/media/imported-image-optimizer.ts`](src/server/media/imported-image-optimizer.ts) — `optimizeImportedImage()`
   - Called from import publish pipeline with `coverImageUrl` from external import data
   - Returns `{ ok: false, error: "Unsafe remote URL" }` on failure (non-throwing)

Both Instagram API fetch calls in [`src/app/api/business/instagram/avatar/route.ts`](src/app/api/business/instagram/avatar/route.ts) (Step 1 and Step 2) are **hardcoded** to `https://www.instagram.com/...` URLs constructed from user input, so they are safe by construction. The SSRF risk was only in Step 3, where the `picUrl` from the API response is fetched — this is now protected by `uploadImageFromUrl`.

### Tests: [`src/lib/security/assertSafeRemoteUrl.test.ts`](src/lib/security/assertSafeRemoteUrl.test.ts)

27 tests, all passing:

**Valid URLs (6):**
- `cdninstagram.com` subdomain
- `fbcdn.net` subdomain
- `instagram.com` main domain
- deep subdomain of `cdninstagram.com`
- URL with path and query string

**Rejected (21):**
- `localhost`, `127.0.0.1`, `127.0.0.2`
- `169.254.169.254`, `metadata.google.internal`
- `10.0.0.1`, `172.16.0.1`, `172.31.255.255`, `192.168.1.1`
- `http://`, `ftp://`
- `evil.com`, `malicious-site.ru`, `cdn.evil.com`
- `8.8.8.8` (public DNS — raw IP rejected)
- empty string, whitespace-only, invalid URL
- `[::1]` (IPv6 loopback), `[fe80::1]` (IPv6 link-local)
- `0.0.0.0`

---

## Files Changed

| File | Change |
|------|--------|
| [`src/lib/security/assertSafeRemoteUrl.ts`](src/lib/security/assertSafeRemoteUrl.ts) | **Created** — SSRF validation helper |
| [`src/lib/security/assertSafeRemoteUrl.test.ts`](src/lib/security/assertSafeRemoteUrl.test.ts) | **Created** — 27 tests |
| [`src/lib/upload/uploadFromUrl.ts`](src/lib/upload/uploadFromUrl.ts) | **Modified** — added `assertSafeRemoteUrl(imageUrl)` before fetch |
| [`src/server/media/imported-image-optimizer.ts`](src/server/media/imported-image-optimizer.ts) | **Modified** — added `assertSafeRemoteUrl(originalUrl)` before fetch |

## Verification

- **`pnpm lint`** on all changed files — no errors
- **`npx tsc --noEmit`** — no new type errors (only pre-existing errors)
- **Tests** — 27/27 passed
