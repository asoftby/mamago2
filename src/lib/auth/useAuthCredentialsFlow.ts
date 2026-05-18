"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { notifyAuthStateChanged, notifyNotificationsChanged } from "@/lib/auth/client";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import { toast } from "@/lib/toast";
import { VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST } from "@/lib/auth/registrationVerificationToast";
import { PASSWORD_MIN_LENGTH, validatePasswordPolicy } from "@/lib/auth/passwordPolicy";

export type AuthFlowMode = "login" | "register";

export type AuthFinishContext = "modal" | "embedded";

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}


export interface UseAuthCredentialsFlowOptions {
  open: boolean;
  nextHref: string;
  initialMode?: AuthFlowMode;
  initialEmail?: string;
  invitationToken?: string;
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
  initialEmail = "",
  invitationToken,
  onAuthSuccess,
  finishContext,
  skipRedirectAfterAuth = false,
  beforeFinishAuthSession,
}: UseAuthCredentialsFlowOptions) {
  const router = useRouter();
  const embedded = finishContext === "embedded";

  const [mode, setMode] = useState<AuthFlowMode>(initialMode);
  const [email, setEmail] = useState(initialEmail);
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
      setEmail(initialEmail);
      setPassword("");
      setShowPassword(false);
      setError("");
    }
  }, [open, initialEmail, initialMode]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const finishAuthSession = useCallback(
    async (rawRedirect: string) => {
      const target = appendBirthdayBuilderAuthParam(rawRedirect);
      if (embedded && beforeFinishAuthSession) {
        await beforeFinishAuthSession();
      }
      /** Post-auth pipeline (completion) должен отработать до notify — иначе UI переключится на «залогинен» раньше времени. */
      if (skipRedirectAfterAuth) {
        await Promise.resolve(onAuthSuccess?.());
        if (process.env.NODE_ENV !== "production") {
          console.debug("[auth] success refresh", {
            authFlow: "credentials",
            skipRedirectAfterAuth: true,
            source: "useAuthCredentialsFlow.finishAuthSession",
          });
        }
        notifyAuthStateChanged();
        notifyNotificationsChanged();
        // Не вызываем router.refresh(): он обновляет текущий URL и гонится с router.push("/me") из runPostAuthPipeline.
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        console.debug("[auth] success refresh", {
          authFlow: "credentials",
          skipRedirectAfterAuth: false,
          source: "useAuthCredentialsFlow.finishAuthSession",
        });
      }
      notifyAuthStateChanged();
      await Promise.resolve(onAuthSuccess?.());
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
        body: JSON.stringify({ email: emailVal, password, invitationToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = typeof data.error === "string" ? data.error : "";
        setError(
          raw === "Invalid email or password" ? "Неверный email или пароль" : raw || "Что-то пошло не так",
        );
        return;
      }
      const raw =
        typeof data.redirectTo === "string" && data.redirectTo.length > 0
          ? data.redirectTo
          : nextHref ?? getPostAuthRedirect();
      await finishAuthSession(raw);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [email, password, invitationToken, nextHref, finishAuthSession]);

  const submitRegister = useCallback(async () => {
    setError("");
    const emailVal = email.trim().toLowerCase();
    if (!isValidEmail(emailVal)) {
      setError("Некорректный email");
      return;
    }
    const validation = validatePasswordPolicy(password);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailVal, password, invitationToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Не удалось создать аккаунт");
        return;
      }
      if (data.verificationEmailSendFailed === true) {
        toast.message(VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST);
      }
      const raw =
        typeof data.redirectTo === "string" && data.redirectTo.length > 0
          ? data.redirectTo
          : nextHref ?? getPostAuthRedirect();
      await finishAuthSession(raw);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [email, password, invitationToken, nextHref, finishAuthSession]);

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
    minPasswordLen: PASSWORD_MIN_LENGTH,
    resetCredentials,
  };
}
