"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmailVerificationPromptVisibility } from "@/features/email-verification/hooks/useEmailVerificationPromptVisibility";
import { isEmailVerificationPromptSent } from "@/features/email-verification/lib/emailVerificationPromptState";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import {
  selectNotificationRevision,
  useNotificationStore,
} from "@/features/notifications/store";

/**
 * Единый источник бейджа для всех уведомлений (USER + BUSINESS + ADMIN):
 * - базовый unreadCount из notification store (без фильтра по stream)
 * - email verification prompt считается "новым" пока видим и письмо не отправлено
 */
export function useUserNotificationBadgeCount() {
  const { user, isAuthenticated } = useAuthMe();
  const userId = user?.id;
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const revision = useNotificationStore(selectNotificationRevision);
  const { visible: emailVerificationPromptVisible } = useEmailVerificationPromptVisibility();
  const [emailPromptSent, setEmailPromptSent] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setEmailPromptSent(isEmailVerificationPromptSent(userId));
    }, 0);
    return () => window.clearTimeout(id);
  }, [userId, revision]);

  const refreshUnreadCount = useCallback(async () => {
    await useNotificationStore.getState().refreshUnreadOnly();
  }, []);

  const displayUnreadCount = useMemo(
    () => {
      if (!isAuthenticated) return 0;
      const emailPromptBonus =
        emailVerificationPromptVisible && !emailPromptSent ? 1 : 0;
      return Math.max(0, unreadCount + emailPromptBonus);
    },
    [isAuthenticated, unreadCount, emailVerificationPromptVisible, emailPromptSent],
  );

  return { displayUnreadCount, refreshUnreadCount };
}
