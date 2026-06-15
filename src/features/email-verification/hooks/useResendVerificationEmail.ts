"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export type ResendVerificationCode = "RATE_LIMIT" | "ERROR" | "NO_EMAIL";

export type ResendVerificationResult =
  | { ok: true; alreadyVerified: boolean; email?: string }
  | {
      ok: false;
      code?: ResendVerificationCode;
      message: string;
    };

const MSG_SUCCESS = "Письмо отправлено. Проверьте почту.";
const MSG_ERROR = "Не удалось отправить письмо";
const MSG_RATE = "Подождите немного перед повторной отправкой";

export function useResendVerificationEmail() {
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  const resend = useCallback(async (): Promise<ResendVerificationResult> => {
    if (inFlight.current) {
      return { ok: false, message: "Подождите…", code: "ERROR" };
    }
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification-email", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyVerified?: boolean;
        code?: string;
        message?: string;
        email?: string;
      };

      if (res.status === 400 && data.code === "NO_EMAIL") {
        return {
          ok: false,
          code: "NO_EMAIL",
          message:
            data.message ?? "Укажите email в профиле, чтобы подтвердить почту.",
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          code: "RATE_LIMIT",
          message: data.message ?? MSG_RATE,
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          code: "ERROR",
          message: data.error ?? MSG_ERROR,
        };
      }

      if (data.alreadyVerified) {
        return { ok: true, alreadyVerified: true, email: data.email };
      }

      return { ok: true, alreadyVerified: false, email: data.email };
    } catch {
      return { ok: false, code: "ERROR", message: MSG_ERROR };
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  const messages = useMemo(
    () => ({ success: MSG_SUCCESS, error: MSG_ERROR, rateLimit: MSG_RATE }),
    [],
  );

  return { resend, loading, messages };
}
