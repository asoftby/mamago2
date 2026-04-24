import type { NotificationChannel, NotificationType } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Lock,
  Sparkles,
  Target,
} from "lucide-react";

export const SYSTEM_NOTIFICATION_GUARD_MESSAGE =
  "Системные уведомления должны быть включены хотя бы в одном канале";

export type UserNotificationMatrixDefinition = {
  notificationType: NotificationType;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const USER_NOTIFICATION_MATRIX_DEFINITIONS: readonly UserNotificationMatrixDefinition[] = [
  {
    notificationType: "REMINDER",
    title: "Напоминания",
    description: "О запланированных событиях",
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
    title: "Системные",
    description: "Безопасность и важные изменения",
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
