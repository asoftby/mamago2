"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { Send } from "lucide-react";
import { SystemNotificationCard } from "@/features/notifications/components/SystemNotificationCard";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";
import { useTelegramConnectionStatus } from "@/hooks/useTelegramConnectionStatus";

type Props = {
  className?: string;
  /** Called when Telegram connection is confirmed by the server */
  onConnected?: () => void;
};

export function TelegramPromptBanner({ className, onConnected }: Props) {
  const [isPolling, setIsPolling] = useState(false);

  useTelegramConnectionStatus({
    enabled: true,
    polling: isPolling,
    onConnected: (status) => {
      setIsPolling(false);
      onConnected?.();
    },
  });

  const handleConnect = async () => {
    trackNotificationEvent("telegram_connect_clicked_from_pinned");
    try {
      const res = await fetch("/api/settings/telegram/link", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Не удалось подготовить Telegram");
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
      
      // Start polling for connection status
      setIsPolling(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть Telegram");
    }
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
