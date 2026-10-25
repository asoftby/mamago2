"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type Status = {
  linked: boolean;
  configured: boolean;
  botUsername?: string;
  username?: string;
};

export function BusinessTelegramStatusRow({
  onStatusChange,
}: {
  onStatusChange?: (status: Status) => void;
}) {
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
    // Linking takes place in Telegram. Refresh when the user returns to mamaGo.
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
      const opened = window.open(body.url, "_blank", "noopener,noreferrer");
      if (!opened) {
        // Browser may block an async pop-up; a same-tab navigation still works.
        window.location.assign(body.url);
      }
      toast.success("Откройте Business Bot и нажмите Start");
    } catch {
      toast.error("Не удалось создать ссылку подключения Business Bot");
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
      toast.success("Business Bot отключён");
    } catch {
      toast.error("Не удалось отключить Business Bot");
    } finally {
      setBusy(false);
    }
  };

  const description = error
    ? "Не удалось проверить подключение. Попробуйте ещё раз."
    : loading
      ? "Проверяем подключение…"
      : status?.linked
        ? "Подключён. Доставка заявок включается отдельно после проверки."
        : status?.configured
          ? "Подключите отдельного бота для заявок и уведомлений бизнеса."
          : "Business Bot ещё не настроен на сервере.";

  return (
    <section aria-label="Telegram для бизнеса" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
        {status?.linked ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Send className="h-5 w-5 text-foreground" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Telegram для бизнеса</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        {status?.linked && status.username ? <p className="text-xs text-muted-foreground">Аккаунт: @{status.username}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status?.linked ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void disconnect()} disabled={busy}>
            Отключить
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => void connect()}
            disabled={busy || loading || error || !status?.configured}>
            Подключить Telegram
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={busy || loading}>
          Проверить статус
        </Button>
      </div>
    </section>
  );
}
