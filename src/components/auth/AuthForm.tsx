"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuthCredentialsFlow, type AuthFlowMode } from "@/lib/auth/useAuthCredentialsFlow";
import { AUTH_INPUT_CLASS, AUTH_PRIMARY_BUTTON_CLASS } from "@/lib/auth/authFieldClasses";
import { getPostAuthContext } from "@/lib/post-auth";
import type { AuthEntryPoint } from "@/lib/post-auth";

export interface AuthFormProps {
  open: boolean;
  onRequestClose: () => void;
  nextHref: string;
  title: string;
  subtitle: string;
  /** Явный post-auth source; если не задан — читается из getPostAuthContext() (актуально до первого commit эффекта у родителя). */
  postAuthSource?: AuthEntryPoint;
  /** После успешного login/register (родитель запускает post-auth pipeline). */
  onAuthSuccess?: () => void | Promise<void>;
  /** Не редиректить сразу — см. post-auth completion. */
  deferNavigation?: boolean;
  /** Родитель даёт свой close (например шапка My Plan shell). */
  hideCloseButton?: boolean;
  /** Стартовый сценарий full-page/modal auth. */
  initialMode?: AuthFlowMode;
  /** Внешнее уведомление над формой: reset success и т.п. */
  notice?: ReactNode;
}

/** Единый auth source of truth для modal/bottom-sheet/full-page. */
export function AuthForm({
  open,
  onRequestClose,
  nextHref,
  title,
  subtitle,
  postAuthSource,
  onAuthSuccess,
  deferNavigation = false,
  hideCloseButton = false,
  initialMode = "login",
  notice,
}: AuthFormProps) {
  const resolvedSource = postAuthSource ?? getPostAuthContext()?.source;
  const isMyPlanEntry = resolvedSource === "my_plan";

  const displayTitle = title;
  const displaySubtitle = subtitle;

  const flow = useAuthCredentialsFlow({
    open,
    nextHref,
    onAuthSuccess,
    skipRedirectAfterAuth: deferNavigation,
    finishContext: "modal",
    initialMode,
  });

  const {
    mode,
    switchMode,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    loading,
    error,
    submitLogin,
    submitRegister,
  } = flow;

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "login") await submitLogin();
    else await submitRegister();
  }

  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div className="relative w-full">
        <div
          className={cn(
            "relative w-full rounded-2xl bg-white p-6 sm:p-7 space-y-5",
            !isMyPlanEntry && "border border-neutral-200/80 shadow-md",
          )}
        >
          {!hideCloseButton ? (
            <ModalCloseButton
              onClick={onRequestClose}
              className="absolute right-4 top-4 shadow-md"
            />
          ) : null}

          {!isMyPlanEntry ? (
            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-semibold text-neutral-900">{displayTitle}</h2>
              <p className="text-sm text-neutral-500 leading-relaxed">{displaySubtitle}</p>
            </div>
          ) : null}

          {notice ? <div>{notice}</div> : null}

          <div className="flex bg-neutral-100 rounded-full p-1 gap-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium rounded-full transition-all duration-200",
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
                "flex-1 py-2.5 text-sm font-medium rounded-full transition-all duration-200",
                mode === "register"
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className={AUTH_INPUT_CLASS}
            />

            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={AUTH_INPUT_CLASS + " pr-11"}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-neutral-400 hover:text-neutral-700 focus:outline-none"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {mode === "login" && (
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors underline-offset-2 hover:underline"
                >
                  Забыли пароль?
                </Link>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 space-y-2">
                <p className="text-sm text-red-600">{error}</p>
                {mode === "register" && error.includes("уже существует") && (
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-xs text-red-700 hover:text-red-900 underline underline-offset-2 font-medium"
                  >
                    Войти в существующий аккаунт
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className={AUTH_PRIMARY_BUTTON_CLASS}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка...
                </span>
              ) : isMyPlanEntry ? (
                "Продолжить"
              ) : mode === "login" ? (
                "Войти"
              ) : (
                "Создать аккаунт"
              )}
            </button>
          </form>

          {mode === "register" && (
            <p className="text-xs text-neutral-400 text-center leading-relaxed px-2">
              Продолжая, вы соглашаетесь с{" "}
              <Link
                href="/terms"
                className="text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
              >
                условиями использования
              </Link>{" "}
              и{" "}
              <Link
                href="/privacy"
                className="text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
              >
                политикой конфиденциальности
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
