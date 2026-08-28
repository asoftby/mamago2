import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PASSWORD_RESET_RATE_LIMIT_MAX,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/auth/passwordResetPolicy";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

assert.equal(PASSWORD_RESET_RESEND_COOLDOWN_SECONDS, 60);
assert.equal(PASSWORD_RESET_RATE_LIMIT_MAX, 3);
assert.equal(PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
assert.equal(PASSWORD_RESET_TOKEN_TTL_MS, 60 * 60 * 1000);

const forgotForm = read("src/app/(auth)/forgot-password/ForgotPasswordForm.tsx");
assert.match(
  forgotForm,
  /state\.ok && state\.status === "sent"/,
  "forgot-password must replace the email form with a dedicated sent state",
);
assert.match(forgotForm, /Проверьте почту/);
assert.match(forgotForm, /type="hidden" name="email" value=\{state\.email\}/);
assert.match(forgotForm, /PASSWORD_RESET_RESEND_COOLDOWN_SECONDS/);
assert.match(forgotForm, /Вернуться ко входу/);

const forgotAction = read("src/app/(auth)/forgot-password/actions.ts");
assert.match(forgotAction, /status: "sent"/);
assert.match(forgotAction, /sentAt: Date\.now\(\)/);

const resetServer = read("src/server/auth/password-reset.ts");
assert.match(resetServer, /password-reset:cooldown:/);
assert.match(resetServer, /password-reset:window:/);
assert.match(resetServer, /getPasswordResetRateLimitFingerprint/);
assert.match(
  resetServer,
  /await tx\.session\.deleteMany\(\{ where: \{ userId: user\.id \} \}\)/,
  "successful password reset must revoke all existing sessions",
);
assert.match(resetServer, /export async function isPasswordResetTokenValid/);
assert.match(
  resetServer,
  /prisma\.notificationDelivery\.create/,
  "password reset email attempts must be visible in NotificationDelivery",
);
assert.match(resetServer, /kind: "password-reset"/);
assert.match(resetServer, /status: "PENDING"/);
assert.match(resetServer, /status: "SENT"/);
assert.match(resetServer, /status: "SKIPPED"/);
assert.match(resetServer, /status: "FAILED"/);
assert.match(resetServer, /EMAIL_DISABLED/);
assert.match(resetServer, /EMAIL_NOT_CONFIGURED/);
assert.match(resetServer, /EMAIL_DEBUG_REDIRECT_ACTIVE_IN_PROD/);
assert.match(resetServer, /emailService\.getHealth\(\)/);
assert.match(
  resetServer,
  /account\.status === "PENDING_ACTIVATION"/,
  "migrated pending accounts must be eligible for self-service password reset",
);
assert.match(
  resetServer,
  /const activatesMigratedAccount = user\.status === "PENDING_ACTIVATION"/,
  "successful reset must detect migrated pending accounts",
);
assert.match(
  resetServer,
  /status: "ACTIVE"/,
  "successful reset must activate a migrated pending account",
);
assert.match(
  resetServer,
  /purpose: "MIGRATED_ACCOUNT_ACTIVATION"/,
  "successful reset must invalidate stale migrated-account activation tokens",
);
assert.doesNotMatch(
  resetServer,
  /Pending migrated users must activate instead of establishing a password via reset/,
  "password reset must no longer block migrated pending accounts",
);

const verificationServer = read("src/server/auth/email-verification.ts");
assert.match(
  verificationServer,
  /prisma\.notificationDelivery\.create/,
  "verification email attempts must be visible in NotificationDelivery",
);
assert.match(verificationServer, /kind: "verify-email"/);
assert.match(verificationServer, /status: "PENDING"/);
assert.match(verificationServer, /status: "SENT"/);
assert.match(verificationServer, /status: "SKIPPED"/);
assert.match(verificationServer, /status: "FAILED"/);
assert.match(verificationServer, /EMAIL_DISABLED/);
assert.match(verificationServer, /EMAIL_NOT_CONFIGURED/);
assert.match(verificationServer, /EMAIL_DEBUG_REDIRECT_ACTIVE_IN_PROD/);
assert.match(verificationServer, /verificationEmailSendFailed: true/);
assert.match(
  verificationServer,
  /console\.info\("\[auth\] verification email sent successfully", \{\s*event: "verify_email_sent_successfully",\s*userId,\s*\}\);/,
  "verification success log must only include non-recipient metadata",
);

const emailHealthRoute = read("src/app/api/admin/communications/email/health/route.ts");
assert.match(emailHealthRoute, /requireAdminApiUser/);
assert.match(emailHealthRoute, /provider: "resend"/);
assert.match(emailHealthRoute, /deliveries1h/);
assert.match(emailHealthRoute, /lastSuccessfulAt/);
assert.match(emailHealthRoute, /lastFailure/);
assert.match(emailHealthRoute, /debugRedirect/);
assert.match(emailHealthRoute, /MISCONFIGURED/);
assert.match(emailHealthRoute, /DEGRADED/);
assert.match(emailHealthRoute, /CONFIGURED/);
assert.match(
  emailHealthRoute,
  /if \(params\.failed1h > 0\) return "DEGRADED"/,
  "recent provider failures must never be hidden behind successful attempts",
);
assert.match(
  emailHealthRoute,
  /if \(params\.sent1h > 0\) return "OK";\s*return "CONFIGURED";/,
  "configured env without a real recent send must not be false-green",
);

const resetPage = read("src/app/(auth)/reset-password/[token]/page.tsx");
assert.match(resetPage, /await isPasswordResetTokenValid\(token\)/);
assert.match(resetPage, /Ссылка больше не действует/);
assert.match(resetPage, /href="\/forgot-password"/);

const resetForm = read("src/app/(auth)/reset-password/[token]/ResetPasswordForm.tsx");
assert.match(resetForm, /minLength=\{PASSWORD_MIN_LENGTH\}/);
assert.match(resetForm, /maxLength=\{PASSWORD_MAX_LENGTH\}/);
assert.match(resetForm, /fieldErrors\?\.confirmPassword/);
assert.doesNotMatch(resetForm, /minLength=\{6\}/);
assert.doesNotMatch(resetForm, /Минимум 6 символов/);

const resetAction = read("src/app/(auth)/reset-password/[token]/actions.ts");
assert.match(resetAction, /confirmPassword: \["Пароли не совпадают"\]/);
assert.match(resetAction, /code: "INVALID_TOKEN"/);

console.log("passwordResetFlow.test.ts: OK");