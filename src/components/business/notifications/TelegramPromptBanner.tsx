"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { SystemNotificationCard } from "@/features/notifications/components/SystemNotificationCard";
import { trackNotificationEvent } from "@/lib/notifications/notificationAnalytics";

type Props = {
  className?: string;
  /** Called when Telegram connection is confirmed by the server */
  onConnected?: () => void;
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

export function TelegramPromptBanner({ className, onConnected }: Props) {
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollStartRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        return;
      }

      try {
        const res = await fetch("/api/settings/telegram/status", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { linked?: boolean };
        if (json.linked) {
          stopPolling();
          onConnected?.();
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, onConnected]);

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
      startPolling();
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
