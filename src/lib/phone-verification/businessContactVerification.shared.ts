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

/** Safe public copy: do not expose database internals or account identities. */
export const BUSINESS_PHONE_ALREADY_LINKED_MESSAGE =
  "Этот номер уже привязан к другому аккаунту mamaGo. Войдите в него или обратитесь в поддержку.";

/** Match only a unique conflict on phoneE164, never arbitrary P2002 errors. */
export function isBusinessPhoneUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && error.meta && typeof error.meta === "object"
    ? error.meta as Record<string, unknown>
    : null;
  const target = meta?.target;
  return (Array.isArray(target) && target.includes("phoneE164")) ||
    (typeof target === "string" && target.includes("phoneE164"));
}
