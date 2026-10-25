"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";

type TelegramStatus = { linked: boolean; configured: boolean; username?: string };
type Props = { settingsHref: string };

export function BusinessTelegramDashboardStatus({ settingsHref }: Props) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/business/telegram", { cache: "no-store" });
      if (!response.ok) throw new Error("Status unavailable");
      setStatus(await response.json() as TelegramStatus);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/business/telegram", { method: "POST" });
      const body = await response.json() as { url?: string };
      if (!response.ok || !body.url) throw new Error("No connect URL");
      window.open(body.url, "_blank", "noopener,noreferrer");
      toast.success("Откройте бота, нажмите Start и проверьте подключение");
    } catch {
      toast.error("Не удалось создать ссылку подключения");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Link
        href={settingsHref}
        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition hover:opacity-80 ${
          status?.linked ? "border-green-200 bg-green-50 text-green-800" :
          status === null ? "border-stone-200 bg-stone-50 text-stone-600" :
          "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <span aria-hidden="true">✈</span>
        {status === null ? "Статус Telegram неизвестен" : status.linked ? "Telegram подключён" : "Telegram не подключён"}
      </Link>
      {status && !status.linked && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-stone-950">Подключите Telegram</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Получайте заявки и новости бизнеса в mamaGo Business Bot.
          </p>
          {status.configured ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={connect} disabled={busy}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy ? "Подключение…" : "Подключить Telegram"}
              </button>
              <button type="button" onClick={() => void refresh()}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium">
                Проверить подключение
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Подключение бота пока недоступно.</p>
          )}
        </section>
      )}
    </div>
  );
}
