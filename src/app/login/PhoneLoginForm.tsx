"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
}

export function PhoneLoginForm({ purpose, initialPhone, next, onSwitchMode, onPhoneChange, autoFocus }: Props) {
  const router = useRouter();
  // Full raw digits = "375" + localDigits (9 digits)
  const [rawPhone, setRawPhone] = useState(initialPhone || PHONE_INITIAL);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState<"login" | "register" | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === "otp") otpRefs.current[0]?.focus();
  }, [step]);

  // PhoneInput gives us the 9 local digits; we store full "375" + localDigits
  function handlePhoneChange(localDigits: string) {
    const full = "375" + localDigits;
    setRawPhone(full);
    setError("");
    setHint(null);
    onPhoneChange?.(full);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isPhoneValid(rawPhone)) return;
    setError("");
    setHint(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+" + rawPhone, purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Ошибка отправки кода");
        if (data.hint) setHint(data.hint);
      } else {
        setStep("otp");
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
        body: JSON.stringify({ phone: "+" + rawPhone, code, purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Неверный код");
      } else {
        const target = next ?? getPostAuthRedirect();
        router.replace(target);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 3) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== "")) handleVerifyOtp(next.join(""));
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
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Код отправлен на{" "}
          <span className="font-medium">+{rawPhone}</span>
        </p>
        <div className="flex gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { otpRefs.current[i] = el; }}
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
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={() => handleVerifyOtp(otp.join(""))}
          disabled={loading || otp.some((d) => !d)}
          className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
        >
          {loading ? "Проверяем..." : "Подтвердить"}
        </button>
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
