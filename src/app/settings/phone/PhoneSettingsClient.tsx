"use client";

import { createRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InternationalPhoneInput } from "@/components/phone/InternationalPhoneInput";
import { sameOriginUrl } from "@/lib/client/sameOriginUrl";
import { formatPhoneForDisplay, maskPhoneForDisplay } from "@/lib/phone/display";
import { isValidE164Phone } from "@/lib/phone/e164";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const phoneFormSchema = z.object({
  phone: z
    .string()
    .min(1, "Введите номер телефона")
    .refine((value) => isValidE164Phone(value), "Введите номер в формате +375 XX XXX-XX-XX"),
});

type PhoneFormValues = z.infer<typeof phoneFormSchema>;
type Step = "entry" | "confirm" | "linked";

function emptyDigits() {
  return ["", "", "", ""];
}

export function PhoneSettingsClient(props: {
  initialPhoneE164: string | null;
  initialPhoneVerifiedAt: string | null;
  homeHref?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    props.initialPhoneE164 && props.initialPhoneVerifiedAt ? "linked" : "entry"
  );
  const [sentPhoneE164, setSentPhoneE164] = useState<string | null>(
    props.initialPhoneE164 && props.initialPhoneVerifiedAt
      ? props.initialPhoneE164
      : null
  );
  const [cooldown, setCooldown] = useState(0);
  const [otpDigits, setOtpDigits] = useState<string[]>(emptyDigits);
  const [otpError, setOtpError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneFormSchema),
    defaultValues: {
      phone: props.initialPhoneE164 ?? "",
    },
  });

  const currentPhone = watch("phone");
  const linkedMaskedPhone = useMemo(
    () => (props.initialPhoneE164 ? maskPhoneForDisplay(props.initialPhoneE164) : null),
    [props.initialPhoneE164]
  );
  const isBusy = isSending || isVerifying;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleSendOtp = useCallback(async (values: PhoneFormValues) => {
    setIsSending(true);
    setOtpError("");
    clearErrors("phone");

    try {
      const response = await fetch(sameOriginUrl("/api/settings/phone/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: values.phone }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; resendAfterSec?: number; phoneE164?: string }
        | null;

      if (!response.ok) {
        setError("phone", {
          type: "server",
          message: data?.error || "Не удалось отправить код",
        });
        return;
      }

      setSentPhoneE164(data?.phoneE164 ?? values.phone);
      setCooldown(typeof data?.resendAfterSec === "number" ? data.resendAfterSec : 60);
      setOtpDigits(emptyDigits());
      setStep("confirm");
      requestAnimationFrame(() => otpInputRefs[0].current?.focus());
    } finally {
      setIsSending(false);
    }
  }, [clearErrors, otpInputRefs, setError]);

  const handleVerifyCode = useCallback(async (code: string) => {
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

      toast.success("Номер привязан");
      router.push(props.homeHref ?? "/me/settings");
      router.refresh();
    } finally {
      setIsVerifying(false);
    }
  }, [otpInputRefs, props.homeHref, router, sentPhoneE164]);

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
    await handleSendOtp({ phone: currentPhone });
  }

  async function handleUnlink() {
    setIsUnlinking(true);

    try {
      const response = await fetch(sameOriginUrl("/api/settings/phone"), {
        method: "DELETE",
        credentials: "include",
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        toast.error(data?.error || "Не удалось отвязать номер");
        return;
      }

      toast.success("Номер отвязан");
      setConfirmOpen(false);
      setStep("entry");
      setSentPhoneE164(null);
      setValue("phone", "");
      setOtpDigits(emptyDigits());
      setOtpError("");
      router.refresh();
    } finally {
      setIsUnlinking(false);
    }
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
    setValue("phone", props.initialPhoneE164 ?? "");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-5">
        <p className="text-sm font-medium text-neutral-900">
          Номер телефона используется для:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>Отзывов — чтобы подтвердить, что вы были на мероприятии</li>
          <li>Заявок — автозаполнение контактной информации при бронировании</li>
        </ul>
      </div>

      <div className="relative rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6">
        {isBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isSending ? "Отправляем код…" : "Проверяем код…"}
            </div>
          </div>
        ) : null}

        {step === "linked" && linkedMaskedPhone ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-800">Текущий номер</p>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base font-medium text-neutral-900">
                {linkedMaskedPhone}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="h-11 rounded-xl px-5"
                onClick={restartFlow}
              >
                Изменить номер
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-5 text-rose-600 hover:text-rose-700"
                onClick={() => setConfirmOpen(true)}
              >
                Отвязать
              </Button>
            </div>
          </div>
        ) : step === "confirm" && sentPhoneE164 ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">
                Подтвердите номер
              </h2>
              <p className="text-sm text-neutral-500">
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
                    className="h-14 w-12 rounded-2xl border border-neutral-200 bg-white text-center text-lg font-semibold text-neutral-900 outline-none transition-colors focus:border-neutral-400"
                    aria-label={`Цифра ${index + 1}`}
                    disabled={isVerifying}
                  />
                ))}
              </div>

              {otpError ? (
                <p className="text-sm text-rose-600">{otpError}</p>
              ) : (
                <p className="text-sm text-neutral-500">
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
                className="text-left text-neutral-500 transition-colors hover:text-neutral-900"
              >
                Изменить номер
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || isBusy}
                className="text-left text-primary transition-colors hover:text-primary/80 disabled:text-neutral-400"
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
          <form onSubmit={handleSubmit(handleSendOtp)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-neutral-800">
                Номер телефона
              </Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <InternationalPhoneInput
                    id="phone"
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      if (errors.phone) {
                        clearErrors("phone");
                      }
                    }}
                    aria-invalid={Boolean(errors.phone)}
                  />
                )}
              />
              {errors.phone?.message ? (
                <p className="text-sm text-rose-600">{errors.phone.message}</p>
              ) : (
                <p className="text-sm text-neutral-500">
                  Используйте номер в формате +375 XX XXX-XX-XX.
                </p>
              )}
            </div>

            <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSending}
                  className="h-11 rounded-xl px-5"
                >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Отправляем код…
                  </>
                ) : (
                  "Привязать номер"
                )}
                </Button>
              </div>
          </form>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-neutral-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Отвязать номер?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-neutral-500">
              Номер перестанет использоваться для подтверждения отзывов и
              автозаполнения заявок.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-neutral-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>Позже вы сможете привязать новый номер в этом же разделе.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={handleUnlink}
              disabled={isUnlinking}
            >
              {isUnlinking ? "Отвязываем…" : "Отвязать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
