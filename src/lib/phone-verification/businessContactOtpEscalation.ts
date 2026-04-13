import "server-only";

import type { User } from "@prisma/client";

import type { BusinessContactOtpClientState } from "./businessContactVerification.shared";
import { BUSINESS_CONTACT_OTP_SUPPORT_EMAIL } from "./businessContactVerification.shared";

/** After 1st / 2nd / 3rd серии из 3 неверных кодов — длительность блокировки. */
const LOCK_DURATION_MS_BY_TIER: [number, number, number] = [
  10 * 60 * 1000,
  30 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

/** Ступень 4+ — только поддержка. */
export const BUSINESS_CONTACT_OTP_SUPPORT_TIER = 4;

export function remainingMsUntil(lockedUntil: Date, now: Date): number {
  return Math.max(0, lockedUntil.getTime() - now.getTime());
}

export function isBusinessContactOtpLocked(user: {
  businessContactOtpLockedUntil: Date | null;
  businessContactOtpSupportRequired: boolean;
}, now: Date): boolean {
  if (user.businessContactOtpSupportRequired) {
    return true;
  }
  if (!user.businessContactOtpLockedUntil) {
    return false;
  }
  return user.businessContactOtpLockedUntil > now;
}

export function lockDurationMsForNewTier(newTier: number): number | null {
  if (newTier < 1 || newTier > LOCK_DURATION_MS_BY_TIER.length) {
    return null;
  }
  return LOCK_DURATION_MS_BY_TIER[newTier - 1] ?? null;
}

export function messageAfterLockApplied(tier: number): string {
  if (tier === 1) {
    return "Превышено количество попыток. Запросить новый код можно через 10 минут.";
  }
  if (tier === 2) {
    return "Слишком много неверных попыток. Попробуйте снова через 30 минут.";
  }
  if (tier === 3) {
    return "Слишком много неверных попыток. Попробуйте снова через 24 часа.";
  }
  return "Слишком много неверных попыток.";
}

export function supportRequiredMessage(): string {
  return `Доступ к подтверждению номера временно ограничен. Напишите в службу поддержки: ${BUSINESS_CONTACT_OTP_SUPPORT_EMAIL}`;
}

export function buildBusinessContactOtpClientState(
  user: Pick<
    User,
    | "businessContactOtpLockedUntil"
    | "businessContactOtpSupportRequired"
  >,
  now: Date = new Date()
): BusinessContactOtpClientState {
  if (user.businessContactOtpSupportRequired) {
    return {
      supportRequired: true,
      lockedUntil: null,
      remainingMs: 0,
    };
  }

  const until = user.businessContactOtpLockedUntil;
  if (!until || until <= now) {
    return {
      supportRequired: false,
      lockedUntil: null,
      remainingMs: 0,
    };
  }

  return {
    supportRequired: false,
    lockedUntil: until.toISOString(),
    remainingMs: remainingMsUntil(until, now),
  };
}
