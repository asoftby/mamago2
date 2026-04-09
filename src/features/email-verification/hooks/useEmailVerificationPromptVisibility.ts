"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setDismissedThisSession(false);
      return;
    }
    try {
      setDismissedThisSession(sessionStorage.getItem(dismissKey(uid)) === "1");
    } catch {
      setDismissedThisSession(false);
    }
  }, [user?.id]);

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
