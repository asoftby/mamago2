import "server-only";

import { BUSINESS_CONTACT_OTP_SUPPORT_EMAIL } from "./businessContactVerification.shared";

export { BUSINESS_CONTACT_OTP_SUPPORT_EMAIL };

export type BusinessContactOtpErrorCode =
  | "OTP_LOCKED"
  | "OTP_SUPPORT"
  | "OTP_INVALID";

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
