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
      window.open(body.url, "_blank", "noopener,noreferrer");
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
      <div className="font-medium">mamaGo Business Bot</div>
      <div className="text-xs text-muted-foreground">
        {status?.linked ? "Подключён (уведомления включим отдельно)" : status?.configured ? "Не подключён" : "Ожидает настройки"}
      </div>
    </div>
    {status?.linked ? <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>Отключить</Button>
      : <Button variant="secondary" size="sm" onClick={connect} disabled={busy || !status?.configured}>Подключить</Button>}
    <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>Проверить статус</Button>
  </div>;
}
