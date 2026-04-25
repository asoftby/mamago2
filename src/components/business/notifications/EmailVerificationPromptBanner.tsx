"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "@/lib/toast";
import { SystemNotificationCard } from "@/features/notifications/components/SystemNotificationCard";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { useResendVerificationEmail } from "@/features/email-verification/hooks/useResendVerificationEmail";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";
import { notifyNotificationsChanged } from "@/lib/auth/client";
import {
  isEmailVerificationPromptSent,
  markEmailVerificationPromptSent,
} from "@/features/email-verification/lib/emailVerificationPromptState";

type Props = {
  onDismiss: () => void;
  className?: string;
};

export function EmailVerificationPromptBanner({ onDismiss, className }: Props) {
  const { refetch, user } = useAuthMe();
  const { resend, loading, messages } = useResendVerificationEmail();
  const viewedRef = useRef(false);
  const [emailSentOnce, setEmailSentOnce] = useState(false);

  useEffect(() => {
    setEmailSentOnce(isEmailVerificationPromptSent(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      trackNotificationEvent("email_verify_pinned_banner_viewed");
    }
  }, []);

  const handleResend = useCallback(async () => {
    const result = await resend();
    if (!result.ok) {
      if (result.code === "RATE_LIMIT") {
        toast.message(messages.rateLimit);
        return;
      }
      toast.error(messages.error);
      return;
    }
    if (result.alreadyVerified) {
      toast.success("Email уже подтверждён");
      setEmailSentOnce(true);
      markEmailVerificationPromptSent(user?.id);
      notifyNotificationsChanged();
      void refetch();
      return;
    }
    toast.success(messages.success);
    setEmailSentOnce(true);
    markEmailVerificationPromptSent(user?.id);
    notifyNotificationsChanged();
  }, [resend, refetch, messages, user?.id]);

  return (
    <SystemNotificationCard
      icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
      title="Подтвердите email"
      description="Чтобы сохранить доступ к вашим идеям, планам и важным действиям."
      actionLabel={emailSentOnce ? "Отправлено" : "Отправить письмо"}
      onAction={handleResend}
      actionDisabled={emailSentOnce}
      secondaryActionLabel={emailSentOnce ? "Отправить повторно" : undefined}
      onSecondaryAction={emailSentOnce ? handleResend : undefined}
      dismissible={false}
      loading={loading}
      tone="email"
      actionCompact
      className={className}
    />
  );
}
