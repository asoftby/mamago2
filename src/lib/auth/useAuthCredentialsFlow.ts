"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { notifyAuthStateChanged, notifyNotificationsChanged } from "@/lib/auth/client";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import { toast } from "sonner";
import { VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST } from "@/lib/auth/registrationVerificationToast";

export type AuthFlowMode = "login" | "register";

export type AuthFinishContext = "modal" | "embedded";

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const MIN_PASSWORD_LEN = 8;

export interface UseAuthCredentialsFlowOptions {
  open: boolean;
  nextHref: string;
  initialMode?: AuthFlowMode;
  /** Вызывается после успешного login/register (может быть async). */
  onAuthSuccess?: () => void | Promise<void>;
  finishContext: AuthFinishContext;
  /**
   * Не делать router.replace после сессии — родитель запускает post-auth pipeline
   * (completion flow в той же модалке).
   */
  skipRedirectAfterAuth?: boolean;
  /**
   * Только для embedded: перед завершением сессии (например анимация в My Plan).
   */
  beforeFinishAuthSession?: () => Promise<void>;
}

export function useAuthCredentialsFlow({
  open,
  nextHref,
  initialMode = "login",
  onAuthSuccess,
  finishContext,
  skipRedirectAfterAuth = false,
  beforeFinishAuthSession,
}: UseAuthCredentialsFlowOptions) {
  const router = useRouter();
  const embedded = finishContext === "embedded";

  const [mode, setMode] = useState<AuthFlowMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = useCallback((m: AuthFlowMode) => {
    setMode(m);
    setError("");
  }, []);

  useEffect(() => {
    if (!open) {
      setMode(initialMode);
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setError("");
    }
  }, [open, initialMode]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const finishAuthSession = useCallback(
    async (rawRedirect: string) => {
      const target = appendBirthdayBuilderAuthParam(rawRedirect);
      if (embedded && beforeFinishAuthSession) {
        await beforeFinishAuthSession();
      }
      /** Post-auth pipeline (completion) должен отработать до notify — иначе UI переключится на «залогинен» раньше времени. */
      if (skipRedirectAfterAuth) {
        await Promise.resolve(onAuthSuccess?.());
        notifyAuthStateChanged();
        notifyNotificationsChanged();
        // Не вызываем router.refresh(): он обновляет текущий URL и гонится с router.push("/me") из runPostAuthPipeline.
        return;
      }
      notifyAuthStateChanged();
      await Promise.resolve(onAuthSuccess?.());
      router.refresh();
      notifyNotificationsChanged();
      if (embedded) {
        return;
      }
      navigateToCompatibleHref(router, target, { replace: true });
    },
    [embedded, beforeFinishAuthSession, onAuthSuccess, router, skipRedirectAfterAuth],
  );

  const submitLogin = useCallback(async () => {
    setError("");
    const emailVal = email.trim().toLowerCase();
    if (!emailVal || !password) {
      setError("Введите email и пароль");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailVal, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = typeof data.error === "string" ? data.error : "";
        setError(
          raw === "Invalid email or password" ? "Неверный email или пароль" : raw || "Что-то пошло не так",
        );
        return;
      }
      const raw = nextHref ?? getPostAuthRedirect();
      await finishAuthSession(raw);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [email, password, nextHref, finishAuthSession]);

  const submitRegister = useCallback(async () => {
    setError("");
    const emailVal = email.trim().toLowerCase();
    if (!isValidEmail(emailVal)) {
      setError("Некорректный email");
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError("Пароль не короче " + MIN_PASSWORD_LEN + " символов");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailVal, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось создать аккаунт");
        return;
      }
      if (data.verificationEmailSendFailed === true) {
        toast.message(VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST);
      }
      const raw = nextHref ?? getPostAuthRedirect();
      await finishAuthSession(raw);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [email, password, nextHref, finishAuthSession]);

  const resetCredentials = useCallback(() => {
    setMode("login");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
  }, []);

  return {
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
    setError,
    submitLogin,
    submitRegister,
    minPasswordLen: MIN_PASSWORD_LEN,
    resetCredentials,
  };
}
