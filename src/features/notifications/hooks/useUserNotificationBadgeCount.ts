"use client";

import { useEffect, useMemo, useState } from "react";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useEmailVerificationPromptVisibility } from "@/features/email-verification/hooks/useEmailVerificationPromptVisibility";
import { isEmailVerificationPromptSent } from "@/features/email-verification/lib/emailVerificationPromptState";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/auth/client";

/**
 * Единый источник бейджа для всех уведомлений (USER + BUSINESS + ADMIN):
 * - базовый unreadCount из API (без фильтра по stream)
 * - email verification prompt считается "новым" пока видим и письмо не отправлено
 */
export function useUserNotificationBadgeCount() {
  const family = useFamilyPersona();
  const userId = family?.menuUser?.id;
  const { unreadCount, refresh } = useUnreadNotificationCount();
  const { visible: emailVerificationPromptVisible } = useEmailVerificationPromptVisibility();
  const [emailPromptSent, setEmailPromptSent] = useState(false);

  useEffect(() => {
    setEmailPromptSent(isEmailVerificationPromptSent(userId));
  }, [userId]);

  useEffect(() => {
    const syncSentState = () => setEmailPromptSent(isEmailVerificationPromptSent(userId));
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, syncSentState);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, syncSentState);
  }, [userId]);

  const displayUnreadCount = useMemo(
    () => {
      // Email prompt показывает индикатор пока видим и письмо не отправлено
      const emailPromptBonus = emailVerificationPromptVisible && !emailPromptSent ? 1 : 0;
      return Math.max(0, unreadCount + emailPromptBonus);
    },
    [unreadCount, emailVerificationPromptVisible, emailPromptSent],
  );

  return { displayUnreadCount, refreshUnreadCount: refresh };
}

