/**
 * One interpretation of OTP SMS dispatch outcomes for both settings UIs.
 * A provider timeout or malformed response may occur AFTER an SMS was queued,
 * so SMS_DELIVERY_UNKNOWN must allow entry of the retained OTP.
 */
export type PhoneOtpSendPayload = {
  code?: string;
  error?: string;
  resendAfterSec?: number;
  phoneE164?: string;
};

export type PhoneOtpSendOutcome =
  | { step: "entry"; error: string }
  | { step: "confirm"; phoneE164: string; cooldownSec: number; warning: string | null };

export function resolvePhoneOtpSendOutcome(
  responseOk: boolean,
  data: PhoneOtpSendPayload | null,
  requestedPhone: string,
): PhoneOtpSendOutcome {
  const deliveryUnknown = !responseOk && data?.code === "SMS_DELIVERY_UNKNOWN";
  if (!responseOk && !deliveryUnknown) {
    return { step: "entry", error: data?.error || "Не удалось отправить код" };
  }

  const seconds = data?.resendAfterSec;
  const cooldownSec = typeof seconds === "number" && Number.isFinite(seconds)
    ? Math.max(0, Math.ceil(seconds))
    : 60;

  return {
    step: "confirm",
    // Unconfirmed delivery still leaves a usable OTP bound to the requested number.
    phoneE164: data?.phoneE164 || requestedPhone,
    cooldownSec,
    warning: deliveryUnknown
      ? data?.error || "Отправка SMS не подтверждена. Если код придёт, введите его."
      : null,
  };
}
