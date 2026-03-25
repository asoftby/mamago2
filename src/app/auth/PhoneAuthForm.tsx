"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { AuthMode } from "./AuthPage";

interface Props {
  mode: AuthMode;
  next: string;
  onSwitchMode?: () => void;
  initialPhone?: string;
  onPhoneChange?: (raw: string) => void;
  autoFocus?: boolean;
  onRegisterPhoneVerified?: (phoneE164: string) => void;
}

const PHONE_INITIAL = "375";
const RESEND_COOLDOWN_SEC = 60;

function isPhoneValid(raw: string) {
  return raw.length === 12 && raw.startsWith("375");
}

function formatLocal(d: string): string {
  const op = d.slice(0, 2);
  const p1 = d.slice(2, 5);
  const p2 = d.slice(5, 7);
  const p3 = d.slice(7, 9);
  let result = op;
  if (p1) result += " " + p1;
  if (p2) result += "-" + p2;
  if (p3) result += "-" + p3;
  return result;
}

export function PhoneAuthForm({
  mode,
  next,
  onSwitchMode,
  initialPhone,
  onPhoneChange,
  autoFocus,
  onRegisterPhoneVerified,
}: Props) {
  const router = useRouter();
  const purpose = mode === "login" ? "LOGIN" : "REGISTER";

  const [rawPhone, setRawPhone] = useState(initialPhone || PHONE_INITIAL);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState<"login" | "register" | null>(null);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [phoneFlowComplete, setPhoneFlowComplete] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!autoFocus) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [autoFocus]);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    const full = "375" + digits;
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

      router.replace(next);
      router.refresh();
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

  const otpConfirmLabel = purpose === "REGISTER" ? "Подтвердить номер" : "Подтвердить";

  if (phoneFlowComplete) {
    return null;
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Код отправлен на <span className="font-medium">+{rawPhone}</span>
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
          onClick={() => {
            setStep("phone");
            setOtp(["", "", "", ""]);
            setError("");
            setHint(null);
            setResendCooldownUntil(null);
          }}
          className="w-full text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Изменить номер
        </button>
      </div>
    );
  }

  const localDigits = rawPhone.slice(3);

  return (
    <form onSubmit={handleSendCode} className="space-y-3">
      <div
        className={[
          "flex h-12 bg-white border rounded-xl overflow-hidden transition-shadow",
          "focus-within:ring-2 focus-within:ring-[#EF8759]",
          error && !hint ? "border-red-400" : "border-neutral-200",
          loading ? "opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="flex items-center pl-4 pr-2 text-sm text-neutral-500 select-none whitespace-nowrap">
          +375
        </span>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={formatLocal(localDigits)}
          onChange={handlePhoneChange}
          disabled={loading}
          placeholder="XX XXX-XX-XX"
          className="flex-1 pr-4 text-sm bg-transparent focus:outline-none placeholder:text-neutral-400"
        />
      </div>

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
