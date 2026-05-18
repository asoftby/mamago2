# Upload Preflight Validation Fix

## Problem

Upload routes (`/api/upload`, `/api/upload/v2`, `/api/upload/wizard`) were reading the entire file into memory via `file.arrayBuffer()` **before** any validation of file size or MIME type. This created a DoS (Denial of Service) risk: a malicious client could upload a very large file and cause the Node.js instance to run out of memory or become unresponsive.

## Solution

Added a **preflight validation layer** that runs **before** any memory read (`file.arrayBuffer()`, `Buffer.from()`, `processImage()`, `sharp()`). This is a fast, synchronous check that rejects invalid files immediately without allocating memory for the file contents.

### New Helper

**File:** [`src/lib/uploads/validateUploadPreflight.ts`](src/lib/uploads/validateUploadPreflight.ts)

```ts
validateUploadPreflight(file: File): NextResponse | null
```

- **Size check:** `file.size > 15 * 1024 * 1024` → returns `{ error: "File too large" }` with status **413**
- **MIME type check:** `file.type` must be in allowlist → returns `{ error: "Invalid file type" }` with status **415**
- **Valid file:** returns `null` (pass through)

**Allowed MIME types:**
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `image/avif`

### Modified Routes

| Route | File | Preflight inserted at line |
|-------|------|---------------------------|
| `POST /api/upload` | [`src/app/api/upload/route.ts`](src/app/api/upload/route.ts:57) | Before `file.arrayBuffer()` (line 64) |
| `POST /api/upload/v2` | [`src/app/api/upload/v2/route.ts`](src/app/api/upload/v2/route.ts:39) | Before `file.arrayBuffer()` (line 46) |
| `POST /api/upload/wizard` | [`src/app/api/upload/wizard/route.ts`](src/app/api/upload/wizard/route.ts:63) | Before `file.arrayBuffer()` (line 70) |

### Design Decisions

1. **Separate concern:** Preflight is a dedicated helper, not mixed into `validateImageFile` / `processImage` which operate on `Buffer` (already in memory).
2. **Existing validation preserved:** `validateImageFile` inside [`imageProcessor.ts`](src/lib/media/imageProcessor.ts) still runs during `processImage()` as a second, deeper validation layer. The preflight is the **first fast protective layer**.
3. **Synchronous:** No `await` needed — `File.size` and `File.type` are available immediately from the `File` object without reading its contents.
4. **15 MB limit:** Chosen as a generous upper bound; the existing `DEFAULT_IMAGE_CONFIG.maxUploadSizeMB` is 10 MB for the deep validation inside `processImage`.

## Verification

- `pnpm typecheck` — passes
- `pnpm lint` — passes