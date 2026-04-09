"use client";

import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTelegramBotConnectUrl } from "@/lib/telegram/telegramConnectUrl";

type Props = {
  connected: boolean;
};

/**
 * Статус / CTA Telegram внутри модалки настроек (без отдельных overlay).
 */
export function TelegramStatusRow({ connected }: Props) {
  const connectUrl = getTelegramBotConnectUrl();

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
      {!connected && connectUrl.startsWith("http") ? (
        <Button size="sm" variant="secondary" className="shrink-0" asChild>
          <Link href={connectUrl} target="_blank" rel="noopener noreferrer">
            Подключить
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
