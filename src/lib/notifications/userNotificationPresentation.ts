import type { NotificationChannel, NotificationType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  CalendarClock,
  Lock,
  Sparkles,
  Target,
} from "lucide-react";

export const SYSTEM_NOTIFICATION_GUARD_MESSAGE =
  "Уведомления аккаунта должны быть включены хотя бы в одном канале";

export type UserNotificationMatrixDefinition = {
  notificationType: NotificationType;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const USER_NOTIFICATION_MATRIX_DEFINITIONS: readonly UserNotificationMatrixDefinition[] = [
  {
    notificationType: "PLAN_TOMORROW_DIGEST",
    title: "Завтра в плане",
    description: "Ежедневный Telegram-digest о событиях на завтра",
    icon: CalendarClock,
  },
  {
    notificationType: "REMINDER",
    title: "План",
    description: "Напоминания о событиях и изменениях в вашем плане",
    icon: BellRing,
  },
  {
    notificationType: "RECOMMENDATION",
    title: "Рекомендации",
    description: "Подборки и идеи для вас и детей",
    icon: Target,
  },
  {
    notificationType: "NEWS",
    title: "Новое и интересное",
    description: "Новые события, места и предложения",
    icon: Sparkles,
  },
  {
    notificationType: "SYSTEM",
    title: "Аккаунт",
    description: "Email, пароль, Telegram и безопасность аккаунта",
    icon: Lock,
  },
] as const;

export function getUserNotificationMatrixDefinitions(): UserNotificationMatrixDefinition[] {
  return [...USER_NOTIFICATION_MATRIX_DEFINITIONS];
}

export function wouldDisableLastSystemNotificationChannel(params: {
  notificationType: NotificationType;
  channels: Record<NotificationChannel, boolean>;
  channel: NotificationChannel;
  enabled: boolean;
}): boolean {
  if (params.notificationType !== "SYSTEM" || params.enabled) {
    return false;
  }

  const nextChannels = {
    ...params.channels,
    [params.channel]: params.enabled,
  };

  return !nextChannels.IN_APP && !nextChannels.EMAIL && !nextChannels.TELEGRAM;
}
