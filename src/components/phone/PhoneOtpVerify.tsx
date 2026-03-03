"use client";

import { useState, useRef, useEffect } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

/**
 * Helper to safely extract error message from various error formats
 */
function errorToText(e: any): string {
  if (!e) return "Неизвестная ошибка";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e?.error === "string") return e.error;
  if (typeof e?.message === "string") return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

interface PhoneOtpVerifyProps {
  phoneE164: string;
  onVerified: () => void;
}

/**
 * OTP verification component for phone numbers.
 * - "Получить код" button to request OTP
 * - 4-digit code input with auto-advance
 * - "Подтвердить" button to verify code
 */
export function PhoneOtpVerify({ phoneE164, onVerified }: PhoneOtpVerifyProps) {
  const [step, setStep] = useState<"idle" | "code-sent" | "verified">("idle");
  const [code, setCode] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Validate phone format
  const isPhoneValid = /^\+\d{7,15}$/.test(phoneE164);

  const handleRequestCode = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164,
          purpose: "BUSINESS_PHONE_VERIFY",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(errorToText(data) || `Ошибка: ${response.status}`);
        return;
      }

      setStep("code-sent");
      setResendCooldown(60); // Start 60-second cooldown
      // Focus first input
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    } catch (err) {
      setError(errorToText(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(0, 1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: move to previous input if current is empty
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const code4 = code.join("");

    if (code4.length !== 4) {
      setError("Введите 4-значный код");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164,
          code4,
          purpose: "BUSINESS_PHONE_VERIFY",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(errorToText(data) || `Ошибка: ${response.status}`);
        // Clear code on error
        setCode(["", "", "", ""]);
        inputRefs[0].current?.focus();
        return;
      }

      setStep("verified");
      onVerified();
    } catch (err) {
      setError(errorToText(err));
      // Clear code on error
      setCode(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "verified") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-medium">Номер подтвержден</span>
      </div>
    );
  }

  if (step === "code-sent") {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <PrimaryButton
          type="button"
          onClick={handleVerifyCode}
          disabled={isLoading || code.join("").length !== 4}
          className="w-full"
        >
          {isLoading ? "Проверка..." : "Подтвердить"}
        </PrimaryButton>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setCode(["", "", "", ""]);
              setError("");
              setResendCooldown(0);
            }}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            Изменить номер
          </button>

          <button
            type="button"
            onClick={handleRequestCode}
            disabled={resendCooldown > 0 || isLoading}
            className="text-primary hover:text-primary/80 underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? `Отправить повторно (${resendCooldown})`
              : "Отправить повторно"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PrimaryButton
        type="button"
        onClick={handleRequestCode}
        disabled={!isPhoneValid || isLoading}
        className="w-full"
      >
        {isLoading ? "Отправка..." : "Получить код"}
      </PrimaryButton>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-gray-500">
        Мы отправим SMS с 4-значным кодом подтверждения
      </p>
    </div>
  );
}
