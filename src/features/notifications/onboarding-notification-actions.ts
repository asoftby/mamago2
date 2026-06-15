import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "@/lib/toast";
import { notifyNotificationsChanged } from "@/lib/auth/client";
import type { NotificationApiRow } from "@/lib/notifications/types";
import type { ResendVerificationResult } from "@/features/email-verification/hooks/useResendVerificationEmail";
import {
  openTelegramConnectUrl,
  requestTelegramConnectLink,
} from "@/features/notifications/telegram-connect-action";

export type OnboardingNotificationKind =
  | "VERIFY_EMAIL"
  | "VERIFY_PHONE"
  | "CONNECT_TELEGRAM";

export const VERIFY_EMAIL_ACCOUNT_SETTINGS_PATH = "/me/settings/account";

export function getOnboardingNotificationKind(
  notification: NotificationApiRow,
): OnboardingNotificationKind | null {
  const fromEntity = notification.entityId;
  if (
    fromEntity === "VERIFY_EMAIL" ||
    fromEntity === "VERIFY_PHONE" ||
    fromEntity === "CONNECT_TELEGRAM"
  ) {
    return fromEntity;
  }

  const metadataKind = notification.metadata?.kind;
  if (
    metadataKind === "VERIFY_EMAIL" ||
    metadataKind === "VERIFY_PHONE" ||
    metadataKind === "CONNECT_TELEGRAM"
  ) {
    return metadataKind;
  }

  return null;
}

export function isVerifyEmailNotification(notification: NotificationApiRow): boolean {
  return getOnboardingNotificationKind(notification) === "VERIFY_EMAIL";
}

export function isConnectTelegramNotification(notification: NotificationApiRow): boolean {
  return getOnboardingNotificationKind(notification) === "CONNECT_TELEGRAM";
}

export function isOnboardingNotification(notification: NotificationApiRow): boolean {
  return getOnboardingNotificationKind(notification) != null;
}

function openMailClient(email: string): void {
  const trimmed = email.trim();
  if (!trimmed) return;

  try {
    window.location.href = `mailto:${trimmed}`;
  } catch {
    // mailto недоступен — toast уже показан, пользователь может открыть почту вручную
  }
}

export async function handleVerifyEmailNotificationAction(params: {
  resend: () => Promise<ResendVerificationResult>;
  userEmail?: string | null;
  router: AppRouterInstance;
  onRefresh?: () => void | Promise<void>;
  onAuthRefresh?: () => void | Promise<void>;
}): Promise<void> {
  const email = params.userEmail?.trim();

  if (!email) {
    toast.error("Укажите email в профиле, чтобы подтвердить почту.");
    params.router.push(VERIFY_EMAIL_ACCOUNT_SETTINGS_PATH);
    return;
  }

  const result = await params.resend();

  if (!result.ok) {
    if (result.code === "NO_EMAIL") {
      toast.error("Укажите email в профиле, чтобы подтвердить почту.");
      params.router.push(VERIFY_EMAIL_ACCOUNT_SETTINGS_PATH);
      return;
    }
    if (result.code === "RATE_LIMIT") {
      toast.message(result.message);
      return;
    }
    toast.error(result.message);
    return;
  }

  if (result.alreadyVerified) {
    toast.success("Email уже подтверждён.");
    await params.onAuthRefresh?.();
    await params.onRefresh?.();
    notifyNotificationsChanged();
    return;
  }

  toast.success("Письмо для подтверждения отправлено. Проверьте почту.");
  openMailClient(result.email ?? email);
}

export async function handleConnectTelegramNotificationAction(params: {
  onRefresh?: () => void | Promise<void>;
  onStartPolling?: () => void;
}): Promise<void> {
  const result = await requestTelegramConnectLink();

  if (!result.ok) {
    toast.error(result.message);
    return;
  }

  if (result.alreadyConnected) {
    toast.success("Telegram уже подключён.");
    await params.onRefresh?.();
    notifyNotificationsChanged();
    return;
  }

  openTelegramConnectUrl(result.url);
  toast.success("Откройте Telegram и подтвердите подключение.");
  params.onStartPolling?.();
}

export async function handleOnboardingNotificationCta(params: {
  notification: NotificationApiRow;
  resendVerificationEmail: () => Promise<ResendVerificationResult>;
  userEmail?: string | null;
  router: AppRouterInstance;
  onRefresh?: () => void | Promise<void>;
  onAuthRefresh?: () => void | Promise<void>;
  onTelegramConnectStarted?: () => void;
}): Promise<boolean> {
  const kind = getOnboardingNotificationKind(params.notification);

  if (kind === "VERIFY_EMAIL") {
    await handleVerifyEmailNotificationAction({
      resend: params.resendVerificationEmail,
      userEmail: params.userEmail,
      router: params.router,
      onRefresh: params.onRefresh,
      onAuthRefresh: params.onAuthRefresh,
    });
    return true;
  }

  if (kind === "CONNECT_TELEGRAM") {
    await handleConnectTelegramNotificationAction({
      onRefresh: params.onRefresh,
      onStartPolling: params.onTelegramConnectStarted,
    });
    return true;
  }

  return false;
}
