"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { notifyPostAuthSync } from "@/lib/auth/client";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import { toast } from "sonner";
import { VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST } from "@/lib/auth/registrationVerificationToast";
import { ModalCloseButton } from "@/components/ui/modal-close-button";

type Mode = "login" | "register";

const inputClass =
  "w-full h-11 px-4 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#EF8759] transition-shadow placeholder:text-neutral-400";

function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const MIN_PASSWORD_LEN = 8;

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

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setError("");
  }, []);

  useEffect(() => {
    setMode("login");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
  }, [resetKey]);

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

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: emailVal, password: passwordVal }),
        });
        const data = await res.json().catch(() => ({}));
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
        router.refresh();
        return;
      }

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
      router.refresh();
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

          {error && (
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
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-[#EF8759] font-medium text-white transition-colors hover:bg-[#e07040] disabled:opacity-50"
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
