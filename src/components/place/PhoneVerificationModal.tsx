"use client";

import { useState, useEffect, useCallback, useMemo, createRef, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { isValidE164Phone } from "@/lib/phone/e164";

interface PhoneVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

type Step = "entry" | "confirm";

function emptyDigits() {
  return ["", "", "", ""];
}

export function PhoneVerificationModal({
  open,
  onClose,
  onVerified,
}: PhoneVerificationModalProps) {
  const [step, setStep] = useState<Step>("entry");
  const [phoneE164, setPhoneE164] = useState("");
  const [sentPhoneE164, setSentPhoneE164] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpDigits, setOtpDigits] = useState<string[]>(emptyDigits);
  const [otpError, setOtpError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const autoSubmitLockRef = useRef(false);

  const otpInputRefs = useMemo(
    () => [
      createRef<HTMLInputElement>(),
      createRef<HTMLInputElement>(),
      createRef<HTMLInputElement>(),
      createRef<HTMLInputElement>(),
    ],
    []
  );

  const isBusy = isSending || isVerifying;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  const handleSendOtp = useCallback(async () => {
    if (!isValidE164Phone(phoneE164)) {
      setPhoneError("Введите номер в формате +375 XX XXX-XX-XX");
      return;
    }

    setIsSending(true);
    setOtpError("");
    setPhoneError("");

    try {
      const response = await fetch(sameOriginUrl("/api/settings/phone/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: phoneE164 }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; resendAfterSec?: number; phoneE164?: string }
        | null;

      if (!response.ok) {
        setPhoneError(data?.error || "Не удалось отправить код");
        return;
      }

      setSentPhoneE164(data?.phoneE164 ?? phoneE164);
      setCooldown(typeof data?.resendAfterSec === "number" ? data.resendAfterSec : 60);
      setOtpDigits(emptyDigits());
      setStep("confirm");
      requestAnimationFrame(() => otpInputRefs[0].current?.focus());
    } finally {
      setIsSending(false);
    }
  }, [otpInputRefs, phoneE164]);

  const handleVerifyCode = useCallback(
    async (code: string) => {
      if (!sentPhoneE164 || code.length !== 4) return;

      setIsVerifying(true);
      setOtpError("");

      try {
        const response = await fetch(sameOriginUrl("/api/settings/phone/verify"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phone: sentPhoneE164,
            code,
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | { error?: string; phoneE164?: string }
          | null;

        if (!response.ok) {
          setOtpError(data?.error || "Не удалось подтвердить код");
          setOtpDigits(emptyDigits());
          requestAnimationFrame(() => otpInputRefs[0].current?.focus());
          return;
        }

        // Успешно подтверждено
        onVerified();
        onClose();
      } finally {
        setIsVerifying(false);
      }
    },
    [onClose, onVerified, otpInputRefs, sentPhoneE164]
  );

  useEffect(() => {
    if (step !== "confirm") return;
    if (otpDigits.some((digit) => digit === "")) {
      autoSubmitLockRef.current = false;
      return;
    }
    if (autoSubmitLockRef.current || isVerifying || isSending) {
      return;
    }

    autoSubmitLockRef.current = true;
    void handleVerifyCode(otpDigits.join(""));
  }, [handleVerifyCode, isSending, isVerifying, otpDigits, step]);

  async function handleResend() {
    if (cooldown > 0) return;
    await handleSendOtp();
  }

  function handleOtpChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(0, 1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setOtpError("");

    if (digit && index < otpInputRefs.length - 1) {
      otpInputRefs[index + 1].current?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  }

  function restartFlow() {
    setStep("entry");
    setOtpDigits(emptyDigits());
    setOtpError("");
    setCooldown(0);
    setSentPhoneE164(null);
  }

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Backdrop - full screen blur */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        {/* Dialog */}
        <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Content */}
          <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Подтвердите номер телефона
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Это необходимо чтобы оставлять отзывы о местах
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-sm text-gray-700">
              Номер телефона используется для подтверждения что вы реальный посетитель
            </p>
          </div>

          <div className="relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            {isBusy ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[1px]">
                <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isSending ? "Отправляем код…" : "Проверяем код…"}
                </div>
              </div>
            ) : null}

            {step === "confirm" && sentPhoneE164 ? (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Введите код
                  </h3>
                  <p className="text-sm text-gray-500">
                    Код отправлен на {formatPhoneForDisplay(sentPhoneE164)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={otpInputRefs[index]}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(event) => handleOtpChange(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        className="h-14 w-12 rounded-2xl border border-gray-200 bg-white text-center text-lg font-semibold text-gray-900 outline-none transition-colors focus:border-gray-400"
                        aria-label={`Цифра ${index + 1}`}
                        disabled={isVerifying}
                      />
                    ))}
                  </div>

                  {otpError ? (
                    <p className="text-sm text-rose-600">{otpError}</p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      {isVerifying
                        ? "Проверяем код, это может занять несколько секунд."
                        : "Введите 4-значный код из SMS."}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={restartFlow}
                    disabled={isBusy}
                    className="text-left text-gray-500 transition-colors hover:text-gray-900"
                  >
                    Изменить номер
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isBusy}
                    className="text-left text-blue-600 transition-colors hover:text-blue-700 disabled:text-gray-400"
                  >
                    {cooldown > 0
                      ? `Отправить код повторно через ${cooldown} сек.`
                      : isSending
                        ? "Отправляем..."
                        : "Отправить код повторно"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-800">
                    Номер телефона
                  </Label>
                  <InternationalPhoneInput
                    id="phone"
                    value={phoneE164}
                    onChange={(value) => {
                      setPhoneE164(value);
                      if (phoneError) {
                        setPhoneError("");
                      }
                    }}
                    aria-invalid={Boolean(phoneError)}
                  />
                  {phoneError ? (
                    <p className="text-sm text-rose-600">{phoneError}</p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Используйте номер в формате +375 XX XXX-XX-XX.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isSending}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSending || !phoneE164}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Отправляем код…
                      </>
                    ) : (
                      "Отправить код"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
