"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { notifyPostAuthSync } from "@/lib/auth/client";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import { toast } from "@/lib/toast";
import { VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST } from "@/lib/auth/registrationVerificationToast";
import { ModalCloseButton } from "@/components/ui/modal-close-button";

type Mode = "login" | "register";

interface ActivationNotice {
  delivered: boolean;
  maskedEmail: string;
}

const inputClass =
  "w-full h-11 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400";

function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const MIN_PASSWORD_LEN = 8;
/** Purely a UX throttle against spam-clicking — the real limit is server-side (activationRateLimit). */
const RESEND_COOLDOWN_SECONDS = 30;

export interface CompactSaveAuthPanelProps {
  title: string;
  subtitle: string;
  onAuthSuccess?: () => void | Promise<void>;
  nextHref?: string;
  skipRedirect?: boolean;
  onBack?: () => void;
  /** Закрыть весь flow (показывается крестик внутри карточки) */
  onClose?: () => void;
  resetKey?: string | number;
  className?: string;
  embedded?: boolean;
}

/**
 * Форма входа/регистрации без оболочки Dialog — для встраивания в SaveActivityFlow.
 */
export function CompactSaveAuthPanel({
  title,
  subtitle,
  onAuthSuccess,
  nextHref = "",
  skipRedirect = false,
  onBack,
  onClose,
  resetKey,
  className,
  embedded = false,
}: CompactSaveAuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activationNotice, setActivationNotice] = useState<ActivationNotice | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setError("");
    setActivationNotice(null);
    setResendAvailableAt(null);
  }, []);

  useEffect(() => {
    setMode("login");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
    setActivationNotice(null);
    setResendAvailableAt(null);
  }, [resetKey]);

  useEffect(() => {
    if (resendAvailableAt === null) {
      setResendSecondsLeft(0);
      return;
    }
    const tick = () => {
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  /** Shared by the initial submit and "Отправить ссылку повторно" — a PENDING_ACTIVATION account's password is never actually checked server-side, so resubmitting is just "try requesting the link again." */
  const attemptLogin = useCallback(
    async (emailVal: string, passwordVal: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: emailVal, password: passwordVal }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.pendingActivation === true) {
          setError("");
          setActivationNotice({
            delivered: data.delivered === true,
            maskedEmail: typeof data.maskedEmail === "string" ? data.maskedEmail : emailVal,
          });
          setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
          return;
        }
        setActivationNotice(null);
        setResendAvailableAt(null);
        if (!res.ok) {
          const raw = typeof data.error === "string" ? data.error : "";
          setError(
            raw === "Invalid email or password"
              ? "Неверный email или пароль"
              : raw || "Что-то пошло не так",
          );
          return;
        }
        notifyPostAuthSync();
        await onAuthSuccess?.();
        if (!skipRedirect) {
          const raw = nextHref || getPostAuthRedirect();
          const target = appendBirthdayBuilderAuthParam(raw);
          navigateToCompatibleHref(router, target, { replace: true });
        }
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    },
    [nextHref, onAuthSuccess, router, skipRedirect],
  );

  const resendActivationLink = useCallback(async () => {
    if (resendSecondsLeft > 0) return;
    const emailVal = email.trim().toLowerCase();
    if (!emailVal) return;
    await attemptLogin(emailVal, password);
  }, [email, password, resendSecondsLeft, attemptLogin]);

  /** "Указать другой email" — back to a blank slate, not just hiding the notice. */
  const useDifferentEmail = useCallback(() => {
    setActivationNotice(null);
    setResendAvailableAt(null);
    setError("");
    setEmail("");
    setPassword("");
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const emailVal = String(fd.get("email") ?? "").trim().toLowerCase();
    const passwordVal = String(fd.get("password") ?? "");

    if (mode === "login") {
      if (!emailVal || !passwordVal) {
        setError("Введите email и пароль");
        return;
      }
    } else {
      if (!isValidEmail(emailVal)) {
        setError("Некорректный email");
        return;
      }
      if (passwordVal.length < MIN_PASSWORD_LEN) {
        setError(`Пароль не короче ${MIN_PASSWORD_LEN} символов`);
        return;
      }
    }

    if (mode === "login") {
      await attemptLogin(emailVal, passwordVal);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Не удалось создать аккаунт",
        );
        return;
      }
      if (data.verificationEmailSendFailed === true) {
        toast.message(VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST);
      }
      notifyPostAuthSync();
      await onAuthSuccess?.();
      if (!skipRedirect) {
        const raw = nextHref || getPostAuthRedirect();
        const target = appendBirthdayBuilderAuthParam(raw);
        navigateToCompatibleHref(router, target, { replace: true });
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  const shellClass = embedded
    ? "w-full space-y-4"
    : "relative w-full space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6";

  return (
    <div className={cn("w-full px-1", className)}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </button>
      ) : null}

      <div className={shellClass}>
        {!embedded && onClose ? (
          <ModalCloseButton
            onClick={onClose}
            className="absolute right-4 top-4"
          />
        ) : null}
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <p className="text-sm text-neutral-500">{subtitle}</p>
        </div>

        <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-all duration-200",
              mode === "login"
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-all duration-200",
              mode === "register"
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            className={inputClass}
          />

          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 hover:text-neutral-700 focus:outline-none"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {activationNotice ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
              {activationNotice.delivered ? (
                <>
                  <p className="text-sm font-medium text-blue-900">
                    Мы перенесли вашу учётную запись в новую версию mamaGo
                  </p>
                  <p className="text-sm text-blue-700">
                    Чтобы завершить перенос и войти, перейдите по ссылке, которую мы отправили на{" "}
                    <span className="font-medium">{activationNotice.maskedEmail}</span>.
                  </p>
                </>
              ) : (
                <p className="text-sm text-blue-700">
                  Не удалось отправить ссылку. Попробуйте ещё раз немного позже.
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                <button
                  type="button"
                  onClick={resendActivationLink}
                  disabled={loading || resendSecondsLeft > 0}
                  className="text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                >
                  {resendSecondsLeft > 0
                    ? `Отправить ссылку повторно (${resendSecondsLeft}с)`
                    : "Отправить ссылку повторно"}
                </button>
                <button
                  type="button"
                  onClick={useDifferentEmail}
                  className="text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  Указать другой email
                </button>
              </div>
            </div>
          ) : (
            error && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-sm text-red-600">{error}</p>
                {mode === "register" && error.includes("уже существует") && (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
                  >
                    Войти в существующий аккаунт
                  </button>
                )}
              </div>
            )
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {loading
              ? "Загрузка..."
              : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-center text-xs leading-relaxed text-neutral-400">
          {mode === "login"
            ? "Нет аккаунта? Переключитесь на регистрацию"
            : "Продолжая, вы соглашаетесь с условиями использования"}
        </p>
      </div>
    </div>
  );
}
