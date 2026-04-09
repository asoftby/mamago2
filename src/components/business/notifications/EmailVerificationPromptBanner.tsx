"use client";

import { useCallback, useEffect, useRef } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { SystemNotificationCard } from "@/features/notifications/components/SystemNotificationCard";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { useResendVerificationEmail } from "@/features/email-verification/hooks/useResendVerificationEmail";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";

type Props = {
  onDismiss: () => void;
  className?: string;
};

export function EmailVerificationPromptBanner({ onDismiss, className }: Props) {
  const { refetch } = useAuthMe();
  const { resend, loading, messages } = useResendVerificationEmail();
  const viewedRef = useRef(false);

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
      void refetch();
      return;
    }
    toast.success(messages.success);
  }, [resend, refetch, messages]);

  const handleDismiss = useCallback(() => {
    trackNotificationEvent("email_verify_pinned_banner_dismissed");
    onDismiss();
  }, [onDismiss]);

  return (
    <SystemNotificationCard
      icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
      title="Подтвердите email"
      description="Чтобы сохранить доступ к вашим идеям, планам и важным действиям."
      actionLabel="Отправить письмо"
      onAction={handleResend}
      onDismiss={handleDismiss}
      dismissible
      loading={loading}
      tone="email"
      actionCompact
      className={className}
    />
  );
}
