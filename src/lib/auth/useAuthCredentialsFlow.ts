"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { appendBirthdayBuilderAuthParam } from "@/lib/auth/appendBirthdayBuilderAuthParam";
import { getPostAuthRedirect } from "@/lib/auth/postAuthRedirect";
import { getSafeRedirectPath } from "@/lib/auth/redirectTo";
import { notifyAuthStateChanged, notifyNotificationsChanged } from "@/lib/auth/client";
import { getPostAuthContext, savePostAuthContext, type AuthAction } from "@/lib/post-auth";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import { toast } from "@/lib/toast";
import { VERIFICATION_EMAIL_SEND_FAILED_AFTER_REGISTRATION_TOAST } from "@/lib/auth/registrationVerificationToast";
import { PASSWORD_MIN_LENGTH, validatePasswordPolicy } from "@/lib/auth/passwordPolicy";

export type AuthFlowMode = "login" | "register";

export type AuthFinishContext = "modal" | "embedded";

export interface ActivationNotice {
  /** Provider-confirmed send, not just "the account is PENDING_ACTIVATION". */
  delivered: boolean;
  maskedEmail: string;
}

/** Purely a UX throttle against spam-clicking — the real limit is server-side (activationRateLimit). */
const RESEND_COOLDOWN_SECONDS = 30;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function parseAuthAction(value: unknown, fallback: AuthAction): AuthAction {
  return value === "login" || value === "signup" ? value : fallback;
}

function saveAuthActionToPostAuthContext(authAction: AuthAction) {
  const context = getPostAuthContext();
  if (!context) return;

  savePostAuthContext({
    ...context,
    authAction,
  });
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
  const [activationNotice, setActivationNotice] = useState<ActivationNotice | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  const switchMode = useCallback((m: AuthFlowMode) => {
    setMode(m);
    setError("");
    setActivationNotice(null);
    setResendAvailableAt(null);
  }, []);

  useEffect(() => {
    if (!open) {
      setMode(initialMode);
      setEmail(initialEmail);
      setPassword("");
      setShowPassword(false);
      setError("");
      setActivationNotice(null);
      setResendAvailableAt(null);
    }
  }, [open, initialEmail, initialMode]);

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

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const finishAuthSession = useCallback(
    async (rawRedirect: string) => {
      const target = appendBirthdayBuilderAuthParam(
        getSafeRedirectPath(rawRedirect, nextHref ?? getPostAuthRedirect()),
      );
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
    [embedded, beforeFinishAuthSession, nextHref, onAuthSuccess, router, skipRedirectAfterAuth],
  );

  /**
   * The one call to /api/auth/login, shared by the initial submit and the
   * "Отправить ссылку повторно" resend action — a PENDING_ACTIVATION
   * account's password is never actually checked server-side, so
   * re-hitting this same endpoint with the same credentials is exactly
   * "try requesting the activation link again," not a real re-auth attempt.
   */
  const attemptLogin = useCallback(
    async (emailVal: string, passwordVal: string) => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: emailVal, password: passwordVal, invitationToken }),
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
            raw === "Invalid email or password" ? "Неверный email или пароль" : raw || "Что-то пошло не так",
          );
          return;
        }
        saveAuthActionToPostAuthContext(parseAuthAction(data.authAction, "login"));
        const raw =
          typeof data.redirectTo === "string" && data.redirectTo.length > 0
            ? data.redirectTo
            : getSafeRedirectPath(nextHref, getPostAuthRedirect());
        await finishAuthSession(raw);
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    },
    [invitationToken, nextHref, finishAuthSession],
  );

  const submitLogin = useCallback(async () => {
    setError("");
    const emailVal = email.trim().toLowerCase();
    if (!emailVal || !password) {
      setError("Введите email и пароль");
      return;
    }
    await attemptLogin(emailVal, password);
  }, [email, password, attemptLogin]);

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
      saveAuthActionToPostAuthContext(parseAuthAction(data.authAction, "signup"));
      const raw =
        typeof data.redirectTo === "string" && data.redirectTo.length > 0
          ? data.redirectTo
          : getSafeRedirectPath(nextHref, getPostAuthRedirect());
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
    setActivationNotice(null);
    setResendAvailableAt(null);
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
    activationNotice,
    resendSecondsLeft,
    resendActivationLink,
    useDifferentEmail,
  };
}
