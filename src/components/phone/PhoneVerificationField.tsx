"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import PhoneInput from "react-phone-number-input";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  BUSINESS_CONTACT_OTP_SUPPORT_EMAIL,
  BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH,
  BUSINESS_CONTACT_VERIFICATION_PURPOSE,
  type BusinessContactOtpClientState,
  isE164Phone,
  isVerifiedPhoneMatch,
} from "@/lib/phone-verification/businessContactVerification.shared";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";

type VerificationStatus =
  | "idle"
  | "sending"
  | "code_sent"
  | "verifying"
  | "verified"
  | "error";

const DEFAULT_OTP_STATE: BusinessContactOtpClientState = {
  supportRequired: false,
  lockedUntil: null,
  remainingMs: 0,
};

function errorToText(e: unknown): string {
  if (!e) return "Неизвестная ошибка";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null) {
    if ("error" in e && typeof (e as { error?: unknown }).error === "string") {
      return (e as { error: string }).error;
    }
    if ("message" in e && typeof (e as { message?: unknown }).message === "string") {
      return (e as { message: string }).message;
    }
  }
  return "Не удалось выполнить действие";
}

function parseOtpStateFromJson(data: unknown): BusinessContactOtpClientState | null {
  if (!data || typeof data !== "object") return null;
  const o = data as { otpState?: BusinessContactOtpClientState };
  const s = o.otpState;
  if (!s || typeof s.supportRequired !== "boolean") return null;
  return {
    supportRequired: s.supportRequired,
    lockedUntil: s.lockedUntil ?? null,
    remainingMs: typeof s.remainingMs === "number" ? s.remainingMs : 0,
  };
}

function formatRemainingMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (m > 0) {
    return `${m} мин ${sec} сек`;
  }
  return `${sec} сек`;
}

function emptyOtpDigits(): string[] {
  return Array.from({ length: BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH }, () => "");
}

export interface PhoneVerificationFieldProps {
  phoneE164: string;
  verifiedPhoneE164?: string | null;
  fieldError?: string;
  onPhoneChange: (phoneE164: string) => void;
  onVerifiedPhoneChange: (phoneE164: string | null) => void;
  /** Серверное состояние escalation OTP при первом рендере */
  initialOtpState?: BusinessContactOtpClientState;
}

export function PhoneVerificationField({
  phoneE164,
  verifiedPhoneE164,
  fieldError,
  onPhoneChange,
  onVerifiedPhoneChange,
  initialOtpState,
}: PhoneVerificationFieldProps) {
  const [status, setStatus] = useState<VerificationStatus>(
    isVerifiedPhoneMatch({ currentPhoneE164: phoneE164, verifiedPhoneE164 })
      ? "verified"
      : "idle"
  );
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(emptyOtpDigits);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [otpState, setOtpState] = useState<BusinessContactOtpClientState>(
    () => initialOtpState ?? DEFAULT_OTP_STATE
  );

  const codeInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ] as const;
  const verifyLockRef = useRef(false);

  const isVerified = useMemo(
    () =>
      isVerifiedPhoneMatch({
        currentPhoneE164: phoneE164,
        verifiedPhoneE164,
      }),
    [phoneE164, verifiedPhoneE164]
  );
  const isPhoneValid = isE164Phone(phoneE164);

  const otpEscalationBlocksInput = useMemo(() => {
    if (otpState.supportRequired) return true;
    if (otpState.lockedUntil && otpState.remainingMs > 0) return true;
    return false;
  }, [otpState]);

  useEffect(() => {
    setOtpState(initialOtpState ?? DEFAULT_OTP_STATE);
  }, [initialOtpState]);

  useEffect(() => {
    if (otpState.supportRequired) {
      setShowCodeInput(false);
    }
  }, [otpState.supportRequired]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const refreshOtpState = useCallback(async () => {
    try {
      const response = await fetch(
        sameOriginUrl("/api/phone/business-contact-otp-state")
      );
      const data = await response.json().catch(() => null);
      const next = parseOtpStateFromJson(data);
      if (next) {
        setOtpState(next);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (otpState.supportRequired) return;
    if (!otpState.lockedUntil) return;

    const untilMs = new Date(otpState.lockedUntil).getTime();
    const tick = () => {
      const r = Math.max(0, untilMs - Date.now());
      setOtpState((s) => ({ ...s, remainingMs: r }));
      if (r <= 0) {
        void refreshOtpState();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [otpState.lockedUntil, otpState.supportRequired, refreshOtpState]);

  useEffect(() => {
    if (isVerified) {
      setStatus("verified");
      setError("");
      setCodeDigits(emptyOtpDigits());
      setOtpState(DEFAULT_OTP_STATE);
      return;
    }

    setStatus((current) => {
      if (current === "sending" || current === "verifying") {
        return current;
      }

      return "idle";
    });
  }, [isVerified]);

  const handlePhoneInputChange = (value: string | undefined) => {
    const nextPhone = value ?? "";
    onPhoneChange(nextPhone);

    if (verifiedPhoneE164 && verifiedPhoneE164 !== nextPhone) {
      onVerifiedPhoneChange(null);
    }

    setError("");
    setCodeDigits(emptyOtpDigits());
    setShowCodeInput(false);
    setStatus("idle");
  };

  const handleSendCode = async () => {
    if (!isPhoneValid) {
      setStatus("error");
      setError("Введите корректный номер телефона");
      return;
    }

    setStatus("sending");
    setError("");

    try {
      const response = await fetch(sameOriginUrl("/api/phone/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164,
          purpose: BUSINESS_CONTACT_VERIFICATION_PURPOSE,
        }),
      });

      const data = await response.json().catch(() => null);
      const nextOtp = parseOtpStateFromJson(data);
      if (nextOtp) {
        setOtpState(nextOtp);
      }

      if (!response.ok) {
        const message = errorToText(data) || `Ошибка: ${response.status}`;
        setStatus("error");
        setError(message);
        return;
      }

      const resendAfterSec =
        typeof data?.resendAfterSec === "number" ? data.resendAfterSec : 60;
      setCooldown(resendAfterSec);
      setShowCodeInput(true);
      setStatus("code_sent");

      window.setTimeout(() => {
        codeInputRefs[0].current?.focus();
      }, 50);
    } catch (e) {
      setStatus("error");
      setError(errorToText(e));
    }
  };

  const handleVerifyCode = useCallback(async () => {
    if (verifyLockRef.current) {
      return;
    }

    if (otpEscalationBlocksInput) {
      return;
    }

    verifyLockRef.current = true;

    try {
      const normalizedCode = codeDigits.join("");

      if (normalizedCode.length !== BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH) {
        return;
      }

      setStatus("verifying");
      setError("");

      try {
        const response = await fetch(sameOriginUrl("/api/phone/verify"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phoneE164,
            code4: normalizedCode,
            purpose: BUSINESS_CONTACT_VERIFICATION_PURPOSE,
          }),
        });

        const data = await response.json().catch(() => null);
        const nextOtp = parseOtpStateFromJson(data);
        if (nextOtp) {
          setOtpState(nextOtp);
        }

        if (!response.ok) {
          const message = errorToText(data) || `Ошибка: ${response.status}`;
          setStatus("error");
          setError(message);
          setCodeDigits(emptyOtpDigits());
          codeInputRefs[0].current?.focus();
          return;
        }

        onVerifiedPhoneChange(phoneE164);
        setShowCodeInput(false);
        setStatus("verified");
        setCodeDigits(emptyOtpDigits());
        setOtpState(DEFAULT_OTP_STATE);
      } catch (e) {
        setStatus("error");
        setError(errorToText(e));
        setCodeDigits(emptyOtpDigits());
        codeInputRefs[0].current?.focus();
      }
    } finally {
      verifyLockRef.current = false;
    }
  }, [
    codeDigits,
    onVerifiedPhoneChange,
    otpEscalationBlocksInput,
    phoneE164,
  ]);

  const handleVerifyCodeRef = useRef(handleVerifyCode);
  handleVerifyCodeRef.current = handleVerifyCode;

  useEffect(() => {
    if (!showCodeInput) {
      return;
    }
    if (otpEscalationBlocksInput) {
      return;
    }
    const code = codeDigits.join("");
    if (code.length !== BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH) {
      return;
    }
    if (status === "verifying" || status === "verified" || status === "sending") {
      return;
    }

    const id = window.setTimeout(() => {
      void handleVerifyCodeRef.current();
    }, 0);

    return () => window.clearTimeout(id);
  }, [codeDigits, showCodeInput, status, otpEscalationBlocksInput]);

  const handleCodeDigitChange = (index: number, raw: string) => {
    if (otpEscalationBlocksInput) return;
    const digit = raw.replace(/\D/g, "").slice(-1);
    setCodeDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (error) {
      setError("");
      setStatus("code_sent");
    }
    if (digit && index < BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH - 1) {
      codeInputRefs[index + 1].current?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      codeInputRefs[index - 1].current?.focus();
    }
  };

  const handleCodePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (otpEscalationBlocksInput) return;
    const text = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH);
    if (text.length === 0) return;
    e.preventDefault();
    const next = emptyOtpDigits();
    for (let i = 0; i < text.length; i++) {
      next[i] = text[i] ?? "";
    }
    setCodeDigits(next);
    if (error) {
      setError("");
      setStatus("code_sent");
    }
    const focusIdx = Math.min(text.length, BUSINESS_CONTACT_VERIFICATION_CODE_LENGTH - 1);
    window.setTimeout(() => codeInputRefs[focusIdx].current?.focus(), 0);
  };

  const sendActionsDisabled =
    !isPhoneValid ||
    status === "sending" ||
    status === "verifying" ||
    cooldown > 0 ||
    otpState.supportRequired ||
    otpEscalationBlocksInput;

  const helperText = isVerified
    ? "Телефон подтвержден"
    : "Подтвердите номер телефона, чтобы отправить профиль на проверку";

  return (
    <div className="space-y-3">
      <div className="onboarding-phone-wrap">
        <PhoneInput
          id="phone"
          international
          defaultCountry="BY"
          countryCallingCodeEditable
          autoComplete="tel"
          placeholder="Номер телефона"
          value={phoneE164 || undefined}
          onChange={handlePhoneInputChange}
          disabled={isVerified || otpState.supportRequired}
        />
      </div>

      <input type="hidden" name="phone" value={phoneE164} />
      <input
        type="hidden"
        name="phoneVerificationPhone"
        value={verifiedPhoneE164 ?? ""}
      />

      {otpState.supportRequired && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Доступ к подтверждению номера временно ограничен. Напишите в службу
          поддержки:{" "}
          <a
            className="font-medium text-primary underline underline-offset-2"
            href={`mailto:${BUSINESS_CONTACT_OTP_SUPPORT_EMAIL}`}
          >
            {BUSINESS_CONTACT_OTP_SUPPORT_EMAIL}
          </a>
        </div>
      )}

      {!otpState.supportRequired &&
        otpState.lockedUntil &&
        otpState.remainingMs > 0 && (
          <p className="text-sm text-gray-600">
            Повторная попытка ввода кода через{" "}
            <span className="tabular-nums font-medium">
              {formatRemainingMs(otpState.remainingMs)}
            </span>
            .
          </p>
        )}

      {!isVerified && (
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton
            type="button"
            onClick={handleSendCode}
            disabled={sendActionsDisabled}
            className="px-4 py-2 text-sm"
          >
            {status === "sending" ? "Отправка..." : "Подтвердить"}
          </PrimaryButton>

          {showCodeInput &&
            (status === "code_sent" || status === "error") && (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={
                cooldown > 0 ||
                otpState.supportRequired ||
                otpEscalationBlocksInput
              }
              className={
                cooldown > 0 ||
                otpState.supportRequired ||
                otpEscalationBlocksInput
                  ? "text-sm font-medium text-gray-400 cursor-not-allowed"
                  : "text-sm font-medium text-primary hover:text-primary/80"
              }
            >
              {cooldown > 0
                ? `Повторная отправка через ${cooldown} сек.`
                : "Отправить код повторно"}
            </button>
          )}
        </div>
      )}

      {!isVerified && showCodeInput && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="space-y-3">
            <span className="block text-sm font-medium text-gray-700">Код из SMS</span>
            <div
              className="flex gap-2 sm:gap-3"
              role="group"
              aria-label="Код из SMS"
              aria-busy={status === "verifying"}
            >
              {codeDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={codeInputRefs[index]}
                  id={index === 0 ? "phoneVerificationCode-0" : undefined}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  disabled={
                    status === "verifying" || otpEscalationBlocksInput
                  }
                  onChange={(e) => handleCodeDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(index, e)}
                  onPaste={handleCodePaste}
                  className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border border-gray-200 bg-white text-center text-lg font-semibold tabular-nums shadow-sm outline-none transition-[color,box-shadow,border-color] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
              ))}
            </div>
            {status === "verifying" && (
              <p className="text-sm text-gray-500">Проверка кода…</p>
            )}
          </div>
        </div>
      )}

      {fieldError && <p className="text-sm text-red-600">{fieldError}</p>}
      {!fieldError && error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {!fieldError && !error && (
        <p className={`text-sm ${isVerified ? "text-green-700" : "text-gray-500"}`}>
          {helperText}
        </p>
      )}
    </div>
  );
}
