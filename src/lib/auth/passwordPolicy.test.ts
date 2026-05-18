/**
 * Тесты для password policy (src/lib/auth/passwordPolicy.ts)
 *
 * Запуск: npx tsx src/lib/auth/passwordPolicy.test.ts
 */

import assert from "node:assert/strict";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_ERROR_MESSAGE,
  passwordSchema,
  validatePasswordPolicy,
} from "./passwordPolicy";

// --- Константы ---

{
  assert.equal(PASSWORD_MIN_LENGTH, 8, "PASSWORD_MIN_LENGTH should be 8");
  assert.equal(PASSWORD_MAX_LENGTH, 128, "PASSWORD_MAX_LENGTH should be 128");
}

// --- validatePasswordPolicy ---

// 7 символов — fail
{
  const result = validatePasswordPolicy("1234567");
  assert.equal(result.valid, false);
  assert.equal("error" in result && result.error, PASSWORD_ERROR_MESSAGE);
}

// 8 символов — pass
{
  const result = validatePasswordPolicy("12345678");
  assert.equal(result.valid, true);
}

// 128 символов — pass
{
  const longPassword = "a".repeat(128);
  const result = validatePasswordPolicy(longPassword);
  assert.equal(result.valid, true);
}

// 129 символов — fail
{
  const longPassword = "a".repeat(129);
  const result = validatePasswordPolicy(longPassword);
  assert.equal(result.valid, false);
  assert.equal("error" in result && result.error, PASSWORD_ERROR_MESSAGE);
}

// Пробелы внутри пароля НЕ удаляются (trim не применяется)
{
  const passwordWithSpaces = "  pass word  ";
  const result = validatePasswordPolicy(passwordWithSpaces);
  // Длина "  pass word  " = 14, проходит min 8
  assert.equal(result.valid, true);
}

// Пустой пароль — fail
{
  const result = validatePasswordPolicy("");
  assert.equal(result.valid, false);
}

// Пароль с пробелами — меньше 8 — fail
{
  const result = validatePasswordPolicy("  ab  ");
  assert.equal(result.valid, false);
}

// Граница: ровно 8 — pass
{
  const result = validatePasswordPolicy("12345678");
  assert.equal(result.valid, true);
}

// Граница: ровно 128 — pass
{
  const result = validatePasswordPolicy("a".repeat(128));
  assert.equal(result.valid, true);
}

// Граница: ровно 129 — fail
{
  const result = validatePasswordPolicy("a".repeat(129));
  assert.equal(result.valid, false);
}

// --- passwordSchema (zod) ---

{
  const parsed = passwordSchema.parse("12345678");
  assert.equal(parsed, "12345678");
}

{
  const parsed = passwordSchema.parse("a".repeat(128));
  assert.equal(parsed, "a".repeat(128));
}

{
  try {
    passwordSchema.parse("1234567");
    assert.fail("Expected ZodError for 7-char password");
  } catch (e: unknown) {
    const zodError = e as { issues?: Array<{ message: string }> };
    assert.ok(zodError.issues !== undefined);
    assert.equal(zodError.issues![0]?.message, PASSWORD_ERROR_MESSAGE);
  }
}

{
  try {
    passwordSchema.parse("a".repeat(129));
    assert.fail("Expected ZodError for 129-char password");
  } catch (e: unknown) {
    assert.ok(e instanceof Error);
  }
}

// passwordSchema НЕ должен триммить пробелы
{
  const parsed = passwordSchema.parse("  spaced  ");
  assert.equal(parsed, "  spaced  ", "passwordSchema should NOT trim whitespace");
}

console.log("All passwordPolicy tests passed ✅");
