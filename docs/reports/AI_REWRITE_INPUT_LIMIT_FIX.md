# AI Rewrite Input Limit Fix

## Problem

The [`POST /api/ai/rewrite`](src/app/api/ai/rewrite/route.ts) endpoint had no upper bound on `sourceText` length — only a `min(20)` constraint via Zod. This created several risks:

- **Cost drain**: An attacker or bug could send multi-megabyte payloads, each billed by token count to OpenRouter.
- **OpenRouter request overload**: Excessively long prompts could hit provider timeouts or be rejected, wasting a request.
- **Prompt injection surface**: Overly long payloads could be used to smuggle injection payloads past the system prompt.

## Changes

### 1. Zod schema — max-length constraints

File: [`src/app/api/ai/rewrite/route.ts`](src/app/api/ai/rewrite/route.ts:9)

| Field | Before | After |
|-------|--------|-------|
| `sourceText` | `z.string().trim().min(20)` | `z.string().trim().min(20).max(8000)` |
| `title` | `z.string().trim().optional()` | `z.string().trim().max(200).optional()` |

The `tone` field is an enum (`"neutral" | "friendly" | "editorial" | "short"`) — already bounded by Zod's enum validation. No additional `max` needed.

### 2. Generic 400 error response

Before: [`{ error: "Validation error", details: parsed.error.flatten() }`](src/app/api/ai/rewrite/route.ts:161)

After: [`{ error: "Invalid input" }`](src/app/api/ai/rewrite/route.ts:161)

This prevents leaking internal Zod schema structure to the client.

### 3. Server-side hard guard

Added a runtime length check [`before the OpenRouter API call`](src/app/api/ai/rewrite/route.ts:168):

```ts
if (parsed.data.sourceText.length > 8000) {
  return NextResponse.json(
    { error: "Invalid input" },
    { status: 400 },
  );
}
```

This is a defense-in-depth measure: even if the Zod schema is modified or bypassed in the future, the provider will never receive a payload with `sourceText` exceeding 8000 characters.

### 4. Tests

Added [`src/app/api/ai/rewrite/route.test.ts`](src/app/api/ai/rewrite/route.test.ts) with 13 test cases:

| # | Test | Expected |
|---|------|----------|
| 1 | `sourceText` = 20 chars | ✅ passes |
| 2 | `sourceText` = 19 chars | ❌ fails (below min) |
| 3 | `sourceText` = 7999 chars | ✅ passes |
| 4 | `sourceText` = 8000 chars | ✅ passes (exactly max) |
| 5 | `sourceText` = 8001 chars | ❌ fails (exceeds max) |
| 6 | `title` = 200 chars | ✅ passes |
| 7 | `title` = 201 chars | ❌ fails |
| 8 | `title` missing (optional) | ✅ passes |
| 9 | `title` = empty string | ✅ passes |
| 10 | Error response is generic, no Zod details | ✅ `{ error: "Invalid input" }` |
| 11 | Hard guard: 8001 chars blocks provider | ✅ `shouldCallProvider === false` |
| 12 | Hard guard: 8000 chars allows provider | ✅ `shouldCallProvider === true` |
| 13 | Hard guard: 7999 chars allows provider | ✅ `shouldCallProvider === true` |

Run with: `npx tsx src/app/api/ai/rewrite/route.test.ts`

## What was NOT changed

- **System prompt** — untouched (lines 16–39)
- **UI** — no frontend changes
- **OpenRouter client** — fetch logic, headers, model selection unchanged
- **Other API routes** — only `/api/ai/rewrite` was modified

## Verification

```bash
pnpm typecheck  # ✅ passes
pnpm lint       # ✅ passes
npx tsx src/app/api/ai/rewrite/route.test.ts  # ✅ 13/13 passed