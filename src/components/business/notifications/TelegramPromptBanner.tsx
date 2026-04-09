"use client";

import { Send } from "lucide-react";
import { SystemNotificationCard } from "@/features/notifications/components/SystemNotificationCard";
import { getTelegramBotConnectUrl } from "@/lib/telegram/telegramConnectUrl";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";

type Props = {
  className?: string;
};

export function TelegramPromptBanner({ className }: Props) {
  const handleConnect = () => {
    trackNotificationEvent("telegram_connect_clicked_from_pinned");
    window.open(getTelegramBotConnectUrl(), "_blank", "noopener,noreferrer");
  };

  return (
    <SystemNotificationCard
      icon={<Send className="h-4 w-4" strokeWidth={1.75} />}
      title="Подключите Telegram"
      description="Чтобы не пропускать важные уведомления и ответы."
      actionLabel="Подключить"
      onAction={handleConnect}
      tone="telegram"
      actionCompact
      className={className}
    />
  );
}
