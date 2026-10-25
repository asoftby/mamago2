"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type Status = { linked: boolean; configured: boolean; botUsername?: string; username?: string };

export function BusinessTelegramStatusRow() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/business/telegram", { cache: "no-store" });
      if (response.ok) setStatus(await response.json() as Status);
    } catch { /* Keep previous status on transient errors. */ }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const connect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/business/telegram", { method: "POST" });
      const body = await response.json() as { url?: string };
      if (!response.ok || !body.url) throw new Error("Business Bot не настроен");
      // A user-initiated same-tab navigation works on iOS Safari, where an
      // async window.open after the link API request can be popup-blocked.
      window.location.assign(body.url);
      toast.success("Откройте бота и нажмите Start, затем обновите статус подключения");
    } catch { toast.error("Не удалось создать ссылку подключения"); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/business/telegram", { method: "DELETE" });
      if (!response.ok) throw new Error("Cannot disconnect");
      await refresh();
    } catch { toast.error("Не удалось отключить Business Bot"); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
    <div className="flex-1">
      <div className="font-medium">Telegram для бизнеса</div>
      <div className="text-xs text-muted-foreground">
        {status?.linked ? "Подключён. Доставка уведомлений включается отдельно" : status?.configured ? `Для заявок и подтверждений · @${status.botUsername}` : "Бот ещё не настроен"}
      </div>
    </div>
    {status?.linked ? <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>Отключить</Button>
      : <Button variant="secondary" size="sm" onClick={connect} disabled={busy || !status?.configured}>Подключить Telegram</Button>}
    <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>Проверить статус</Button>
  </div>;
}
