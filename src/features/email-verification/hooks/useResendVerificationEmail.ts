"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export type ResendVerificationCode = "RATE_LIMIT" | "ERROR";

export type ResendVerificationResult =
  | { ok: true; alreadyVerified: boolean }
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
      };

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
        return { ok: true, alreadyVerified: true };
      }

      return { ok: true, alreadyVerified: false };
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
