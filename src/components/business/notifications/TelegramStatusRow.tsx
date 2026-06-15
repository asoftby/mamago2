"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTelegramConnectionStatus } from "@/hooks/useTelegramConnectionStatus";

type Props = {
  connected: boolean;
  canSendTelegramTest?: boolean;
  /** Called when Telegram connection is confirmed by the server */
  onConnected?: () => void;
  /** Called after Telegram is disconnected */
  onDisconnected?: () => void;
};

/**
 * Статус / CTA Telegram внутри модалки настроек.
 * Связанность приходит из `/api/notifications/settings` — здесь не дергаем
 * `/api/settings/telegram/status` до нажатия «Подключить» (тогда включается polling).
 */
export function TelegramStatusRow({
  connected,
  canSendTelegramTest = false,
  onConnected,
  onDisconnected,
}: Props) {
  const [isPolling, setIsPolling] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  useTelegramConnectionStatus({
    enabled: isPolling,
    polling: isPolling,
    onConnected: () => {
      setIsPolling(false);
      onConnected?.();
    },
  });

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

      setIsPolling(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось открыть Telegram");
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/notifications/telegram/test", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { ok: boolean; code?: string };

      if (!res.ok || !json.ok) {
        if (json.code === "TELEGRAM_NOT_CONNECTED") {
          toast.error("Telegram не подключён");
        } else if (json.code === "TELEGRAM_SEND_FAILED") {
          toast.error("Не удалось отправить сообщение. Проверьте, что вы не заблокировали бота.");
        } else if (json.code === "TELEGRAM_BOT_NOT_CONFIGURED") {
          toast.error("Telegram бот не настроен на сервере");
        } else {
          toast.error("Не удалось отправить тестовое сообщение");
        }
        return;
      }

      toast.success("Тестовое сообщение отправлено в Telegram");
    } catch {
      toast.error("Не удалось отправить тестовое сообщение");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/settings/telegram", {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(json?.error ?? "Не удалось отключить Telegram");
      }

      setDisconnectDialogOpen(false);
      toast.success("Telegram отключён");
      onDisconnected?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отключить Telegram");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/90 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          <Send className="h-4 w-4 text-sky-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">Telegram</p>
          {connected ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Подключён
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-neutral-500">
              Подключите бота для получения уведомлений в Telegram
            </p>
          )}
        </div>
        {connected ? (
          canSendTelegramTest ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs"
              onClick={() => void handleSendTest()}
              disabled={isSendingTest}
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Отправка…
                </>
              ) : (
                "Отправить тест"
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs"
              onClick={() => setDisconnectDialogOpen(true)}
            >
              Отключить
            </Button>
          )
        ) : (
          <Button size="sm" variant="secondary" className="shrink-0 text-xs" onClick={() => void handleConnect()}>
            Подключить
          </Button>
        )}
      </div>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-stone-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              Telegram перестанет получать уведомления, а сам канал снова станет недоступен в настройках.
              Email и уведомления в приложении сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-stone-900 hover:bg-stone-800"
              onClick={() => void handleDisconnect()}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Отключаем…
                </>
              ) : (
                "Отключить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
