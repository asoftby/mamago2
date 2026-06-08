"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { useResendVerificationEmail } from "@/features/email-verification/hooks/useResendVerificationEmail";
import { useTelegramConnectionStatus } from "@/hooks/useTelegramConnectionStatus";
import { notifyNotificationsChanged } from "@/lib/auth/client";
import type { NotificationApiRow } from "@/lib/notifications/types";
import {
  getOnboardingNotificationKind,
  handleOnboardingNotificationCta,
  isOnboardingNotification,
} from "@/features/notifications/onboarding-notification-actions";

type Options = {
  onRefresh?: () => void | Promise<void>;
};

export function useOnboardingNotificationCta(options: Options = {}) {
  const router = useRouter();
  const { user, refetch } = useAuthMe();
  const { resend, loading: emailResendLoading } = useResendVerificationEmail();
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [telegramActionLoading, setTelegramActionLoading] = useState(false);
  const [telegramPolling, setTelegramPolling] = useState(false);
  const [pollingTelegramNotificationId, setPollingTelegramNotificationId] = useState<
    string | null
  >(null);

  const refreshAfterTelegramConnected = useCallback(async () => {
    await fetch("/api/me/telegram/connected", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    await options.onRefresh?.();
    notifyNotificationsChanged();
    await refetch();
  }, [options.onRefresh, refetch]);

  useTelegramConnectionStatus({
    enabled: true,
    polling: telegramPolling,
    onConnected: () => {
      setTelegramPolling(false);
      setPollingTelegramNotificationId(null);
      void refreshAfterTelegramConnected();
    },
    onTimeout: () => {
      setTelegramPolling(false);
      setPollingTelegramNotificationId(null);
    },
  });

  const handleCtaClick = useCallback(
    async (notification: NotificationApiRow): Promise<boolean> => {
      if (!isOnboardingNotification(notification)) {
        return false;
      }

      setActiveNotificationId(notification.id);
      const kind = getOnboardingNotificationKind(notification);

      if (kind === "CONNECT_TELEGRAM") {
        setTelegramActionLoading(true);
      }

      try {
        return await handleOnboardingNotificationCta({
          notification,
          resendVerificationEmail: resend,
          userEmail: user?.email,
          router,
          onRefresh: options.onRefresh,
          onAuthRefresh: async () => {
            await refetch();
          },
          onTelegramConnectStarted: () => {
            setPollingTelegramNotificationId(notification.id);
            setTelegramPolling(true);
          },
        });
      } finally {
        setActiveNotificationId(null);
        if (kind === "CONNECT_TELEGRAM") {
          setTelegramActionLoading(false);
        }
      }
    },
    [options.onRefresh, refetch, resend, router, user?.email],
  );

  const getCtaProps = useCallback(
    (notification: NotificationApiRow) => {
      const kind = getOnboardingNotificationKind(notification);
      const isActive = activeNotificationId === notification.id;

      if (kind === "VERIFY_EMAIL") {
        const isLoading = emailResendLoading && isActive;
        return {
          loading: isLoading,
          label: isLoading ? "Отправляем…" : notification.ctaLabel,
          disabled: isLoading,
        };
      }

      if (kind === "CONNECT_TELEGRAM") {
        const isLoading =
          (telegramActionLoading && isActive) ||
          (telegramPolling && pollingTelegramNotificationId === notification.id);
        return {
          loading: isLoading,
          label: isLoading ? "Открываем Telegram…" : notification.ctaLabel,
          disabled: isLoading,
        };
      }

      return {
        loading: false,
        label: notification.ctaLabel,
        disabled: false,
      };
    },
    [
      activeNotificationId,
      emailResendLoading,
      pollingTelegramNotificationId,
      telegramActionLoading,
      telegramPolling,
    ],
  );

  return {
    handleCtaClick,
    getCtaProps,
  };
}
