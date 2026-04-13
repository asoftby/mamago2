"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  connected: boolean;
  /** Called when Telegram connection is confirmed by the server */
  onConnected?: () => void;
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Статус / CTA Telegram внутри модалки настроек.
 * После открытия бота запускает polling статуса и вызывает onConnected при успехе.
 */
export function TelegramStatusRow({ connected, onConnected }: Props) {
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
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/90 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <Send className="h-4 w-4 text-sky-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">Telegram</p>
        {connected ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Подключён — уведомления можно получать в Telegram
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-neutral-500">
            Подключите бота, чтобы не пропускать важное
          </p>
        )}
      </div>
      {!connected ? (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={() => void handleConnect()}>
          Подключить
        </Button>
      ) : null}
    </div>
  );
}
