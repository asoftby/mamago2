"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuthMode } from "./AuthPage";

interface Props {
  mode: AuthMode;
  next: string;
  onSwitchMode?: () => void;
  initialPhone?: string;
  onPhoneChange?: (raw: string) => void;
  autoFocus?: boolean;
}

const PHONE_INITIAL = "375";

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

export function PhoneAuthForm({ mode, next, onSwitchMode, initialPhone, onPhoneChange, autoFocus }: Props) {
  const router = useRouter();
  const purpose = mode === "login" ? "LOGIN" : "REGISTER";

  const [rawPhone, setRawPhone] = useState(initialPhone || PHONE_INITIAL);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState<"login" | "register" | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  async function handleSendCode(e: React.FormEvent) {
    console.log(`[${purpose}] form submit fired`);
    e.preventDefault();
    console.log(`[${purpose}] sendCode handler called`, { rawPhone, isValid: isPhoneValid(rawPhone) });
    if (!isPhoneValid(rawPhone)) {
      console.log(`[${purpose}] early return: phone invalid`, rawPhone);
      return;
    }
    setError("");
    setHint(null);
    setLoading(true);
    try {
      console.log(`[${purpose}] about to call API`, { phone: "+" + rawPhone, purpose });
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
        router.replace(next);
        router.refresh();
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

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Код отправлен на <span className="font-medium">+{rawPhone}</span>
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
          onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); setError(""); setHint(null); }}
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
      {/* Split-prefix phone input */}
      <div
        className={[
          "flex h-12 bg-white border rounded-xl overflow-hidden transition-shadow",
          "focus-within:ring-2 focus-within:ring-[#EF8759]",
          error && !hint ? "border-red-400" : "border-neutral-200",
          loading ? "opacity-50" : "",
        ].filter(Boolean).join(" ")}
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
        onClick={() => console.log(`[${purpose}] button clicked`, { rawPhone, isValid: isPhoneValid(rawPhone), loading })}
        className="w-full h-12 rounded-xl bg-[#EF8759] hover:bg-[#e07040] disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "Отправляем..." : "Получить код"}
      </button>
    </form>
  );
}
