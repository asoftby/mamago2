import "server-only";

import { BUSINESS_CONTACT_OTP_SUPPORT_EMAIL } from "./businessContactVerification.shared";

export { BUSINESS_CONTACT_OTP_SUPPORT_EMAIL };

export type BusinessContactOtpErrorCode =
  | "OTP_LOCKED"
  | "OTP_SUPPORT"
  | "OTP_INVALID";

/** Shared outbound-SMS budget is independent of an individual phone cooldown. */
export class BusinessContactSmsRateLimitError extends Error {
  readonly code = "SMS_RATE_LIMITED" as const;

  constructor() {
    super("Слишком много запросов SMS. Попробуйте позже.");
    this.name = "BusinessContactSmsRateLimitError";
  }
}

export function isBusinessContactSmsRateLimitError(error: unknown): error is BusinessContactSmsRateLimitError {
  return error instanceof BusinessContactSmsRateLimitError;
}

export class BusinessContactOtpEscalationError extends Error {
  readonly code: BusinessContactOtpErrorCode;

  readonly lockedUntil?: Date;

  readonly remainingMs?: number;

  constructor(
    message: string,
    code: BusinessContactOtpErrorCode,
    opts?: { lockedUntil?: Date; remainingMs?: number }
  ) {
    super(message);
    this.name = "BusinessContactOtpEscalationError";
    this.code = code;
    this.lockedUntil = opts?.lockedUntil;
    this.remainingMs = opts?.remainingMs;
  }
}

export function isBusinessContactOtpEscalationError(
  e: unknown
): e is BusinessContactOtpEscalationError {
  return e instanceof BusinessContactOtpEscalationError;
}
