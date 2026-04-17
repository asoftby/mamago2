"use client";

import { useCallback, useState } from "react";
import { useAuthMe } from "@/lib/auth/useAuthMe";

const SESSION_DISMISS_PREFIX = "mamago_email_verify_prompt_dismissed";

function dismissKey(userId: string | undefined) {
  return userId ? `${SESSION_DISMISS_PREFIX}:${userId}` : SESSION_DISMISS_PREFIX;
}

/**
 * Состояние pinned-напоминания о неподтверждённом email в центре уведомлений.
 * Закрытие — только на текущую сессию браузера (sessionStorage), без «навсегда».
 */
export function useEmailVerificationPromptVisibility() {
  const { user, isAuthenticated, isLoading, isEmailVerified } = useAuthMe();
  const [dismissedThisSession, setDismissedThisSession] = useState(() => {
    const uid = user?.id;
    if (!uid) return false;
    try {
      return sessionStorage.getItem(dismissKey(uid)) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    const uid = user?.id;
    if (!uid) return;
    try {
      sessionStorage.setItem(dismissKey(uid), "1");
    } catch {
      /* ignore */
    }
    setDismissedThisSession(true);
  }, [user?.id]);

  const visible =
    !isLoading &&
    isAuthenticated &&
    !isEmailVerified &&
    !dismissedThisSession;

  return { visible, dismiss };
}
