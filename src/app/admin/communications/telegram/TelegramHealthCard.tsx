"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type WebhookUrlStatus =
  | { kind: "ok"; expectedOrigin: string }
  | { kind: "mismatch"; expectedOrigin: string }
  | { kind: "tunnel_not_found" }
  | { kind: "unknown" };

type Diagnostics = {
  environment: "DEV" | "PROD";
  botUsername: string | null;
  botError: string | null;
  webhook: {
    url: string;
    pendingUpdateCount: number;
    lastErrorMessage: string | null;
    lastErrorDate: string | null;
  } | null;
  webhookError: string | null;
  secretConfigured: boolean;
  urlStatus: WebhookUrlStatus;
};

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      )}
      <div className="min-w-0">
        <span className="font-medium text-stone-800">{label}</span>
        {detail ? <p className="break-all text-stone-500">{detail}</p> : null}
      </div>
    </div>
  );
}

function describeUrlStatus(diag: Diagnostics): { ok: boolean; detail: string } {
  const status = diag.urlStatus;
  switch (status.kind) {
    case "ok":
      return { ok: true, detail: `Совпадает с ${status.expectedOrigin}` };
    case "mismatch":
      return {
        ok: false,
        detail:
          diag.environment === "DEV"
            ? `Хук смотрит не на текущий туннель (${status.expectedOrigin}) — прогони scripts/set-local-webhook.sh`
            : `Не совпадает с ожидаемым доменом ${status.expectedOrigin}`,
      };
    case "tunnel_not_found":
      return { ok: false, detail: "ngrok не запущен (localhost:4040 не отвечает)" };
    case "unknown":
      return { ok: false, detail: "NEXT_PUBLIC_APP_URL не настроен — сравнить не с чем" };
  }
}

export function TelegramHealthCard() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/telegram/diagnostics", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDiag(json as Diagnostics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось получить диагностику");
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestMessage = useCallback(async () => {
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const res = await fetch("/api/admin/telegram/diagnostics/test-message", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSendResult("Отправлено — проверь Telegram.");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  return (
    <Card className="rounded-3xl border-stone-200/90">
      <CardHeader>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Activity className="h-5 w-5" />
        </div>
        <CardTitle>Здоровье Telegram-бота</CardTitle>
        <CardDescription>
          getMe и getWebhookInfo для бота текущего окружения. Только чтение — вебхук отсюда не меняется.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading && !diag ? (
          <div className="flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаю диагностику…
          </div>
        ) : null}

        {error ? <p className="text-red-600">{error}</p> : null}

        {diag ? (
          <div className="space-y-2.5">
            <StatusRow
              ok={Boolean(diag.botUsername)}
              label={diag.botUsername ? `Бот: @${diag.botUsername} (${diag.environment})` : `Бот недоступен (${diag.environment})`}
              detail={diag.botError}
            />
            <StatusRow
              ok={Boolean(diag.webhook?.url)}
              label="Webhook URL"
              detail={diag.webhookError ?? (diag.webhook?.url || "не установлен")}
            />
            <StatusRow ok={describeUrlStatus(diag).ok} label="Соответствие окружению" detail={describeUrlStatus(diag).detail} />
            <StatusRow
              ok={diag.secretConfigured}
              label="Webhook secret"
              detail={diag.secretConfigured ? "настроен" : "не настроен в env"}
            />
            <StatusRow
              ok={!diag.webhook?.lastErrorMessage}
              label="Последняя ошибка доставки"
              detail={
                diag.webhook?.lastErrorMessage
                  ? `${diag.webhook.lastErrorMessage} (${diag.webhook.lastErrorDate ?? "?"})`
                  : "нет"
              }
            />
            {diag.webhook ? (
              <p className="text-stone-500">В очереди обновлений: {diag.webhook.pendingUpdateCount}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button variant="outline" className="rounded-2xl" onClick={() => void loadDiagnostics()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Проверить
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={() => void sendTestMessage()} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Тест в Telegram
          </Button>
        </div>
        {sendResult ? <p className="text-emerald-600">{sendResult}</p> : null}
        {sendError ? <p className="text-red-600">{sendError}</p> : null}
      </CardContent>
    </Card>
  );
}
