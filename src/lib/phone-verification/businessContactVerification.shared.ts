/** Состояние escalation OTP (business contact) — согласовано с API и сервером */
export type BusinessContactOtpClientState = {
  supportRequired: boolean;
  lockedUntil: string | null;
  remainingMs: number;
};

export const BUSINESS_CONTACT_OTP_SUPPORT_EMAIL = "support@mamago.by";

export const BUSINESS_CONTACT_VERIFICATION_PURPOSE =
  "BUSINESS_CONTACT_VERIFICATION";
export const LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE = "BUSINESS_PHONE_VERIFY";
export const BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH = 4;

export function isE164Phone(value: string): boolean {
  return /^\+\d{7,15}$/.test(value);
}

export function normalizeBusinessContactVerificationPurpose(
  value: unknown
): typeof BUSINESS_CONTACT_VERIFICATION_PURPOSE | null {
  if (
    value === BUSINESS_CONTACT_VERIFICATION_PURPOSE ||
    value === LEGACY_BUSINESS_PHONE_VERIFY_PURPOSE
  ) {
    return BUSINESS_CONTACT_VERIFICATION_PURPOSE;
  }

  return null;
}

export function isVerifiedPhoneMatch(params: {
  currentPhoneE164: string | null | undefined;
  verifiedPhoneE164: string | null | undefined;
}): boolean {
  return Boolean(
    params.currentPhoneE164 &&
      params.verifiedPhoneE164 &&
      params.currentPhoneE164 === params.verifiedPhoneE164
  );
}
