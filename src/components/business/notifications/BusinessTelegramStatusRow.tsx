"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info, Send, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type Status = {
  linked: boolean;
  configured: boolean;
  botUsername?: string;
  username?: string;
};

type Props = {
  location?: "dashboard" | "settings";
  onStatusChange?: (status: Status) => void;
};

export function BusinessTelegramStatusRow({
  location = "settings",
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/business/telegram", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Cannot fetch Business Bot status");
      const next = await response.json() as Status;
      setStatus(next);
      setError(false);
      onStatusChangeRef.current?.(next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Refresh automatically after the user completes the Telegram /start flow.
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/business/telegram", {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json() as { url?: string };
      if (!response.ok || !body.url) throw new Error("Business Bot unavailable");
      // Async window.open is blocked by some mobile browsers. Same-tab navigation
      // opens the deep link reliably; browser Back returns to the dashboard.
      window.location.assign(body.url);
    } catch {
      toast.error("Не удалось создать ссылку подключения Telegram");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/business/telegram", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Cannot disconnect");
      await refresh();
      toast.success("Telegram для бизнеса отключён");
    } catch {
      toast.error("Не удалось отключить Telegram для бизнеса");
    } finally {
      setBusy(false);
    }
  };

  const description = error
    ? "Не удалось загрузить статус подключения. Обновите страницу."
    : loading
      ? "Загружаем подключение…"
      : status?.linked
        ? "Telegram подключён. Управляйте уведомлениями в настройках бизнеса."
        : status?.configured
          ? "Подключите отдельного бота для заявок и уведомлений бизнеса."
          : "Подключение временно недоступно.";

  return (
    <section
      aria-label="Telegram для бизнеса"
      className="rounded-[28px] border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_36px_rgba(15,23,42,0.04)] sm:p-6"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-stone-900" aria-hidden="true">
          <Send className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-stone-950">Telegram для бизнеса</h2>
            {status?.linked && !error && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Подключён
              </span>
            )}
          </div>
          {location === "dashboard" && status?.linked && !error && (
            <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-2 rounded-xl bg-stone-50 text-stone-800 hover:bg-stone-100 sm:hidden">
              <Link href="/business/settings/notifications"><Settings className="h-4 w-4" aria-hidden="true" />Настроить уведомления</Link>
            </Button>
          )}
          <p className="mt-1 text-sm leading-6 text-stone-600" aria-live="polite">{description}</p>
          {status?.linked && status.username && !error && (
            <p className="mt-1 text-xs text-stone-500">Аккаунт: @{status.username}</p>
          )}
        </div>
        {location === "dashboard" && status?.linked && !error && (
          <Button asChild variant="outline" size="sm" className="hidden shrink-0 gap-2 rounded-xl bg-stone-50 text-stone-800 hover:bg-stone-100 sm:inline-flex">
            <Link href="/business/settings/notifications"><Settings className="h-4 w-4" aria-hidden="true" />Настроить уведомления</Link>
          </Button>
        )}
      </div>

      {!error && (location !== "dashboard" || !status?.linked) && (
        <div className="mt-4">
          {status?.linked ? (
            <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => void disconnect()} disabled={busy}>
              Отключить Telegram
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full rounded-xl bg-stone-900 text-white hover:bg-stone-800 sm:w-auto"
              onClick={() => void connect()}
              disabled={busy || loading || !status?.configured}
            >
              {busy ? "Открываем Telegram…" : "Подключить Telegram"}
            </Button>
          )}
        </div>
      )}

      {!status?.linked && !loading && !error && status?.configured && (
        <div className="mt-4 flex items-start gap-2 border-t border-stone-100 pt-3 text-xs leading-5 text-stone-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>После подключения уведомления можно настроить в разделе «Настройки → Уведомления».</span>
        </div>
      )}
    </section>
  );
}
