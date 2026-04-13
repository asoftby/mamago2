import "server-only";

import prisma from "@/lib/prisma";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { genCode4, hashCode, safeEq } from "@/lib/otp/otp";
import { sendQuickSms } from "@/lib/sms/smsBy";
import {
  type BusinessContactOtpClientState,
  BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH,
  BUSINESS_CONTACT_VERIFICATION_PURPOSE,
  isE164Phone,
} from "./businessContactVerification.shared";
import {
  BusinessContactOtpEscalationError,
} from "./businessContactOtpErrors";
import {
  buildBusinessContactOtpClientState,
  isBusinessContactOtpLocked,
  lockDurationMsForNewTier,
  messageAfterLockApplied,
  remainingMsUntil,
  supportRequiredMessage,
  BUSINESS_CONTACT_OTP_SUPPORT_TIER,
} from "./businessContactOtpEscalation";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_SEC = 60;

const USER_OTP_ESCALATION_SELECT = {
  businessContactOtpFailedAttempts: true,
  businessContactOtpLockTier: true,
  businessContactOtpLockedUntil: true,
  businessContactOtpSupportRequired: true,
} as const;

const INVALID_OTP_MESSAGE = "Неверный код. Попробуйте еще раз.";

export function normalizeBusinessContactPhone(input: string): string {
  const phoneE164 = normalizePhoneToE164(String(input));

  if (!isE164Phone(phoneE164)) {
    throw new Error("Неверный формат телефона");
  }

  return phoneE164;
}

export function isBusinessContactPhoneVerifiedForUser(params: {
  phoneE164: string;
  userPhoneE164: string | null | undefined;
  userPhoneVerifiedAt: Date | null | undefined;
}): boolean {
  return (
    params.userPhoneE164 === params.phoneE164 &&
    params.userPhoneVerifiedAt instanceof Date
  );
}

function assertCanSendBusinessContactOtp(user: {
  businessContactOtpLockedUntil: Date | null;
  businessContactOtpSupportRequired: boolean;
}, now: Date): void {
  if (user.businessContactOtpSupportRequired) {
    throw new BusinessContactOtpEscalationError(
      supportRequiredMessage(),
      "OTP_SUPPORT"
    );
  }

  if (
    user.businessContactOtpLockedUntil &&
    user.businessContactOtpLockedUntil > now
  ) {
    const remainingMs = remainingMsUntil(user.businessContactOtpLockedUntil, now);
    throw new BusinessContactOtpEscalationError(
      `Повторная отправка кода будет доступна через ${formatRemainingShort(remainingMs)}.`,
      "OTP_LOCKED",
      {
        lockedUntil: user.businessContactOtpLockedUntil,
        remainingMs,
      }
    );
  }
}

function formatRemainingShort(ms: number): string {
  const m = Math.ceil(ms / 60000);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0 ? `${h} ч ${min} мин` : `${h} ч`;
  }
  return `${Math.max(1, m)} мин`;
}

export async function sendBusinessContactVerificationCode(params: {
  userId: string;
  phone: string;
}): Promise<{
  expiresAt: string;
  resendAfterSec: number;
  otpState: ReturnType<typeof buildBusinessContactOtpClientState>;
}> {
  const phoneE164 = normalizeBusinessContactPhone(params.phone);
  const phoneDigits = phoneE164.replace(/\D/g, "");
  const now = new Date();

  const escalationUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: USER_OTP_ESCALATION_SELECT,
  });

  if (!escalationUser) {
    throw new Error("Пользователь не найден");
  }

  assertCanSendBusinessContactOtp(escalationUser, now);

  const existing = await prisma.phoneOtp.findUnique({
    where: {
      userId_phoneE164_purpose: {
        userId: params.userId,
        phoneE164,
        purpose: BUSINESS_CONTACT_VERIFICATION_PURPOSE,
      },
    },
  });

  if (existing && existing.expiresAt > now) {
    const elapsed = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
    const remaining = RESEND_COOLDOWN_SEC - elapsed;

    if (remaining > 0) {
      throw new Error(`Повторная отправка через ${Math.ceil(remaining)} сек.`);
    }
  }

  const code = genCode4();
  const codeHash = hashCode(code);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  await prisma.$transaction(async (tx) => {
    await tx.phoneOtp.upsert({
      where: {
        userId_phoneE164_purpose: {
          userId: params.userId,
          phoneE164,
          purpose: BUSINESS_CONTACT_VERIFICATION_PURPOSE,
        },
      },
      create: {
        userId: params.userId,
        phoneE164,
        purpose: BUSINESS_CONTACT_VERIFICATION_PURPOSE,
        codeHash,
        expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
      update: {
        codeHash,
        expiresAt,
        lastSentAt: now,
        attempts: 0,
      },
    });

    await tx.user.update({
      where: { id: params.userId },
      data: {
        businessContactOtpFailedAttempts: 0,
      },
    });
  });

  if (process.env.NODE_ENV === "development" && process.env.FORCE_SMS !== "true") {
    console.log(
      `[OTP dev] ${phoneE164} [${BUSINESS_CONTACT_VERIFICATION_PURPOSE}] -> ${code}`
    );
  } else {
    const smsResult = await sendQuickSms({
      phoneDigits,
      message: `Ваш код: ${code}`,
    });
    console.log(
      `[OTP sms] sent to ${phoneE164} [${BUSINESS_CONTACT_VERIFICATION_PURPOSE}] -> sms_id=${smsResult.sms_id} status=${smsResult.status}`
    );
  }

  const fresh = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      businessContactOtpLockedUntil: true,
      businessContactOtpSupportRequired: true,
    },
  });

  return {
    expiresAt: expiresAt.toISOString(),
    resendAfterSec: RESEND_COOLDOWN_SEC,
    otpState: buildBusinessContactOtpClientState(
      fresh ?? {
        businessContactOtpLockedUntil: null,
        businessContactOtpSupportRequired: false,
      },
      new Date()
    ),
  };
}

export async function verifyBusinessContactVerificationCode(params: {
  userId: string;
  phone: string;
  code: string;
}): Promise<{
  phoneE164: string;
  verifiedAt: string;
  otpState: ReturnType<typeof buildBusinessContactOtpClientState>;
}> {
  const phoneE164 = normalizeBusinessContactPhone(params.phone);
  const code = String(params.code).replace(/\D/g, "");

  if (code.length !== BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH) {
    throw new Error("Код должен содержать 4 цифры");
  }

  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: USER_OTP_ESCALATION_SELECT,
  });

  if (!user) {
    throw new Error("Пользователь не найден");
  }

  if (user.businessContactOtpSupportRequired) {
    throw new BusinessContactOtpEscalationError(
      supportRequiredMessage(),
      "OTP_SUPPORT"
    );
  }

  if (isBusinessContactOtpLocked(user, now)) {
    const until = user.businessContactOtpLockedUntil!;
    const remainingMs = remainingMsUntil(until, now);
    throw new BusinessContactOtpEscalationError(
      `Ввод кода временно недоступен. Попробуйте снова через ${formatRemainingShort(remainingMs)}.`,
      "OTP_LOCKED",
      { lockedUntil: until, remainingMs }
    );
  }

  const otpRecord = await prisma.phoneOtp.findUnique({
    where: {
      userId_phoneE164_purpose: {
        userId: params.userId,
        phoneE164,
        purpose: BUSINESS_CONTACT_VERIFICATION_PURPOSE,
      },
    },
  });

  if (!otpRecord) {
    throw new Error("Код не найден. Запросите новый");
  }

  if (otpRecord.expiresAt < now) {
    await prisma.phoneOtp.delete({ where: { id: otpRecord.id } });
    throw new Error("Код истёк. Запросите новый");
  }

  const inputHash = hashCode(code);
  const isValid = safeEq(inputHash, otpRecord.codeHash);

  if (!isValid) {
    const afterIncrement = await prisma.user.update({
      where: { id: params.userId },
      data: { businessContactOtpFailedAttempts: { increment: 1 } },
      select: USER_OTP_ESCALATION_SELECT,
    });

    if (afterIncrement.businessContactOtpFailedAttempts < 3) {
      throw new BusinessContactOtpEscalationError(
        INVALID_OTP_MESSAGE,
        "OTP_INVALID"
      );
    }

    const newTier = afterIncrement.businessContactOtpLockTier + 1;

    if (newTier >= BUSINESS_CONTACT_OTP_SUPPORT_TIER) {
      await prisma.user.update({
        where: { id: params.userId },
        data: {
          businessContactOtpSupportRequired: true,
          businessContactOtpFailedAttempts: 0,
          businessContactOtpLockedUntil: null,
        },
      });
      throw new BusinessContactOtpEscalationError(
        supportRequiredMessage(),
        "OTP_SUPPORT"
      );
    }

    const durationMs = lockDurationMsForNewTier(newTier);
    if (durationMs == null) {
      throw new Error("Внутренняя ошибка блокировки OTP");
    }

    const lockedUntil = new Date(now.getTime() + durationMs);

    await prisma.user.update({
      where: { id: params.userId },
      data: {
        businessContactOtpLockTier: newTier,
        businessContactOtpLockedUntil: lockedUntil,
        businessContactOtpFailedAttempts: 0,
      },
    });

    throw new BusinessContactOtpEscalationError(
      messageAfterLockApplied(newTier),
      "OTP_LOCKED",
      {
        lockedUntil,
        remainingMs: durationMs,
      }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.userId },
      data: {
        phoneE164,
        phoneVerifiedAt: now,
        businessContactOtpFailedAttempts: 0,
        businessContactOtpLockTier: 0,
        businessContactOtpLockedUntil: null,
        businessContactOtpSupportRequired: false,
      },
    });

    await tx.phoneOtp.delete({ where: { id: otpRecord.id } });
  });

  const fresh = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      businessContactOtpLockedUntil: true,
      businessContactOtpSupportRequired: true,
    },
  });

  return {
    phoneE164,
    verifiedAt: now.toISOString(),
    otpState: buildBusinessContactOtpClientState(fresh!, new Date()),
  };
}

export async function loadBusinessContactOtpClientState(
  userId: string
): Promise<BusinessContactOtpClientState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      businessContactOtpLockedUntil: true,
      businessContactOtpSupportRequired: true,
    },
  });

  if (!user) {
    return {
      supportRequired: false,
      lockedUntil: null,
      remainingMs: 0,
    };
  }

  return buildBusinessContactOtpClientState(user);
}
