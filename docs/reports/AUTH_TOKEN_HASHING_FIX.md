# AUTH_TOKEN_HASHING_FIX

## Summary

Password reset (`resetToken`) and email verification (`emailVerificationToken`) tokens are now stored as SHA-256 hashes in the database instead of plaintext. This is a defense-in-depth measure: if the database is compromised, active reset/verification links cannot be used by an attacker because the raw token is only known to the user who received it via email.

## Changes

### New file: `src/lib/auth/tokenHash.ts`

Helper module that provides two exports:

| Export | Signature | Description |
|---|---|---|
| `generateRawToken` | `(): string` | Generates a cryptographically secure 64-char hex token via `crypto.randomBytes(32)` |
| `hashToken` | `(token: string): string` | Returns the SHA-256 hex digest of the input |

### Modified files

| File | What changed |
|---|---|
| `src/server/auth/password-reset.ts` | **Generation**: now calls `generateRawToken()`, stores `hashToken(rawToken)` in DB, sends `rawToken` to email. **Verification**: hashes the incoming `token` before querying the DB. Removed unused `crypto` import. |
| `src/server/auth/email-verification.ts` | **Generation** (`issueEmailVerificationForUser`): now calls `generateRawToken()`, stores `hashToken(rawToken)` in DB, returns `rawToken` to the caller (which passes it to email). **Verification** (`verifyEmailByToken`): hashes the incoming `token` before querying the DB. Removed unused `crypto` import. |

### New test file: `src/lib/auth/tokenHash.test.ts`

Tests cover:
- `generateRawToken` produces a 64-char hex string and is unique per call
- `hashToken` is deterministic (same input → same output)
- Hash is different from the raw token
- Different tokens produce different hashes
- Integration: raw token → hash flow with invalid token rejection

## Design decisions

1. **No Prisma schema changes** — The fields `resetToken`, `resetTokenExpires`, `emailVerificationToken`, `emailVerificationExpires` remain in the `User` model. Only the content stored in the token fields changes (hash instead of plaintext).

2. **Raw token sent only via email** — The raw (unhashed) token is passed to `emailService.sendPasswordResetEmail()` / `emailService.sendVerifyEmail()` which puts it into the email link. After that, only the hash remains in the system.

3. **No logging of raw tokens** — All console output logs only metadata (presence/absence of token, email addresses) and never the raw token value.

4. **No raw token in API responses** — The token fields are never returned to the client in any API response.

5. **Tokens are cleared after use** — Both flows set the respective token and expiry fields to `null` after successful verification.

6. **Expired tokens return generic errors** — `AuthError("INVALID_TOKEN")` for password reset; `{ ok: false, reason: "expired" }` for email verification. No information about whether the token existed or was expired is leaked.

## Files unaffected

The following files require **no changes** because they only pass the token through to the modified functions or construct URLs:

- `src/features/email/lib/email-links.ts` — just builds URLs with the token; token semantics are unchanged
- `src/features/email/server/email-service.tsx` — receives the token and puts it into an email link; raw token is correct here
- `src/app/api/auth/verify-email/[token]/route.ts` — passes `token` from URL to `verifyEmailByToken()`
- `src/app/api/auth/register/route.ts` — calls `sendRegistrationVerificationEmail()`
- `src/app/api/auth/complete-registration/route.ts` — calls `sendRegistrationVerificationEmail()`
- `src/app/api/auth/resend-verification-email/route.ts` — calls `resendVerificationEmailForUser()`
- `src/app/(auth)/forgot-password/actions.ts` — calls `requestPasswordReset()`
- `src/app/(auth)/reset-password/[token]/actions.ts` — passes `token` to `resetPassword()`
- `src/app/(auth)/reset-password/[token]/ResetPasswordForm.tsx` — UI, no token handling
- UI components and email templates — unchanged

## Security analysis

**Before:** Both `resetToken` and `emailVerificationToken` were stored as plain `crypto.randomUUID()` values. A database dump would expose all active reset/verification links as working URLs.

**After:** Only the SHA-256 hash is stored. An attacker with DB access cannot reverse the hash to obtain a working link. The raw token exists only:
1. In memory during generation (scoped to the request)
2. In the email sent to the user
3. In the user's email inbox / browser URL bar

This follows the same principle as password hashing: never store secrets that an attacker could use directly.

## Backward compatibility

**Existing outstanding reset/verification links generated before this migration will become invalid.**

This is acceptable because:
- Password reset tokens expire after 1 hour by design
- Email verification tokens expire after 48 hours by design
- The migration has no downtime and does not touch existing rows — old plaintext tokens simply won't match the new SHA-256 hashing during verification
- Users who encounter an invalid link will see the existing generic error message and can request a new one

## Verification

- `pnpm typecheck` — passes
- `pnpm lint` — passes
- `pnpm vitest run src/lib/auth/tokenHash.test.ts` — all tests pass

## Future considerations

- If token hash migration of existing rows is ever required, a one-time script could re-hash all non-null tokens. This is **not recommended** since the plaintext is already exposed and re-hashing wouldn't improve security for those particular tokens.
- The hashing scheme could be extended to use a per-token salt (stored alongside the hash) for additional hardening, though this is unnecessary given `crypto.randomBytes(32)` already provides 256 bits of entropy.
