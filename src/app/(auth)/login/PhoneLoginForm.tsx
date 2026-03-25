"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { PhoneInput } from "./PhoneInput";
import { isPhoneValid, PHONE_INITIAL } from "./phoneUtils";

interface Props {
  purpose: "LOGIN" | "REGISTER";
  /** Full raw digits to prefill, e.g. "375447777405" */
  initialPhone?: string;
  next?: string;
  onSwitchMode?: () => void;
  onPhoneChange?: (raw: string) => void;
  autoFocus?: boolean;
  /** REGISTER: после успешного verify-otp не редиректить — только колбэк (сессия stub уже в cookie). */
  onRegisterPhoneVerified?: (phoneE164: string) => void;
}

const RESEND_COOLDOWN_SEC = 60;

export function PhoneLoginForm({
  purpose,
  initialPhone,
  next,
  onSwitchMode,
  onPhoneChange,
  autoFocus,
  onRegisterPhoneVerified,
}: Props) {
  const router = useRouter();
  const [rawPhone, setRawPhone] = useState(initialPhone || PHONE_INITIAL);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState<"login" | "register" | null>(null);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  /** REGISTER: после успешного OTP скрываем весь блок телефона — дальше только email в родителе. */
  const [phoneFlowComplete, setPhoneFlowComplete] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resendSecondsLeft =
    resendCooldownUntil != null
      ? Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000))
      : 0;

  useEffect(() => {
    if (step !== "otp" || resendCooldownUntil == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [step, resendCooldownUntil]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  function handlePhoneChange(localDigits: string) {
    const full = "375" + localDigits;
    setRawPhone(full);
    setError("");
    setHint(null);
    onPhoneChange?.(full);
  }

  const sendOtpRequest = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
    hint?: "login" | "register";
  }> => {
    const res = await fetch("/api/auth/phone/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone: "+" + rawPhone, purpose }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Ошибка отправки кода",
        hint: data.hint === "login" || data.hint === "register" ? data.hint : undefined,
      };
    }
    return { ok: true };
  }, [rawPhone, purpose]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(rawPhone)) return;
    setError("");
    setHint(null);
    setLoading(true);
    try {
      const result = await sendOtpRequest();
      if (!result.ok) {
        setError(result.error ?? "Ошибка");
        if (result.hint) setHint(result.hint);
      } else {
        setStep("otp");
        setOtp(["", "", "", ""]);
        setResendCooldownUntil(Date.now() + RESEND_COOLDOWN_SEC * 1000);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendSecondsLeft > 0 || loading) return;
    setError("");
    setHint(null);
    setLoading(true);
    try {
      const result = await sendOtpRequest();
      if (!result.ok) {
        setError(result.error ?? "Не удалось отправить код");
      } else {
        setResendCooldownUntil(Date.now() + RESEND_COOLDOWN_SEC * 1000);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    if (code.length !== 4) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: "+" + rawPhone, code, purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Неверный код");
        return;
      }

      if (purpose === "REGISTER" && onRegisterPhoneVerified) {
        onRegisterPhoneVerified("+" + rawPhone);
        setPhoneFlowComplete(true);
        return;
      }

      const raw = next ?? getPostAuthRedirect();
      const target = appendBirthdayBuilderAuthParam(raw);
      router.replace(target);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    if (digit && index < 3) otpRefs.current[index + 1]?.focus();
    if (nextOtp.every((d) => d !== "")) handleVerifyOtp(nextOtp.join(""));
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function resetToPhone() {
    setStep("phone");
    setOtp(["", "", "", ""]);
    setError("");
    setHint(null);
    setResendCooldownUntil(null);
  }

  const otpConfirmLabel =
    purpose === "REGISTER" ? "Подтвердить номер" : "Подтвердить";

  if (phoneFlowComplete) {
    return null;
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Код отправлен на{" "}
          <span className="font-medium">+{rawPhone}</span>
        </p>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">Код из SMS</label>
          <div className="flex gap-2">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  otpRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-full h-12 text-center text-lg font-semibold bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow"
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="button"
          onClick={() => handleVerifyOtp(otp.join(""))}
          disabled={loading || otp.some((d) => !d)}
          className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
        >
          {loading ? "Проверяем..." : otpConfirmLabel}
        </button>
        <div className="flex flex-col gap-2 items-center text-sm">
          {resendSecondsLeft > 0 ? (
            <p className="text-neutral-500">Повторная отправка через {resendSecondsLeft} сек.</p>
          ) : (
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="text-[#EF8759] hover:text-[#e07040] font-medium disabled:opacity-50"
            >
              Отправить код ещё раз
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={resetToPhone}
          className="w-full text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Изменить номер
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-3">
      <PhoneInput
        value={rawPhone.slice(3)}
        onChange={handlePhoneChange}
        autoFocus={autoFocus}
        disabled={loading}
        error={!!error && !hint}
      />
      {error && (
        <div className="space-y-1">
          <p className="text-sm text-red-500">{error}</p>
          {hint && onSwitchMode && (
            <button
              type="button"
              onClick={onSwitchMode}
              className="text-sm text-[#EF8759] hover:text-[#e07040] underline transition-colors"
            >
              {hint === "login" ? "Перейти ко входу" : "Создать аккаунт"}
            </button>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !isPhoneValid(rawPhone)}
        className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "Отправляем..." : "Получить код"}
      </button>
    </form>
  );
}
